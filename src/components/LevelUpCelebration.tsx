import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface LevelUpCelebrationEvent {
  id: number;
  newLevel: number;
  evolved: boolean;
  stageName: string;
  auraColor: string;
}

interface LevelUpCelebrationProps {
  event: LevelUpCelebrationEvent | null;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  vr: number;
  tilt: number;
  vtilt: number;
  alpha: number;
  shape: 'ribbon' | 'spark';
}

export function LevelUpCelebration({ event }: LevelUpCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!event) return;
    if (
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const palette = [
      '#FACC15',
      '#38BDF8',
      event.auraColor || '#FACC15',
      '#22C55E',
      '#F1F5F9',
    ];

    const particles: Particle[] = [];
    const spawnBurst = (
      originX: number,
      originY: number,
      count: number,
      angleMin: number,
      angleMax: number,
      speedMin: number,
      speedMax: number
    ) => {
      for (let i = 0; i < count; i++) {
        const angle = angleMin + Math.random() * (angleMax - angleMin);
        const speed = speedMin + Math.random() * (speedMax - speedMin);
        const isSpark = i % 3 === 0;
        particles.push({
          x: originX,
          y: originY,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          w: isSpark ? 4 + Math.random() * 4 : 6 + Math.random() * 6,
          h: isSpark ? 4 + Math.random() * 4 : 10 + Math.random() * 7,
          color: palette[Math.floor(Math.random() * palette.length)],
          rotation: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.22,
          tilt: Math.random() * Math.PI,
          vtilt: 0.08 + Math.random() * 0.12,
          alpha: 1,
          shape: isSpark ? 'spark' : 'ribbon',
        });
      }
    };

    // Center Ki burst + twin upper-side confetti cannons
    spawnBurst(width * 0.5, height * 0.42, 64, -Math.PI, Math.PI, 4, 13.5);
    spawnBurst(width * 0.14, height * 0.72, 34, -Math.PI * 0.48, -Math.PI * 0.18, 8, 16);
    spawnBurst(width * 0.86, height * 0.72, 34, -Math.PI * 0.82, -Math.PI * 0.52, 8, 16);

    let rafId = 0;
    const startedAt = performance.now();
    const durationMs = 3100;

    const tick = (now: number) => {
      const elapsed = now - startedAt;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      let alive = 0;
      for (const p of particles) {
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.28;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.vr;
        p.tilt += p.vtilt;

        if (elapsed > durationMs * 0.58) {
          p.alpha = Math.max(0, p.alpha - 0.024);
        }

        if (p.alpha <= 0.01 || p.y > window.innerHeight + 40) continue;
        alive++;

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);

        if (p.shape === 'spark') {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(0, 0, p.w * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.scale(1, Math.cos(p.tilt));
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.w * 0.5, -p.h * 0.5, p.w, p.h);
        }
        ctx.restore();
      }

      if (alive > 0 && elapsed < durationMs + 400) {
        rafId = window.requestAnimationFrame(tick);
      } else {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [event]);

  if (!event) return null;

  const content = (
    <div
      key={event.id}
      aria-hidden="true"
      className="fixed inset-0 z-[95] pointer-events-none overflow-hidden"
    >
      {/* Initial radial Ki energy flash */}
      <div
        className="absolute inset-0 levelup-flash"
        style={{
          background: `radial-gradient(circle at 50% 45%, rgba(250, 204, 21, 0.55), ${event.auraColor}33 42%, rgba(56, 189, 248, 0.14) 68%, transparent 85%)`,
        }}
      />

      {/* Expanding shockwave rings */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-56 h-56 rounded-full border-[3px] levelup-ring"
          style={{ borderColor: '#FACC15' }}
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div
          className="w-40 h-40 rounded-full border-2 levelup-ring-delayed"
          style={{ borderColor: event.auraColor || '#38BDF8' }}
        />
      </div>

      {/* Confetti & Ki sparks canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 block" />

      {/* Crisp top level-up callout banner */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 w-[92%] max-w-sm flex justify-center">
        <div
          className="levelup-banner px-5 py-2.5 rounded-2xl bg-[#07080B]/95 border text-center shadow-2xl"
          style={{ borderColor: '#FACC15' }}
        >
          <div className="text-[11px] font-extrabold tracking-wide text-[#38BDF8]">
            {event.evolved ? '⚡ ¡EVOLUCIÓN DESBLOQUEADA!' : '🔥 ¡KI INCREMENTADO!'}
          </div>
          <div className="text-lg font-black text-[#FACC15] tabular-nums font-[family-name:var(--font-display)]">
            ¡Subiste al Nivel {event.newLevel}!
          </div>
          {event.evolved && (
            <div className="text-xs font-bold text-[#F1F5F9] mt-0.5">
              {event.stageName}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return content;
}
