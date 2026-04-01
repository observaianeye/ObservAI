/**
 * Python Backend Manager
 * Spawns and manages the camera-analytics Python process.
 */

import { spawn, ChildProcess } from 'child_process';
import path from 'path';

interface BackendConfig {
  source: string | number;
  wsPort?: number;
  wsHost?: string;
}

interface BackendStatus {
  running: boolean;
  pid?: number;
  config?: BackendConfig;
  startedAt?: string;
}

class PythonBackendManager {
  private process: ChildProcess | null = null;
  private config: BackendConfig | null = null;
  private startedAt: string | null = null;

  async start(config: BackendConfig): Promise<boolean> {
    if (this.process) {
      console.log('Python backend already running, stopping first...');
      await this.stop();
    }

    try {
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
        '--model', 'yolo11s.pt',
      ];

      console.log(`[PythonManager] Starting: ${venvPython} ${args.join(' ')}`);
      console.log(`[PythonManager] Working dir: ${cwd}`);

      this.process = spawn(venvPython, args, {
        cwd,
        stdio: 'pipe',
        detached: false,
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
    };
  }
}

export const pythonBackendManager = new PythonBackendManager();
