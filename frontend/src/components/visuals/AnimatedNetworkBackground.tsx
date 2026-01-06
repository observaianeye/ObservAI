import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react';

// ============================================================================
// CONFIGURATION CONSTANTS - Tweak these to adjust the animation behavior
// ============================================================================

/** Interval between forming new cameras (ms) */
const CAMERA_FORM_INTERVAL = 350;

/** Maximum number of cameras that can be formed */
const MAX_CAMERAS = 10;

/** Particles required to form one camera */
const PARTICLES_PER_CAMERA = 6;

/** Duration of burst/explosion effect (ms) */
const BURST_DURATION = 300;

/** Duration of revert animation back to network (ms) */
const REVERT_DURATION = 1500;

/** Speed multiplier for particles moving toward camera formation */
const FORMATION_SPEED = 4;

/** Explosion force multiplier for burst effect */
const BURST_FORCE = 12;

/** Size of camera icons (pixels) */
const CAMERA_SIZE = 45;

/** Distance from password field center for camera cluster */
const CAMERA_CLUSTER_RADIUS = 200;

/** Connection distance between particles */
const CONNECTION_DISTANCE = 150;

/** Idle timeout before burst when user stops typing (ms) */
const IDLE_TIMEOUT_BEFORE_BURST = 2000;

// ============================================================================
// TYPES
// ============================================================================

export type AnimationMode = 'idle' | 'watching' | 'reverting';

export interface AnimatedNetworkBackgroundRef {
  setMode: (mode: AnimationMode) => void;
  setTargetPosition: (x: number, y: number) => void;
  notifyTyping: () => void;
}

interface Particle {
  id: number;
  x: number;
  y: number;
  originX: number;
  originY: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  assignedToCamera: number | null;
  cameraPointIndex: number;
  isActive: boolean;
}

interface Camera {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  opacity: number;
  particles: Particle[];
  isFormed: boolean;
  jitterX: number;
  jitterY: number;
  glowIntensity: number;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutQuad(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function distance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Custom roundRect implementation for cross-browser compatibility
function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ============================================================================
// CAMERA DRAWING
// ============================================================================

function drawCamera(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  time: number
): void {
  const { x, y, angle, scale, opacity, glowIntensity, jitterX, jitterY } = camera;
  
  if (scale < 0.01 || opacity < 0.01) return;

  ctx.save();
  ctx.translate(x + jitterX, y + jitterY);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.globalAlpha = opacity;

  const size = CAMERA_SIZE;
  const halfSize = size / 2;

  // Glow effect
  const glowSize = 10 + glowIntensity * 6 + Math.sin(time * 0.003) * 2;
  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size + glowSize);
  gradient.addColorStop(0, `rgba(59, 130, 246, ${0.4 * glowIntensity})`);
  gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.15 * glowIntensity})`);
  gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, size + glowSize, 0, Math.PI * 2);
  ctx.fill();

  // Camera mount/arm
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.9)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-halfSize * 0.3, -halfSize * 0.9);
  ctx.lineTo(-halfSize * 0.3, -halfSize * 0.35);
  ctx.stroke();

  // Mount bracket
  ctx.beginPath();
  ctx.arc(-halfSize * 0.3, -halfSize * 0.9, 5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
  ctx.fill();

  // Camera body (main housing)
  drawRoundRect(ctx, -halfSize * 0.65, -halfSize * 0.45, halfSize * 1.3, halfSize * 0.9, 5);
  ctx.fillStyle = 'rgba(30, 41, 59, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 1)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Lens housing (cone/cylinder)
  ctx.beginPath();
  ctx.moveTo(halfSize * 0.65, -halfSize * 0.35);
  ctx.lineTo(halfSize * 0.95, -halfSize * 0.25);
  ctx.lineTo(halfSize * 0.95, halfSize * 0.25);
  ctx.lineTo(halfSize * 0.65, halfSize * 0.35);
  ctx.closePath();
  ctx.fillStyle = 'rgba(51, 65, 85, 0.95)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Lens (glowing circle)
  const lensGlow = 0.7 + Math.sin(time * 0.005 + camera.id) * 0.2;
  ctx.beginPath();
  ctx.arc(halfSize * 0.9, 0, halfSize * 0.18, 0, Math.PI * 2);
  const lensGradient = ctx.createRadialGradient(
    halfSize * 0.9, 0, 0,
    halfSize * 0.9, 0, halfSize * 0.22
  );
  lensGradient.addColorStop(0, `rgba(59, 130, 246, ${lensGlow})`);
  lensGradient.addColorStop(0.6, 'rgba(99, 102, 241, 0.9)');
  lensGradient.addColorStop(1, 'rgba(99, 102, 241, 0.5)');
  ctx.fillStyle = lensGradient;
  ctx.fill();

  // Lens highlight
  ctx.beginPath();
  ctx.arc(halfSize * 0.86, -halfSize * 0.06, halfSize * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fill();

  // Status LED (red recording indicator)
  const ledBlink = (Math.sin(time * 0.01 + camera.id * 2) + 1) / 2;
  ctx.beginPath();
  ctx.arc(-halfSize * 0.45, -halfSize * 0.28, 3, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(239, 68, 68, ${0.6 + ledBlink * 0.4})`;
  ctx.fill();

  // LED glow
  if (ledBlink > 0.6) {
    ctx.beginPath();
    ctx.arc(-halfSize * 0.45, -halfSize * 0.28, 6, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(239, 68, 68, ${(ledBlink - 0.6) * 0.6})`;
    ctx.fill();
  }

  ctx.restore();
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

const AnimatedNetworkBackground = forwardRef<AnimatedNetworkBackgroundRef, object>(
  (_, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const animationRef = useRef<number>();
    
    // Animation state stored in refs for performance
    const modeRef = useRef<AnimationMode>('idle');
    const camerasRef = useRef<Camera[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const targetRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const lastCameraTimeRef = useRef(0);
    const burstStartTimeRef = useRef<number | null>(null);
    const revertStartTimeRef = useRef<number | null>(null);
    const lastTypingTimeRef = useRef(0);
    const typingStartedRef = useRef(false);

    // Initialize particles
    const initParticles = useCallback((width: number, height: number) => {
      const particles: Particle[] = [];
      const count = 100;
      
      for (let i = 0; i < count; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        particles.push({
          id: i,
          x,
          y,
          originX: x,
          originY: y,
          vx: (Math.random() - 0.5) * 0.5,
          vy: (Math.random() - 0.5) * 0.5,
          size: Math.random() * 2 + 1,
          opacity: 1,
          assignedToCamera: null,
          cameraPointIndex: 0,
          isActive: true,
        });
      }
      particlesRef.current = particles;
    }, []);

    // Create a new camera
    const createCamera = useCallback((index: number): Camera => {
      const target = targetRef.current;
      const angleOffset = (index / MAX_CAMERAS) * Math.PI * 2 + Math.random() * 0.3;
      const radius = CAMERA_CLUSTER_RADIUS + (Math.random() - 0.5) * 80;
      
      const camX = target.x + Math.cos(angleOffset) * radius;
      const camY = target.y + Math.sin(angleOffset) * radius;
      const pointingAngle = angleBetween(camX, camY, target.x, target.y);

      return {
        id: index,
        x: camX,
        y: camY,
        angle: pointingAngle,
        scale: 0,
        opacity: 0,
        particles: [],
        isFormed: false,
        jitterX: 0,
        jitterY: 0,
        glowIntensity: 0,
      };
    }, []);

    // Assign particles to a camera
    const assignParticlesToCamera = useCallback((camera: Camera) => {
      const particles = particlesRef.current;
      const available = particles.filter(p => p.assignedToCamera === null && p.isActive);
      
      available.sort((a, b) => {
        return distance(a.x, a.y, camera.x, camera.y) - distance(b.x, b.y, camera.x, camera.y);
      });

      const toAssign = available.slice(0, PARTICLES_PER_CAMERA);
      toAssign.forEach((particle, idx) => {
        particle.assignedToCamera = camera.id;
        particle.cameraPointIndex = idx;
      });
      camera.particles = toAssign;
    }, []);

    // Trigger burst effect
    const triggerBurst = useCallback(() => {
      burstStartTimeRef.current = performance.now();
      modeRef.current = 'reverting';
      revertStartTimeRef.current = performance.now() + BURST_DURATION;

      const target = targetRef.current;
      camerasRef.current.forEach(camera => {
        camera.particles.forEach(particle => {
          const angle = angleBetween(target.x, target.y, particle.x, particle.y);
          const speed = BURST_FORCE * (0.8 + Math.random() * 0.4);
          particle.vx = Math.cos(angle) * speed;
          particle.vy = Math.sin(angle) * speed;
        });
      });

      particlesRef.current.forEach(particle => {
        if (particle.assignedToCamera === null) {
          const dist = distance(particle.x, particle.y, target.x, target.y);
          if (dist < CAMERA_CLUSTER_RADIUS * 1.5) {
            const angle = angleBetween(target.x, target.y, particle.x, particle.y);
            const factor = 1 - dist / (CAMERA_CLUSTER_RADIUS * 1.5);
            particle.vx += Math.cos(angle) * BURST_FORCE * factor * 0.3;
            particle.vy += Math.sin(angle) * BURST_FORCE * factor * 0.3;
          }
        }
      });
    }, []);

    // Main animation loop
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const resizeCanvas = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (particlesRef.current.length === 0) {
          initParticles(canvas.width, canvas.height);
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);

      let prevTime = performance.now();

      const animate = (now: number) => {
        const deltaTime = now - prevTime;
        prevTime = now;
        const dt = deltaTime / 16.67;

        // Clear with trail
        ctx.fillStyle = 'rgba(10, 11, 16, 0.12)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const mode = modeRef.current;
        const cameras = camerasRef.current;
        const particles = particlesRef.current;
        const target = targetRef.current;

        // Form new cameras in watching mode
        if (mode === 'watching' && cameras.length < MAX_CAMERAS) {
          if (now - lastCameraTimeRef.current > CAMERA_FORM_INTERVAL) {
            const newCam = createCamera(cameras.length);
            assignParticlesToCamera(newCam);
            cameras.push(newCam);
            lastCameraTimeRef.current = now;
          }
        }

        // Update particles
        particles.forEach(particle => {
          if (mode === 'idle') {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            if (particle.x < 0) particle.x = canvas.width;
            if (particle.x > canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = canvas.height;
            if (particle.y > canvas.height) particle.y = 0;
            particle.opacity = lerp(particle.opacity, 1, 0.05);
          } else if (mode === 'watching') {
            if (particle.assignedToCamera !== null) {
              const cam = cameras.find(c => c.id === particle.assignedToCamera);
              if (cam) {
                const dx = cam.x - particle.x;
                const dy = cam.y - particle.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 2) {
                  particle.vx = (dx / dist) * FORMATION_SPEED;
                  particle.vy = (dy / dist) * FORMATION_SPEED;
                  particle.x += particle.vx * dt;
                  particle.y += particle.vy * dt;
                }
                if (cam.scale > 0.6) {
                  particle.opacity = lerp(particle.opacity, 0.2, 0.08);
                }
              }
            } else {
              particle.x += particle.vx * dt;
              particle.y += particle.vy * dt;
              if (particle.x < 0) particle.x = canvas.width;
              if (particle.x > canvas.width) particle.x = 0;
              if (particle.y < 0) particle.y = canvas.height;
              if (particle.y > canvas.height) particle.y = 0;
            }
          } else if (mode === 'reverting') {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vx *= 0.95;
            particle.vy *= 0.95;

            if (revertStartTimeRef.current) {
              const progress = (now - revertStartTimeRef.current) / REVERT_DURATION;
              if (progress > 0.3) {
                const force = 0.02 * easeInOutQuad(progress);
                particle.vx += (particle.originX - particle.x) * force;
                particle.vy += (particle.originY - particle.y) * force;
              }
              particle.opacity = lerp(particle.opacity, 1, 0.04);
              if (progress > 0.15) {
                particle.assignedToCamera = null;
                particle.isActive = true;
              }
            }

            if (particle.x < 0) particle.x = canvas.width;
            if (particle.x > canvas.width) particle.x = 0;
            if (particle.y < 0) particle.y = canvas.height;
            if (particle.y > canvas.height) particle.y = 0;
          }
        });

        // Update cameras
        cameras.forEach(camera => {
          if (mode === 'watching') {
            camera.scale = lerp(camera.scale, 1, 0.06);
            camera.opacity = lerp(camera.opacity, 1, 0.08);
            camera.glowIntensity = lerp(camera.glowIntensity, 1, 0.04);
            camera.jitterX = Math.sin(now * 0.003 + camera.id * 1.5) * 2;
            camera.jitterY = Math.cos(now * 0.004 + camera.id * 1.2) * 1.5;
            const targetAngle = angleBetween(camera.x, camera.y, target.x, target.y);
            camera.angle = lerp(camera.angle, targetAngle, 0.08);
            camera.isFormed = camera.scale > 0.8;
          } else if (mode === 'reverting' && burstStartTimeRef.current) {
            const burstProgress = (now - burstStartTimeRef.current) / BURST_DURATION;
            if (burstProgress < 1) {
              camera.scale = 1 + Math.sin(burstProgress * Math.PI) * 0.2;
              camera.opacity = 1 - easeOutCubic(burstProgress);
              camera.glowIntensity = 2 * (1 - burstProgress);
            } else {
              camera.scale = 0;
              camera.opacity = 0;
            }
          }
        });

        // Check for revert completion
        if (mode === 'reverting' && revertStartTimeRef.current) {
          const progress = (now - revertStartTimeRef.current) / REVERT_DURATION;
          if (progress >= 1) {
            modeRef.current = 'idle';
            camerasRef.current = [];
            burstStartTimeRef.current = null;
            revertStartTimeRef.current = null;
            lastCameraTimeRef.current = 0;
          }
        }

        // Draw particle connections and particles
        particles.forEach((particle, i) => {
          if (particle.opacity < 0.05) return;

          particles.slice(i + 1).forEach(other => {
            if (other.opacity < 0.05) return;
            const dist = distance(particle.x, particle.y, other.x, other.y);
            if (dist < CONNECTION_DISTANCE) {
              const alpha = (1 - dist / CONNECTION_DISTANCE) * 0.25 * 
                Math.min(particle.opacity, other.opacity);
              if (alpha > 0.01) {
                ctx.beginPath();
                ctx.moveTo(particle.x, particle.y);
                ctx.lineTo(other.x, other.y);
                ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
                ctx.lineWidth = 0.6;
                ctx.stroke();
              }
            }
          });

          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(99, 102, 241, ${0.7 * particle.opacity})`;
          ctx.fill();
        });

        // Draw cameras
        cameras.forEach(camera => {
          if (camera.scale > 0.01 && camera.opacity > 0.01) {
            drawCamera(ctx, camera, now);
          }
        });

        animationRef.current = requestAnimationFrame(animate);
      };

      animationRef.current = requestAnimationFrame(animate);

      // Idle timeout check
      const idleCheck = setInterval(() => {
        if (modeRef.current !== 'watching') return;
        if (!typingStartedRef.current) return;
        
        const timeSinceTyping = performance.now() - lastTypingTimeRef.current;
        if (timeSinceTyping > IDLE_TIMEOUT_BEFORE_BURST) {
          triggerBurst();
          typingStartedRef.current = false;
        }
      }, 100);

      return () => {
        window.removeEventListener('resize', resizeCanvas);
        if (animationRef.current) cancelAnimationFrame(animationRef.current);
        clearInterval(idleCheck);
      };
    }, [initParticles, createCamera, assignParticlesToCamera, triggerBurst]);

    // Public API
    const setMode = useCallback((mode: AnimationMode) => {
      const currentMode = modeRef.current;
      
      if (mode === 'watching' && currentMode === 'idle') {
        modeRef.current = 'watching';
        lastCameraTimeRef.current = 0;
        typingStartedRef.current = false;
      } else if (mode === 'reverting' && currentMode === 'watching') {
        triggerBurst();
      } else if (mode === 'idle' && currentMode === 'watching') {
        triggerBurst();
      }
    }, [triggerBurst]);

    const setTargetPosition = useCallback((x: number, y: number) => {
      targetRef.current = { x, y };
    }, []);

    const notifyTyping = useCallback(() => {
      lastTypingTimeRef.current = performance.now();
      typingStartedRef.current = true;
    }, []);

    useImperativeHandle(ref, () => ({
      setMode,
      setTargetPosition,
      notifyTyping,
    }), [setMode, setTargetPosition, notifyTyping]);

    return (
      <canvas
        ref={canvasRef}
        className="absolute inset-0 z-0"
        style={{ background: 'linear-gradient(to bottom, #0a0b10, #1a1b2e)' }}
      />
    );
  }
);

AnimatedNetworkBackground.displayName = 'AnimatedNetworkBackground';

export default AnimatedNetworkBackground;
