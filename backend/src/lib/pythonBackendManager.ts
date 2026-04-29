/**
 * Python Backend Manager
 * Spawns and manages the camera-analytics Python process.
 *
 * Stage 7 addition: health polling + EventEmitter.
 * Emits 'python_backend_offline' after 3 consecutive health failures,
 * and 'python_backend_online' when connectivity returns.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';

interface BackendConfig {
  source: string | number;
  wsPort?: number;
  wsHost?: string;
  // Yan #22 — when set, propagated to Python as OBSERVAI_CAMERA_ID so the
  // NodePersister can attach analytics ticks to the right camera row.
  cameraId?: string;
}

interface BackendStatus {
  running: boolean;
  pid?: number;
  config?: BackendConfig;
  startedAt?: string;
  healthy?: boolean;
  lastHealthCheck?: string;
  consecutiveFailures?: number;
}

const HEALTH_POLL_INTERVAL_MS = 10_000;
const HEALTH_TIMEOUT_MS = 2_000;
const OFFLINE_THRESHOLD = 3;

class PythonBackendManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: BackendConfig | null = null;
  private startedAt: string | null = null;

  private healthTimer: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private lastHealthy: boolean | null = null;
  private lastHealthCheck: string | null = null;
  private offlineEmitted = false;

  // Faz 10 Bug #4: remember the last camera id we bound Python to. On health
  // recovery (Python restart) we re-POST /set-camera so the NodePersister
  // wakes up immediately on the new process — without this, a Python crash
  // would silently turn off persistence until the next /api/cameras/activate
  // call, which can be hours during a quiet shift.
  private boundCameraId: string | null = null;

  async start(config: BackendConfig): Promise<boolean> {
    if (this.process) {
      console.log('Python backend already running, stopping first...');
      await this.stop();
    }

    try {
      // Check if Python backend is already running externally (e.g. start-all.bat)
      const wsPort = config.wsPort || 5001;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const resp = await fetch(`http://localhost:${wsPort}/health`, { signal: controller.signal });
        clearTimeout(timeout);
        if (resp.ok) {
          console.log(`[PythonManager] Python backend already running on port ${wsPort} (external process)`);
          this.config = config;
          this.startedAt = new Date().toISOString();
          // Faz 10 Bug #4: external Python won't have OBSERVAI_CAMERA_ID env
          // (start-all.bat leaves it empty). POST /set-camera so the
          // NodePersister activates without requiring a Python restart.
          if (config.cameraId) {
            await this.setCamera(config.cameraId).catch(() => undefined);
          }
          return true;
        }
      } catch {
        // Not running, proceed to spawn
      }
      // Resolve paths
      const projectRoot = path.resolve(__dirname, '../../..');
      const cwd = path.join(projectRoot, 'packages', 'camera-analytics');

      // Use venv Python (platform-aware)
      const venvPython = process.platform === 'win32'
        ? path.join(cwd, 'venv', 'Scripts', 'python.exe')
        : path.join(cwd, 'venv', 'bin', 'python');

      const args = [
        '-m', 'camera_analytics.run_with_websocket',
        '--source', String(config.source),
        '--ws-port', String(config.wsPort || 5001),
        '--ws-host', config.wsHost || '0.0.0.0',
        '--model', 'yolo11l.pt',
      ];

      console.log(`[PythonManager] Starting: ${venvPython} ${args.join(' ')}`);
      console.log(`[PythonManager] Working dir: ${cwd}`);

      // Make onnxruntime find CUDA 12 runtime libs shipped as pip packages
      // (nvidia-cublas-cu12, nvidia-cudnn-cu12, …). System CUDA is 13 so
      // InsightFace's CUDA execution provider otherwise falls back to CPU.
      // On Windows these packages install .dll files into the same nvidia/*/bin
      // dir and Python adds them via os.add_dll_directory, so this env var is
      // only needed on Linux/macOS.
      const env = { ...process.env };
      // Yan #22 — Surface the active camera id to the Python persister.
      if (config.cameraId) {
        env.OBSERVAI_CAMERA_ID = config.cameraId;
      }
      if (process.platform !== 'win32') {
        const nvidiaBase = path.join(cwd, 'venv', 'lib', 'python3.14', 'site-packages', 'nvidia');
        const nvidiaLibs = [
          'cublas', 'cudnn', 'cuda_runtime', 'cufft', 'curand',
          'cuda_nvrtc', 'nvjitlink',
        ].map(pkg => path.join(nvidiaBase, pkg, 'lib'));
        env.LD_LIBRARY_PATH = [
          ...nvidiaLibs,
          env.LD_LIBRARY_PATH,
        ].filter(Boolean).join(':');
      }

      this.process = spawn(venvPython, args, {
        cwd,
        stdio: 'pipe',
        detached: false,
        env,
      });

      this.config = config;
      this.startedAt = new Date().toISOString();

      this.process.stdout?.on('data', (data: Buffer) => {
        process.stdout.write(`[Python] ${data.toString()}`);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        process.stderr.write(`[Python ERR] ${data.toString()}`);
      });

      this.process.on('exit', (code: number | null) => {
        console.log(`[PythonManager] Process exited with code ${code}`);
        this.process = null;
        this.startedAt = null;
      });

      this.process.on('error', (err: Error) => {
        console.error('[PythonManager] Process error:', err.message);
        this.process = null;
        this.startedAt = null;
      });

      // Brief wait to catch immediate crashes
      await new Promise(resolve => setTimeout(resolve, 500));

      return this.process !== null;
    } catch (error) {
      console.error('[PythonManager] Failed to start:', error);
      return false;
    }
  }

  /**
   * Faz 10 Bug #4 — bind/rebind the running Python pipeline to a Node camera
   * UUID. POSTs http://localhost:<wsPort>/set-camera with `{cameraId}`. The
   * Python side activates the NodePersister lazily so analytics_logs rows
   * start landing immediately, with no env-var-at-spawn-time gymnastics.
   *
   * Idempotent + best-effort. Returns false on network/HTTP failure but does
   * NOT throw — callers (cameras.ts /activate, health recovery) treat it as
   * advisory because activation should succeed even if Python is offline.
   */
  async setCamera(cameraId: string): Promise<boolean> {
    if (!cameraId || typeof cameraId !== 'string') return false;
    const wsPort = this.config?.wsPort || 5001;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2500);
    try {
      const resp = await fetch(`http://localhost:${wsPort}/set-camera`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cameraId }),
        signal: ctrl.signal,
      });
      if (resp.ok) {
        this.boundCameraId = cameraId;
        console.log(`[PythonManager] /set-camera → ${cameraId} (200)`);
        return true;
      }
      console.warn(`[PythonManager] /set-camera → ${resp.status}`);
      return false;
    } catch (err: any) {
      // ECONNREFUSED is the expected case when Python is offline — log quiet.
      if (err?.cause?.code !== 'ECONNREFUSED' && err?.code !== 'ECONNREFUSED') {
        console.warn('[PythonManager] /set-camera failed:', err?.message || err);
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  }

  /** Last camera id we bound Python to. Used by health-recovery rebind. */
  getBoundCameraId(): string | null {
    return this.boundCameraId;
  }

  async stop(): Promise<boolean> {
    if (!this.process) {
      return true;
    }
    try {
      const pid = this.process.pid;
      const proc = this.process;

      // Null out references BEFORE killing so exit handler doesn't double-clear
      this.process = null;
      this.config = null;
      this.startedAt = null;

      if (pid) {
        if (process.platform === 'win32') {
          // taskkill /f /t kills the entire process tree on Windows
          // We AWAIT the kill so port 5001 is released before we try to start again
          await new Promise<void>((resolve) => {
            const killer = spawn('taskkill', ['/pid', String(pid), '/f', '/t'], { stdio: 'ignore' });
            killer.on('close', () => resolve());
            killer.on('error', () => resolve());
            // Also release on process exit just in case
            proc.once('exit', () => resolve());
            // Fallback timeout: if nothing fires in 4 s, give up waiting
            setTimeout(resolve, 4000);
          });
        } else {
          proc.kill('SIGTERM');
          // Wait up to 4 s for graceful exit, then SIGKILL
          await new Promise<void>((resolve) => {
            const timeout = setTimeout(() => {
              try { proc.kill('SIGKILL'); } catch { /* already dead */ }
              resolve();
            }, 4000);
            proc.once('exit', () => { clearTimeout(timeout); resolve(); });
          });
        }
      }

      // Extra safety: give the OS a moment to release the port binding
      await new Promise(resolve => setTimeout(resolve, 500));

      return true;
    } catch (error) {
      console.error('[PythonManager] Failed to stop:', error);
      return false;
    }
  }

  getStatus(): BackendStatus {
    return {
      running: this.process !== null,
      pid: this.process?.pid,
      config: this.config ?? undefined,
      startedAt: this.startedAt ?? undefined,
      healthy: this.lastHealthy ?? undefined,
      lastHealthCheck: this.lastHealthCheck ?? undefined,
      consecutiveFailures: this.consecutiveFailures,
    };
  }

  private async probeHealth(port: number): Promise<boolean> {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
    try {
      const resp = await fetch(`http://localhost:${port}/health`, { signal: controller.signal });
      return resp.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  }

  startHealthMonitor(port: number = 5001): void {
    if (this.healthTimer) return;

    const tick = async () => {
      const healthy = await this.probeHealth(port);
      this.lastHealthCheck = new Date().toISOString();

      if (healthy) {
        if (this.consecutiveFailures > 0 || this.offlineEmitted) {
          console.log('[PythonManager] health recovered, backend online');
          this.emit('python_backend_online');
          this.offlineEmitted = false;
          // Faz 10 Bug #4: re-bind on recovery so persistence resumes
          // immediately without waiting for the next user activation.
          if (this.boundCameraId) {
            this.setCamera(this.boundCameraId).catch(() => undefined);
          }
        }
        this.consecutiveFailures = 0;
      } else {
        this.consecutiveFailures += 1;
        if (this.consecutiveFailures >= OFFLINE_THRESHOLD && !this.offlineEmitted) {
          console.warn(`[PythonManager] health failed ${this.consecutiveFailures}x, emitting offline event`);
          this.emit('python_backend_offline', {
            consecutiveFailures: this.consecutiveFailures,
            port,
            at: this.lastHealthCheck,
          });
          this.offlineEmitted = true;
        }
      }
      this.lastHealthy = healthy;
    };

    tick().catch(() => { /* best-effort */ });
    this.healthTimer = setInterval(() => {
      tick().catch(() => { /* best-effort */ });
    }, HEALTH_POLL_INTERVAL_MS);
    console.log(`[PythonManager] health monitor started (poll=${HEALTH_POLL_INTERVAL_MS}ms, threshold=${OFFLINE_THRESHOLD})`);
  }

  stopHealthMonitor(): void {
    if (this.healthTimer) {
      clearInterval(this.healthTimer);
      this.healthTimer = null;
    }
    this.consecutiveFailures = 0;
    this.offlineEmitted = false;
    this.lastHealthy = null;
  }
}

export const pythonBackendManager = new PythonBackendManager();
