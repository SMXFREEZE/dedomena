"use client";

import { useEffect, useRef } from "react";

export function BackgroundLines() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const COUNT = 70;
    const MAX_DIST = 160;
    const SPEED = 0.35;

    let W = 0, H = 0;
    let animId: number;

    interface Particle {
      x: number; y: number;
      vx: number; vy: number;
      r: number;
    }

    let particles: Particle[] = [];

    function resize() {
      W = canvas!.width  = window.innerWidth;
      H = canvas!.height = window.innerHeight;
    }

    function mkParticle(): Particle {
      const angle = Math.random() * Math.PI * 2;
      const speed = SPEED * (0.4 + Math.random() * 0.8);
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: 1 + Math.random() * 1.5,
      };
    }

    function init() {
      resize();
      particles = Array.from({ length: COUNT }, mkParticle);
    }

    function step() {
      ctx!.clearRect(0, 0, W, H);

      for (const p of particles) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) { p.x = 0; p.vx *= -1; }
        if (p.x > W) { p.x = W; p.vx *= -1; }
        if (p.y < 0) { p.y = 0; p.vy *= -1; }
        if (p.y > H) { p.y = H; p.vy *= -1; }
      }

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > MAX_DIST) continue;
          const alpha = (1 - d / MAX_DIST) * 0.18;
          ctx!.beginPath();
          ctx!.moveTo(a.x, a.y);
          ctx!.lineTo(b.x, b.y);
          ctx!.strokeStyle = `rgba(100,160,255,${alpha})`;
          ctx!.lineWidth = 0.7;
          ctx!.stroke();
        }
      }

      for (const p of particles) {
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = "rgba(100,160,255,0.3)";
        ctx!.fill();
      }

      animId = requestAnimationFrame(step);
    }

    init();
    step();

    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
      }}
    />
  );
}
