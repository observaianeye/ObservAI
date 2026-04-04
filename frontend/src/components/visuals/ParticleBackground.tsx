import { useEffect, useRef, useCallback } from 'react';

enum AnimationPhase {
    IDLE = 'IDLE',
    SPAWNING = 'SPAWNING',
    APPROACHING = 'APPROACHING',
    SCATTERING = 'SCATTERING',
    LONE_CAMERA = 'LONE_CAMERA',
    GLITCHING = 'GLITCHING',
    EXPLODED = 'EXPLODED'
}

interface Particle {
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    originalX: number;
    originalY: number;
    targetX: number;
    targetY: number;
    cameraId: number | null;
    interpolation: number;
}

interface Camera {
    id: number;
    x: number;
    y: number;
    startX: number;
    startY: number;
    rotation: number;
    size: number;
    particles: number[];
    formationProgress: number;
    opacity: number;
    shakeOffset: { x: number; y: number };
    moveProgress: number;
    isLoneSurvivor: boolean;
    scatterAngle: number;
    scatterSpeed: number;
    fanOffset: number; // angular offset for fan spread
}

interface ExplosionParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    size: number;
    opacity: number;
    color: string;
    life: number;
}

interface Props {
    isPasswordFocused?: boolean;
    isTyping?: boolean;
    passwordFieldPosition?: { x: number; y: number };
    onCameraClick?: () => void;
}

const PARTICLES_PER_CAMERA = 12;
const CAMERA_COUNT = 4;
const FORMATION_DURATION = 1200;

function easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function lerp(start: number, end: number, t: number): number {
    return start + (end - start) * t;
}

function getResponsiveCameraSize(width: number): number {
    if (width < 480) return 40;
    if (width < 768) return 55;
    if (width < 1024) return 70;
    return 80;
}

export default function ParticleBackground({
    isPasswordFocused = false,
    isTyping = false,
    passwordFieldPosition = { x: 0, y: 0 },
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef({
        phase: AnimationPhase.IDLE,
        particles: [] as Particle[],
        cameras: [] as Camera[],
        explosionParticles: [] as ExplosionParticle[],
        availableParticles: [] as number[],
        typingStartTime: 0,
        screenShake: { x: 0, y: 0, intensity: 0 },
        lastTime: 0,
        hoveredCameraId: null as number | null,
        flashOpacity: 0,
        glitchStartTime: 0,
        scatterStartTime: 0,
        wasTyping: false,
        spawnPoint: { x: 0, y: 0 },
    });

    const handleMouseMove = useCallback((e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const state = stateRef.current;

        state.hoveredCameraId = null;
        for (const camera of state.cameras) {
            const dx = x - camera.x;
            const dy = y - camera.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < camera.size * 0.8) {
                state.hoveredCameraId = camera.id;

                // Trigger glitch on lone camera hover
                if (camera.isLoneSurvivor && state.phase === AnimationPhase.LONE_CAMERA) {
                    state.phase = AnimationPhase.GLITCHING;
                    state.glitchStartTime = performance.now();
                }
                break;
            }
        }
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const state = stateRef.current;

        const resizeCanvas = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;
            ctx.scale(dpr, dpr);
        };
        resizeCanvas();

        const particleCount = Math.min(120, Math.floor(window.innerWidth * window.innerHeight / 15000));
        state.particles = [];
        state.availableParticles = [];

        for (let i = 0; i < particleCount; i++) {
            const x = Math.random() * window.innerWidth;
            const y = Math.random() * window.innerHeight;
            state.particles.push({
                id: i,
                x, y,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 1,
                originalX: x,
                originalY: y,
                targetX: x,
                targetY: y,
                cameraId: null,
                interpolation: 0
            });
            state.availableParticles.push(i);
        }

        canvas.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('resize', resizeCanvas);

        return () => {
            canvas.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [handleMouseMove]);

    // Phase transitions based on typing state
    useEffect(() => {
        const state = stateRef.current;

        if (isTyping && isPasswordFocused) {
            if (state.phase === AnimationPhase.IDLE || state.phase === AnimationPhase.EXPLODED) {
                // Start spawning cameras
                state.phase = AnimationPhase.SPAWNING;
                state.typingStartTime = performance.now();
                spawnCameraBatch();
            } else if (state.phase === AnimationPhase.SPAWNING || state.phase === AnimationPhase.APPROACHING) {
                // Continue approaching
                state.phase = AnimationPhase.APPROACHING;
            } else if (state.phase === AnimationPhase.LONE_CAMERA || state.phase === AnimationPhase.SCATTERING) {
                // User resumed typing - respawn
                state.phase = AnimationPhase.SPAWNING;
                state.typingStartTime = performance.now();
                spawnCameraBatch();
            }
            state.wasTyping = true;
        } else if (state.wasTyping && !isTyping) {
            // User stopped typing
            if (state.phase === AnimationPhase.APPROACHING || state.phase === AnimationPhase.SPAWNING) {
                startScatter();
            }
            state.wasTyping = false;
        }

        if (!isPasswordFocused && state.phase !== AnimationPhase.IDLE && state.phase !== AnimationPhase.EXPLODED) {
            // Password field lost focus - clean up everything
            startScatter();
            state.wasTyping = false;
        }
    }, [isTyping, isPasswordFocused]);

    function getSpawnPoint(): { x: number; y: number } {
        const w = window.innerWidth;
        const h = window.innerHeight;
        // Form is centered, max-w-md (~448px). Spawn outside form area.
        // Choose randomly from: top-right, top-left, right-center
        const spots = [
            { x: w * 0.82, y: h * 0.22 },  // top-right
            { x: w * 0.15, y: h * 0.2 },    // top-left
            { x: w * 0.85, y: h * 0.5 },    // right-center
        ];
        const spot = spots[Math.floor(Math.random() * spots.length)];
        return spot;
    }

    function spawnCameraBatch() {
        const state = stateRef.current;

        // Release any existing cameras
        state.cameras.forEach(camera => {
            camera.particles.forEach(pId => {
                const particle = state.particles.find(p => p.id === pId);
                if (particle) {
                    particle.cameraId = null;
                    particle.interpolation = 0;
                    state.availableParticles.push(particle.id);
                }
            });
        });
        state.cameras = [];

        const spawnPt = getSpawnPoint();
        state.spawnPoint = spawnPt;
        const cameraSize = getResponsiveCameraSize(window.innerWidth);
        const count = Math.min(CAMERA_COUNT, Math.floor(state.availableParticles.length / PARTICLES_PER_CAMERA));

        for (let i = 0; i < count; i++) {
            if (state.availableParticles.length < PARTICLES_PER_CAMERA) break;

            const fanAngle = ((i - (count - 1) / 2) / Math.max(count - 1, 1)) * 0.6;

            const camera: Camera = {
                id: Date.now() + i + Math.random(),
                x: spawnPt.x + (Math.random() - 0.5) * 10,
                y: spawnPt.y + (Math.random() - 0.5) * 10,
                startX: spawnPt.x,
                startY: spawnPt.y,
                rotation: 0,
                size: cameraSize * (0.9 + Math.random() * 0.2),
                particles: [],
                formationProgress: 0,
                opacity: 1,
                shakeOffset: { x: 0, y: 0 },
                moveProgress: 0,
                isLoneSurvivor: false,
                scatterAngle: 0,
                scatterSpeed: 0,
                fanOffset: fanAngle,
            };

            const angle = Math.atan2(
                passwordFieldPosition.y - camera.y,
                passwordFieldPosition.x - camera.x
            );
            camera.rotation = angle;

            const targetPositions = getCameraTargetPositions(
                camera.x, camera.y, camera.size, camera.rotation
            );

            for (let j = 0; j < PARTICLES_PER_CAMERA && state.availableParticles.length > 0; j++) {
                const pIndex = Math.floor(Math.random() * state.availableParticles.length);
                const pId = state.availableParticles.splice(pIndex, 1)[0];
                const particle = state.particles.find(p => p.id === pId);
                if (particle) {
                    particle.cameraId = camera.id;
                    particle.targetX = targetPositions[j % targetPositions.length].x;
                    particle.targetY = targetPositions[j % targetPositions.length].y;
                    particle.interpolation = 0;
                    camera.particles.push(pId);
                }
            }

            state.cameras.push(camera);
        }
    }

    function startScatter() {
        const state = stateRef.current;
        if (state.cameras.length === 0) {
            state.phase = AnimationPhase.IDLE;
            return;
        }

        state.phase = AnimationPhase.SCATTERING;
        state.scatterStartTime = performance.now();

        // Pick one random camera as lone survivor
        const survivorIdx = Math.floor(Math.random() * state.cameras.length);

        state.cameras.forEach((camera, i) => {
            if (i === survivorIdx) {
                camera.isLoneSurvivor = true;
                camera.scatterAngle = 0;
                camera.scatterSpeed = 0;
            } else {
                camera.isLoneSurvivor = false;
                camera.scatterAngle = Math.random() * Math.PI * 2;
                camera.scatterSpeed = 8 + Math.random() * 4;
            }
        });
    }

    function getCameraTargetPositions(
        cameraX: number,
        cameraY: number,
        size: number,
        rotation: number
    ): { x: number; y: number }[] {
        const positions: { x: number; y: number }[] = [];
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);

        const transform = (lx: number, ly: number) => ({
            x: cameraX + lx * cos - ly * sin,
            y: cameraY + lx * sin + ly * cos
        });

        const bodyW = size * 0.7;
        const bodyH = size * 0.5;
        positions.push(transform(-bodyW / 2, -bodyH / 2));
        positions.push(transform(bodyW / 2, -bodyH / 2));
        positions.push(transform(bodyW / 2, bodyH / 2));
        positions.push(transform(-bodyW / 2, bodyH / 2));

        const lensRadius = size * 0.2;
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2;
            positions.push(transform(
                bodyW / 2 + lensRadius * 0.5 + Math.cos(angle) * lensRadius,
                Math.sin(angle) * lensRadius
            ));
        }

        positions.push(transform(0, -bodyH / 2 - size * 0.15));
        positions.push(transform(-size * 0.1, -bodyH / 2 - size * 0.1));
        positions.push(transform(size * 0.1, -bodyH / 2 - size * 0.1));
        positions.push(transform(0, -bodyH / 2 - size * 0.05));

        return positions;
    }

    // Main animation loop
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const state = stateRef.current;
        let animationFrameId: number;

        const drawCamera = (camera: Camera, currentTime: number) => {
            const { x, y, size, rotation, opacity, shakeOffset, formationProgress, isLoneSurvivor } = camera;
            const isHovered = state.hoveredCameraId === camera.id;
            const isGlitching = state.phase === AnimationPhase.GLITCHING && isLoneSurvivor;

            ctx.save();
            ctx.translate(x + shakeOffset.x, y + shakeOffset.y);
            ctx.rotate(rotation);

            let baseColor = 'rgba(99, 102, 241,';
            let glowColor = 'rgba(99, 102, 241, 0.3)';

            if (isGlitching) {
                const glitchElapsed = currentTime - state.glitchStartTime;
                const pulse = Math.sin(glitchElapsed / 30) > 0;
                if (pulse) {
                    baseColor = 'rgba(239, 68, 68,';
                    glowColor = 'rgba(239, 68, 68, 0.5)';
                } else {
                    baseColor = 'rgba(99, 102, 241,';
                    glowColor = 'rgba(99, 102, 241, 0.5)';
                }
            } else if (isLoneSurvivor && state.phase === AnimationPhase.LONE_CAMERA) {
                // Confused look - slightly desaturated
                baseColor = 'rgba(130, 130, 200,';
                glowColor = 'rgba(130, 130, 200, 0.2)';
            }

            const finalOpacity = opacity * formationProgress * (isHovered ? 1.2 : 1);

            if (formationProgress > 0.3) {
                ctx.shadowColor = glowColor;
                ctx.shadowBlur = isHovered ? 25 : 15;

                const bodyW = size * 0.7;
                const bodyH = size * 0.5;
                ctx.fillStyle = `${baseColor} ${0.15 * finalOpacity})`;
                ctx.strokeStyle = `${baseColor} ${0.8 * finalOpacity})`;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.roundRect(-bodyW / 2, -bodyH / 2, bodyW, bodyH, 4);
                ctx.fill();
                ctx.stroke();

                const lensRadius = size * 0.2;
                const lensX = bodyW / 2 + lensRadius * 0.3;
                ctx.beginPath();
                ctx.arc(lensX, 0, lensRadius, 0, Math.PI * 2);
                ctx.fillStyle = `${baseColor} ${0.3 * finalOpacity})`;
                ctx.fill();
                ctx.strokeStyle = `${baseColor} ${0.9 * finalOpacity})`;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(lensX, 0, lensRadius * 0.5, 0, Math.PI * 2);
                ctx.fillStyle = `${baseColor} ${0.6 * finalOpacity})`;
                ctx.fill();

                // Mounting bracket
                const vfW = size * 0.2;
                const vfH = size * 0.15;
                ctx.fillStyle = `${baseColor} ${0.2 * finalOpacity})`;
                ctx.strokeStyle = `${baseColor} ${0.7 * finalOpacity})`;
                ctx.beginPath();
                ctx.roundRect(-vfW / 2, -bodyH / 2 - vfH, vfW, vfH, 2);
                ctx.fill();
                ctx.stroke();

                // Corner details
                ctx.strokeStyle = `${baseColor} ${0.4 * finalOpacity})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-bodyW / 2, -bodyH / 2);
                ctx.lineTo(-bodyW / 2 - 5, -bodyH / 2 - 5);
                ctx.moveTo(bodyW / 2, -bodyH / 2);
                ctx.lineTo(bodyW / 2 + 5, -bodyH / 2 - 5);
                ctx.moveTo(-bodyW / 2, bodyH / 2);
                ctx.lineTo(-bodyW / 2 - 5, bodyH / 2 + 5);
                ctx.moveTo(bodyW / 2, bodyH / 2);
                ctx.lineTo(bodyW / 2 + 5, bodyH / 2 + 5);
                ctx.stroke();

                // Question mark for lone confused camera
                if (isLoneSurvivor && state.phase === AnimationPhase.LONE_CAMERA) {
                    const qAlpha = 0.4 + Math.sin(currentTime / 600) * 0.3;
                    ctx.save();
                    ctx.rotate(-rotation); // Undo camera rotation for upright text
                    ctx.font = `bold ${size * 0.35}px monospace`;
                    ctx.fillStyle = `rgba(200, 200, 255, ${qAlpha})`;
                    ctx.textAlign = 'center';
                    ctx.fillText('?', 0, -bodyH / 2 - size * 0.3);
                    ctx.restore();
                }
            }

            ctx.restore();
        };

        const createExplosion = (camera: Camera) => {
            const particleCount = 35;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
                const speed = 3 + Math.random() * 6;
                state.explosionParticles.push({
                    x: camera.x,
                    y: camera.y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    size: 2 + Math.random() * 4,
                    opacity: 1,
                    color: Math.random() > 0.5 ? '#ff6b6b' : '#ffa500',
                    life: 1
                });
            }

            camera.particles.forEach(pId => {
                const particle = state.particles.find(p => p.id === pId);
                if (particle) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 4;
                    particle.vx = Math.cos(angle) * speed;
                    particle.vy = Math.sin(angle) * speed;
                    particle.cameraId = null;
                    particle.interpolation = 0;
                    state.availableParticles.push(particle.id);
                }
            });

            state.screenShake.intensity = 15;
            state.flashOpacity = 0.6;
        };

        const animate = (currentTime: number) => {
            const deltaTime = state.lastTime ? currentTime - state.lastTime : 16;
            state.lastTime = currentTime;

            const width = window.innerWidth;
            const height = window.innerHeight;

            // Screen shake decay
            if (state.screenShake.intensity > 0) {
                state.screenShake.x = (Math.random() - 0.5) * state.screenShake.intensity;
                state.screenShake.y = (Math.random() - 0.5) * state.screenShake.intensity;
                state.screenShake.intensity *= 0.9;
                if (state.screenShake.intensity < 0.5) {
                    state.screenShake.intensity = 0;
                    state.screenShake.x = 0;
                    state.screenShake.y = 0;
                }
            }

            ctx.save();
            ctx.translate(state.screenShake.x, state.screenShake.y);

            // Clear
            ctx.fillStyle = 'rgba(10, 11, 16, 0.15)';
            ctx.fillRect(-10, -10, width + 20, height + 20);

            // Flash effect
            if (state.flashOpacity > 0) {
                ctx.fillStyle = `rgba(255, 200, 150, ${state.flashOpacity})`;
                ctx.fillRect(0, 0, width, height);
                state.flashOpacity *= 0.85;
            }

            // === PHASE: SPAWNING ===
            if (state.phase === AnimationPhase.SPAWNING) {
                // Formation in progress
                let allFormed = true;
                state.cameras.forEach(camera => {
                    if (camera.formationProgress < 1) {
                        camera.formationProgress += deltaTime / FORMATION_DURATION;
                        camera.formationProgress = Math.min(camera.formationProgress, 1);
                        allFormed = false;
                    }
                });
                if (allFormed && state.cameras.length > 0) {
                    state.phase = AnimationPhase.APPROACHING;
                }
            }

            // === PHASE: APPROACHING ===
            if (state.phase === AnimationPhase.APPROACHING) {
                state.cameras.forEach(camera => {
                    // Formation continues
                    if (camera.formationProgress < 1) {
                        camera.formationProgress += deltaTime / FORMATION_DURATION;
                        camera.formationProgress = Math.min(camera.formationProgress, 1);
                    }

                    // Fan separation: cameras spread apart
                    const fanSpreadX = Math.sin(camera.fanOffset) * 40;
                    const fanSpreadY = Math.cos(camera.fanOffset) * 25;

                    // Move toward password field slowly
                    camera.moveProgress += deltaTime / 8000;
                    camera.moveProgress = Math.min(camera.moveProgress, 0.7);

                    const easedProgress = easeInOutCubic(camera.moveProgress);
                    const targetX = passwordFieldPosition.x + fanSpreadX;
                    const targetY = passwordFieldPosition.y + fanSpreadY;

                    camera.x = lerp(camera.startX + fanSpreadX, targetX, easedProgress);
                    camera.y = lerp(camera.startY + fanSpreadY, targetY, easedProgress);

                    // Rotation tracks password field + extra lean
                    const targetAngle = Math.atan2(
                        passwordFieldPosition.y - camera.y,
                        passwordFieldPosition.x - camera.x
                    ) + 0.15; // extra lean toward password
                    camera.rotation += (targetAngle - camera.rotation) * 0.06;

                    // Subtle breathing movement
                    camera.shakeOffset.x = Math.sin(currentTime / 500 + camera.id) * 0.8;
                    camera.shakeOffset.y = Math.cos(currentTime / 400 + camera.id) * 0.6;
                });
            }

            // === PHASE: SCATTERING ===
            if (state.phase === AnimationPhase.SCATTERING) {
                const scatterElapsed = currentTime - state.scatterStartTime;
                let allScattered = true;

                state.cameras.forEach(camera => {
                    if (camera.isLoneSurvivor) {
                        // Lone camera stays, don't scatter
                        allScattered = false; // keep phase until non-survivors are gone
                        return;
                    }

                    // Flee in scatter direction
                    camera.x += Math.cos(camera.scatterAngle) * camera.scatterSpeed;
                    camera.y += Math.sin(camera.scatterAngle) * camera.scatterSpeed;

                    // Fade out over 1 second
                    camera.opacity = Math.max(0, 1 - scatterElapsed / 1000);
                    camera.rotation += 0.1; // spin while fleeing

                    if (camera.opacity <= 0) {
                        // Release particles
                        camera.particles.forEach(pId => {
                            const particle = state.particles.find(p => p.id === pId);
                            if (particle) {
                                particle.cameraId = null;
                                particle.interpolation = 0;
                                particle.vx = (Math.random() - 0.5) * 2;
                                particle.vy = (Math.random() - 0.5) * 2;
                                state.availableParticles.push(particle.id);
                            }
                        });
                        camera.particles = [];
                    }
                });

                // Remove fully faded cameras (keep lone survivor)
                state.cameras = state.cameras.filter(c => c.isLoneSurvivor || c.opacity > 0);

                // Check if scatter is done (only lone survivor remains)
                const nonSurvivors = state.cameras.filter(c => !c.isLoneSurvivor);
                if (nonSurvivors.length === 0 && state.cameras.length > 0) {
                    state.phase = AnimationPhase.LONE_CAMERA;
                } else if (state.cameras.length === 0) {
                    state.phase = AnimationPhase.IDLE;
                }
            }

            // === PHASE: LONE_CAMERA ===
            if (state.phase === AnimationPhase.LONE_CAMERA) {
                state.cameras.forEach(camera => {
                    if (!camera.isLoneSurvivor) return;

                    // Confused wobble
                    camera.rotation = Math.atan2(
                        passwordFieldPosition.y - camera.y,
                        passwordFieldPosition.x - camera.x
                    ) + Math.sin(currentTime / 800) * 0.2;

                    // Size pulse
                    const pulse = 1 + Math.sin(currentTime / 600) * 0.04;
                    camera.size = getResponsiveCameraSize(window.innerWidth) * pulse;

                    // Subtle nervous shake
                    camera.shakeOffset.x = Math.sin(currentTime / 200) * 1.5;
                    camera.shakeOffset.y = Math.cos(currentTime / 170) * 1.2;
                });
            }

            // === PHASE: GLITCHING ===
            if (state.phase === AnimationPhase.GLITCHING) {
                const glitchElapsed = currentTime - state.glitchStartTime;

                state.cameras.forEach(camera => {
                    if (!camera.isLoneSurvivor) return;

                    // Intense shake
                    camera.shakeOffset.x = (Math.random() - 0.5) * 15;
                    camera.shakeOffset.y = (Math.random() - 0.5) * 15;

                    // Color flicker handled in drawCamera
                });

                if (glitchElapsed > 400) {
                    // EXPLODE
                    const loneCam = state.cameras.find(c => c.isLoneSurvivor);
                    if (loneCam) {
                        createExplosion(loneCam);
                    }
                    state.cameras = [];
                    state.phase = AnimationPhase.EXPLODED;

                    // Auto-reset to idle after a moment
                    setTimeout(() => {
                        const s = stateRef.current;
                        if (s.phase === AnimationPhase.EXPLODED) {
                            s.phase = AnimationPhase.IDLE;
                        }
                    }, 2000);
                }
            }

            // === UPDATE CAMERA PARTICLES ===
            state.cameras.forEach(camera => {
                const targetPositions = getCameraTargetPositions(
                    camera.x, camera.y, camera.size, camera.rotation
                );

                camera.particles.forEach((pId, idx) => {
                    const particle = state.particles.find(p => p.id === pId);
                    if (particle) {
                        const targetPos = targetPositions[idx % targetPositions.length];
                        particle.targetX = targetPos.x + camera.shakeOffset.x;
                        particle.targetY = targetPos.y + camera.shakeOffset.y;

                        if (particle.interpolation < 1) {
                            particle.interpolation += deltaTime / FORMATION_DURATION;
                            particle.interpolation = Math.min(particle.interpolation, 1);
                        }

                        const eased = easeInOutCubic(particle.interpolation);
                        particle.x = lerp(particle.x, particle.targetX, eased * 0.12);
                        particle.y = lerp(particle.y, particle.targetY, eased * 0.12);
                    }
                });
            });

            // === DRAW PARTICLES ===
            state.particles.forEach((particle, i) => {
                if (particle.cameraId === null) {
                    particle.x += particle.vx;
                    particle.y += particle.vy;

                    // Slow down scattered particles
                    particle.vx *= 0.998;
                    particle.vy *= 0.998;

                    if (particle.x < 0) particle.x = width;
                    if (particle.x > width) particle.x = 0;
                    if (particle.y < 0) particle.y = height;
                    if (particle.y > height) particle.y = 0;
                }

                ctx.beginPath();
                ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                ctx.fillStyle = particle.cameraId !== null
                    ? 'rgba(99, 102, 241, 0.9)'
                    : 'rgba(99, 102, 241, 0.6)';
                ctx.fill();

                // Connection lines for free particles
                if (particle.cameraId === null) {
                    state.particles.slice(i + 1).forEach(other => {
                        if (other.cameraId !== null) return;
                        const dx = particle.x - other.x;
                        const dy = particle.y - other.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        if (distance < 150) {
                            ctx.beginPath();
                            ctx.moveTo(particle.x, particle.y);
                            ctx.lineTo(other.x, other.y);
                            ctx.strokeStyle = `rgba(99, 102, 241, ${0.2 * (1 - distance / 150)})`;
                            ctx.lineWidth = 0.5;
                            ctx.stroke();
                        }
                    });
                }
            });

            // === DRAW CAMERAS ===
            state.cameras.forEach(camera => {
                if (camera.formationProgress > 0.1 && camera.opacity > 0) {
                    drawCamera(camera, currentTime);
                }
            });

            // === DRAW EXPLOSION PARTICLES ===
            state.explosionParticles.forEach(ep => {
                ep.x += ep.vx;
                ep.y += ep.vy;
                ep.vy += 0.1;
                ep.life -= deltaTime / 2000;
                ep.opacity = ep.life;

                if (ep.life > 0) {
                    ctx.beginPath();
                    ctx.arc(ep.x, ep.y, ep.size * ep.life, 0, Math.PI * 2);
                    ctx.fillStyle = ep.color.replace(')', `, ${ep.opacity})`).replace('rgb', 'rgba');
                    ctx.fill();
                }
            });
            state.explosionParticles = state.explosionParticles.filter(ep => ep.life > 0);

            ctx.restore();
            animationFrameId = requestAnimationFrame(animate);
        };

        animationFrameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animationFrameId);
    }, [passwordFieldPosition]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0"
            style={{ background: 'linear-gradient(to bottom, #0a0b10, #1a1b2e)' }}
        />
    );
}
