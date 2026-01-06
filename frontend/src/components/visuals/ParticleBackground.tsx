import { useEffect, useRef, useCallback } from 'react';

enum AnimationPhase {
    IDLE = 'IDLE',
    FORMING = 'FORMING',
    WATCHING = 'WATCHING',
    DISSOLVING_INSTANT = 'DISSOLVING_INSTANT',
    DISSOLVING_SLOW = 'DISSOLVING_SLOW',
    ALL_CONSUMED = 'ALL_CONSUMED'
}

enum PanicState {
    NORMAL = 'NORMAL',
    FLEEING = 'FLEEING',
    HIDING = 'HIDING',
    EXPLODING = 'EXPLODING',
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
    targetX: number;
    targetY: number;
    rotation: number;
    size: number;
    particles: number[];
    formationProgress: number;
    isPanic: boolean;
    panicState: PanicState;
    panicTimer: number;
    opacity: number;
    shakeOffset: { x: number; y: number };
    moveProgress: number;
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
const CAMERA_SPAWN_INTERVAL = 2500;
const PANIC_CHANCE = 0.15;
const PANIC_EXPLOSION_TIME = 3000;
const FORMATION_DURATION = 1500;
const DISSOLVE_INSTANT_DURATION = 1000;
const DISSOLVE_SLOW_DURATION = 7000;

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
    onCameraClick
}: Props) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const stateRef = useRef({
        phase: AnimationPhase.IDLE,
        particles: [] as Particle[],
        cameras: [] as Camera[],
        explosionParticles: [] as ExplosionParticle[],
        availableParticles: [] as number[],
        lastCameraSpawn: 0,
        typingStartTime: 0,
        dissolveStartTime: 0,
        hasPanicCamera: false,
        screenShake: { x: 0, y: 0, intensity: 0 },
        lastTime: 0,
        hoveredCameraId: null as number | null,
        flashOpacity: 0
    });

    const handleCanvasClick = useCallback((e: MouseEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const state = stateRef.current;

        for (const camera of state.cameras) {
            const dx = x - camera.x;
            const dy = y - camera.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < camera.size * 0.8) {
                if (camera.isPanic && camera.panicState !== PanicState.EXPLODED) {
                    camera.panicState = PanicState.EXPLODING;
                    camera.panicTimer = 0;
                } else {
                    triggerDissolution();
                }
                onCameraClick?.();
                break;
            }
        }
    }, [onCameraClick]);

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
                if (camera.isPanic && camera.panicState === PanicState.FLEEING) {
                    const fleeAngle = Math.atan2(camera.y - y, camera.x - x);
                    camera.vx = Math.cos(fleeAngle) * 3;
                    camera.vy = Math.sin(fleeAngle) * 3;
                }
                break;
            }
        }
    }, []);

    const triggerDissolution = useCallback(() => {
        const state = stateRef.current;
        if (state.phase === AnimationPhase.DISSOLVING_INSTANT ||
            state.phase === AnimationPhase.DISSOLVING_SLOW) return;

        state.phase = AnimationPhase.DISSOLVING_INSTANT;
        state.dissolveStartTime = performance.now();

        state.cameras.forEach(camera => {
            if (!camera.isPanic) {
                camera.particles.forEach(pId => {
                    const particle = state.particles.find(p => p.id === pId);
                    if (particle) {
                        particle.vx = (Math.random() - 0.5) * 4;
                        particle.vy = (Math.random() - 0.5) * 4;
                        particle.cameraId = null;
                        particle.interpolation = 0;
                        state.availableParticles.push(particle.id);
                    }
                });
            }
        });

        state.cameras = state.cameras.filter(c => c.isPanic);
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
                x,
                y,
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

        canvas.addEventListener('click', handleCanvasClick);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('touchstart', (e) => {
            const touch = e.touches[0];
            handleCanvasClick({ clientX: touch.clientX, clientY: touch.clientY } as MouseEvent);
        });

        window.addEventListener('resize', resizeCanvas);

        return () => {
            canvas.removeEventListener('click', handleCanvasClick);
            canvas.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('resize', resizeCanvas);
        };
    }, [handleCanvasClick, handleMouseMove]);

    useEffect(() => {
        const state = stateRef.current;

        if (isTyping && isPasswordFocused) {
            if (state.phase === AnimationPhase.IDLE ||
                state.phase === AnimationPhase.DISSOLVING_SLOW) {
                state.phase = AnimationPhase.FORMING;
                state.typingStartTime = performance.now();
                state.lastCameraSpawn = 0;
            }
        } else if (!isTyping && state.phase === AnimationPhase.FORMING) {
            state.phase = AnimationPhase.WATCHING;
        } else if (!isPasswordFocused && state.phase !== AnimationPhase.IDLE &&
                   state.phase !== AnimationPhase.DISSOLVING_INSTANT &&
                   state.phase !== AnimationPhase.DISSOLVING_SLOW) {
            if (state.cameras.length > 0) {
                triggerDissolution();
            } else {
                state.phase = AnimationPhase.IDLE;
            }
        }
    }, [isTyping, isPasswordFocused, triggerDissolution]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const state = stateRef.current;
        let animationFrameId: number;

        const getCameraTargetPositions = (
            cameraX: number,
            cameraY: number,
            size: number,
            rotation: number
        ): { x: number; y: number }[] => {
            const positions: { x: number; y: number }[] = [];
            const cos = Math.cos(rotation);
            const sin = Math.sin(rotation);

            const transform = (lx: number, ly: number) => ({
                x: cameraX + lx * cos - ly * sin,
                y: cameraY + lx * sin + ly * cos
            });

            const bodyW = size * 0.7;
            const bodyH = size * 0.5;
            positions.push(transform(-bodyW/2, -bodyH/2));
            positions.push(transform(bodyW/2, -bodyH/2));
            positions.push(transform(bodyW/2, bodyH/2));
            positions.push(transform(-bodyW/2, bodyH/2));

            const lensRadius = size * 0.2;
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                positions.push(transform(
                    bodyW/2 + lensRadius * 0.5 + Math.cos(angle) * lensRadius,
                    Math.sin(angle) * lensRadius
                ));
            }

            positions.push(transform(0, -bodyH/2 - size * 0.15));
            positions.push(transform(-size * 0.1, -bodyH/2 - size * 0.1));
            positions.push(transform(size * 0.1, -bodyH/2 - size * 0.1));
            positions.push(transform(0, -bodyH/2 - size * 0.05));

            return positions;
        };

        const spawnCamera = () => {
            if (state.availableParticles.length < PARTICLES_PER_CAMERA) return null;

            const cameraSize = getResponsiveCameraSize(window.innerWidth);
            const spawnAreaX = window.innerWidth * 0.6 + Math.random() * window.innerWidth * 0.35;
            const spawnAreaY = Math.random() * window.innerHeight * 0.4 + 50;

            const isPanic = !state.hasPanicCamera && Math.random() < PANIC_CHANCE;
            if (isPanic) state.hasPanicCamera = true;

            const camera: Camera = {
                id: Date.now() + Math.random(),
                x: spawnAreaX,
                y: spawnAreaY,
                targetX: passwordFieldPosition.x,
                targetY: passwordFieldPosition.y,
                rotation: 0,
                size: cameraSize,
                particles: [],
                formationProgress: 0,
                isPanic,
                panicState: PanicState.NORMAL,
                panicTimer: 0,
                opacity: 1,
                shakeOffset: { x: 0, y: 0 },
                moveProgress: 0
            };

            const angle = Math.atan2(
                passwordFieldPosition.y - camera.y,
                passwordFieldPosition.x - camera.x
            );
            camera.rotation = angle;

            const targetPositions = getCameraTargetPositions(
                camera.x, camera.y, camera.size, camera.rotation
            );

            for (let i = 0; i < PARTICLES_PER_CAMERA && state.availableParticles.length > 0; i++) {
                const pIndex = Math.floor(Math.random() * state.availableParticles.length);
                const pId = state.availableParticles.splice(pIndex, 1)[0];
                const particle = state.particles.find(p => p.id === pId);
                if (particle) {
                    particle.cameraId = camera.id;
                    particle.targetX = targetPositions[i % targetPositions.length].x;
                    particle.targetY = targetPositions[i % targetPositions.length].y;
                    particle.interpolation = 0;
                    camera.particles.push(pId);
                }
            }

            return camera;
        };

        const drawCamera = (camera: Camera) => {
            const { x, y, size, rotation, isPanic, panicState, opacity, shakeOffset, formationProgress } = camera;
            const isHovered = state.hoveredCameraId === camera.id;

            ctx.save();
            ctx.translate(x + shakeOffset.x, y + shakeOffset.y);
            ctx.rotate(rotation);

            let baseColor = 'rgba(99, 102, 241,';
            let glowColor = 'rgba(99, 102, 241, 0.3)';

            if (isPanic) {
                if (panicState === PanicState.EXPLODING) {
                    const pulse = Math.sin(performance.now() / 50) * 0.5 + 0.5;
                    baseColor = `rgba(${200 + pulse * 55}, ${50 - pulse * 50}, ${50 - pulse * 50},`;
                    glowColor = `rgba(255, 100, 100, ${0.5 + pulse * 0.3})`;
                } else if (panicState === PanicState.HIDING) {
                    baseColor = 'rgba(70, 70, 100,';
                } else if (panicState === PanicState.FLEEING) {
                    baseColor = 'rgba(150, 100, 200,';
                }
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
                ctx.roundRect(-bodyW/2, -bodyH/2, bodyW, bodyH, 4);
                ctx.fill();
                ctx.stroke();

                const lensRadius = size * 0.2;
                const lensX = bodyW/2 + lensRadius * 0.3;
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

                const vfW = size * 0.2;
                const vfH = size * 0.15;
                ctx.fillStyle = `${baseColor} ${0.2 * finalOpacity})`;
                ctx.strokeStyle = `${baseColor} ${0.7 * finalOpacity})`;
                ctx.beginPath();
                ctx.roundRect(-vfW/2, -bodyH/2 - vfH, vfW, vfH, 2);
                ctx.fill();
                ctx.stroke();

                ctx.strokeStyle = `${baseColor} ${0.4 * finalOpacity})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(-bodyW/2, -bodyH/2);
                ctx.lineTo(-bodyW/2 - 5, -bodyH/2 - 5);
                ctx.moveTo(bodyW/2, -bodyH/2);
                ctx.lineTo(bodyW/2 + 5, -bodyH/2 - 5);
                ctx.moveTo(-bodyW/2, bodyH/2);
                ctx.lineTo(-bodyW/2 - 5, bodyH/2 + 5);
                ctx.moveTo(bodyW/2, bodyH/2);
                ctx.lineTo(bodyW/2 + 5, bodyH/2 + 5);
                ctx.stroke();
            }

            ctx.restore();
        };

        const createExplosion = (camera: Camera) => {
            const particleCount = 30;
            for (let i = 0; i < particleCount; i++) {
                const angle = (i / particleCount) * Math.PI * 2 + Math.random() * 0.5;
                const speed = 3 + Math.random() * 5;
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
            state.flashOpacity = 0.8;
            state.hasPanicCamera = false;
        };

        const animate = (currentTime: number) => {
            const deltaTime = state.lastTime ? currentTime - state.lastTime : 16;
            state.lastTime = currentTime;

            const width = window.innerWidth;
            const height = window.innerHeight;

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

            ctx.fillStyle = 'rgba(10, 11, 16, 0.15)';
            ctx.fillRect(-10, -10, width + 20, height + 20);

            if (state.flashOpacity > 0) {
                ctx.fillStyle = `rgba(255, 200, 150, ${state.flashOpacity})`;
                ctx.fillRect(0, 0, width, height);
                state.flashOpacity *= 0.85;
            }

            if (state.phase === AnimationPhase.FORMING) {
                const timeSinceStart = currentTime - state.typingStartTime;
                const timeSinceLastSpawn = currentTime - state.lastCameraSpawn;

                if (timeSinceLastSpawn > CAMERA_SPAWN_INTERVAL || state.cameras.length === 0) {
                    const newCamera = spawnCamera();
                    if (newCamera) {
                        state.cameras.push(newCamera);
                        state.lastCameraSpawn = currentTime;
                    }

                    if (state.availableParticles.length < PARTICLES_PER_CAMERA) {
                        state.phase = AnimationPhase.ALL_CONSUMED;
                    }
                }
            }

            if (state.phase === AnimationPhase.DISSOLVING_INSTANT) {
                const elapsed = currentTime - state.dissolveStartTime;
                if (elapsed > DISSOLVE_INSTANT_DURATION) {
                    state.phase = AnimationPhase.DISSOLVING_SLOW;
                    state.dissolveStartTime = currentTime;
                }
            }

            if (state.phase === AnimationPhase.DISSOLVING_SLOW) {
                const elapsed = currentTime - state.dissolveStartTime;
                const progress = Math.min(elapsed / DISSOLVE_SLOW_DURATION, 1);

                state.particles.forEach(p => {
                    if (p.cameraId === null) {
                        p.vx *= 0.995;
                        p.vy *= 0.995;
                        p.vx += (Math.random() - 0.5) * 0.02;
                        p.vy += (Math.random() - 0.5) * 0.02;
                    }
                });

                if (progress >= 1) {
                    state.phase = AnimationPhase.IDLE;
                    state.cameras = [];
                }
            }

            state.cameras.forEach(camera => {
                if (camera.formationProgress < 1) {
                    camera.formationProgress += deltaTime / FORMATION_DURATION;
                    camera.formationProgress = Math.min(camera.formationProgress, 1);
                }

                if (camera.isPanic && camera.formationProgress >= 1) {
                    if (camera.panicState === PanicState.NORMAL) {
                        camera.panicState = PanicState.FLEEING;
                    }

                    if (camera.panicState === PanicState.FLEEING) {
                        camera.panicTimer += deltaTime;

                        camera.shakeOffset.x = (Math.random() - 0.5) * 8;
                        camera.shakeOffset.y = (Math.random() - 0.5) * 8;

                        const fleeAngle = Math.atan2(
                            camera.y - passwordFieldPosition.y,
                            camera.x - passwordFieldPosition.x
                        ) + (Math.random() - 0.5) * 0.5;

                        camera.x += Math.cos(fleeAngle) * 2;
                        camera.y += Math.sin(fleeAngle) * 2;

                        camera.rotation += (Math.random() - 0.5) * 0.2;

                        if (camera.panicTimer > 1500) {
                            camera.panicState = PanicState.HIDING;
                            camera.panicTimer = 0;

                            const corners = [
                                { x: 50, y: 50 },
                                { x: width - 50, y: 50 },
                                { x: 50, y: height - 50 },
                                { x: width - 50, y: height - 50 }
                            ];
                            const farthest = corners.reduce((best, corner) => {
                                const dist = Math.sqrt(
                                    Math.pow(corner.x - passwordFieldPosition.x, 2) +
                                    Math.pow(corner.y - passwordFieldPosition.y, 2)
                                );
                                return dist > best.dist ? { corner, dist } : best;
                            }, { corner: corners[0], dist: 0 });

                            camera.targetX = farthest.corner.x;
                            camera.targetY = farthest.corner.y;
                        }
                    }

                    if (camera.panicState === PanicState.HIDING) {
                        camera.panicTimer += deltaTime;

                        camera.x += (camera.targetX - camera.x) * 0.05;
                        camera.y += (camera.targetY - camera.y) * 0.05;

                        camera.opacity = 0.3 + Math.sin(camera.panicTimer / 200) * 0.1;
                        camera.shakeOffset.x = (Math.random() - 0.5) * 3;
                        camera.shakeOffset.y = (Math.random() - 0.5) * 3;

                        if (camera.panicTimer > PANIC_EXPLOSION_TIME) {
                            camera.panicState = PanicState.EXPLODING;
                            camera.panicTimer = 0;
                        }
                    }

                    if (camera.panicState === PanicState.EXPLODING) {
                        camera.panicTimer += deltaTime;

                        camera.shakeOffset.x = (Math.random() - 0.5) * 15;
                        camera.shakeOffset.y = (Math.random() - 0.5) * 15;
                        camera.opacity = 0.5 + Math.sin(camera.panicTimer / 30) * 0.5;

                        if (camera.panicTimer > 500) {
                            createExplosion(camera);
                            camera.panicState = PanicState.EXPLODED;
                        }
                    }
                } else if (!camera.isPanic && camera.formationProgress >= 1) {
                    if (camera.moveProgress < 1) {
                        camera.moveProgress += deltaTime / 3000;
                        camera.moveProgress = Math.min(camera.moveProgress, 1);

                        const easedProgress = easeInOutCubic(camera.moveProgress);
                        const moveDistance = 0.3;

                        const dirX = passwordFieldPosition.x - camera.x;
                        const dirY = passwordFieldPosition.y - camera.y;
                        const dist = Math.sqrt(dirX * dirX + dirY * dirY);

                        if (dist > camera.size * 2) {
                            camera.x += (dirX / dist) * easedProgress * moveDistance;
                            camera.y += (dirY / dist) * easedProgress * moveDistance;
                        }
                    }

                    const targetAngle = Math.atan2(
                        passwordFieldPosition.y - camera.y,
                        passwordFieldPosition.x - camera.x
                    );
                    camera.rotation += (targetAngle - camera.rotation) * 0.05;

                    camera.shakeOffset.x = Math.sin(currentTime / 500 + camera.id) * 0.5;
                    camera.shakeOffset.y = Math.cos(currentTime / 400 + camera.id) * 0.5;
                }

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
                        particle.x = lerp(particle.x, particle.targetX, eased * 0.1);
                        particle.y = lerp(particle.y, particle.targetY, eased * 0.1);
                    }
                });
            });

            state.cameras = state.cameras.filter(c => c.panicState !== PanicState.EXPLODED);

            state.particles.forEach((particle, i) => {
                if (particle.cameraId === null) {
                    particle.x += particle.vx;
                    particle.y += particle.vy;

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

                if (particle.cameraId === null && state.phase !== AnimationPhase.ALL_CONSUMED) {
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

            state.cameras.forEach(camera => {
                if (camera.formationProgress > 0.1) {
                    drawCamera(camera);
                }
            });

            state.explosionParticles.forEach((ep, idx) => {
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

        return () => {
            cancelAnimationFrame(animationFrameId);
        };
    }, [passwordFieldPosition, triggerDissolution]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-0 cursor-pointer"
            style={{ background: 'linear-gradient(to bottom, #0a0b10, #1a1b2e)' }}
        />
    );
}
