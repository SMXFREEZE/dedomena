"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window { VANTA: any; THREE: any; }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement("script");
    s.src = src; s.onload = () => resolve(); s.onerror = reject;
    document.head.appendChild(s);
  });
}

const THREE_CDN  = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r134/three.min.js";
const FOG_CDN    = "https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.fog.min.js";
const CLOUDS_CDN = "https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js";

const FOG_CONFIG = {
  mouseControls: true, touchControls: true, gyroControls: false,
  minHeight: 200, minWidth: 200,
  baseColor:      0x020308,
  lowlightColor:  0x06091e,
  midtoneColor:   0x111e45,
  highlightColor: 0x1e3060,
  blurFactor: 0.78,
  speed:      0.70,
  zoom:       0.55,
};

const CLOUDS_CONFIG = {
  mouseControls: true, touchControls: true, gyroControls: false,
  minHeight: 200, minWidth: 200,
  skyColor:         0x04060f,
  cloudColor:       0x131028,
  cloudShadowColor: 0x020308,
  sunColor:         0x3b1200,
  sunlightColor:    0x150800,
  sunGlareColor:    0x1e0c00,
  speed: 0.55,
};

function isMorning() {
  const h = new Date().getHours();
  return h >= 6 && h < 18;
}

export type VantaMode = "night" | "morning" | "auto";

interface Props {
  mode?: VantaMode;
  className?: string;
}

export function VantaBackground({ mode = "auto", className = "" }: Props) {
  const vantaRef = useRef<HTMLDivElement>(null);
  const vantaFx  = useRef<any>(null);
  const [resolvedMode, setResolvedMode] = useState<"night" | "morning">("night");

  useEffect(() => {
    if (mode === "auto") {
      setResolvedMode(isMorning() ? "morning" : "night");
    } else {
      setResolvedMode(mode);
    }
  }, [mode]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        vantaFx.current?.destroy();
        vantaFx.current = null;

        await loadScript(THREE_CDN);

        if (resolvedMode === "night") {
          await loadScript(FOG_CDN);
          if (cancelled || !vantaRef.current || !window.VANTA?.FOG) return;
          vantaFx.current = window.VANTA.FOG({
            el: vantaRef.current,
            THREE: window.THREE,
            ...FOG_CONFIG,
          });
        } else {
          await loadScript(CLOUDS_CDN);
          if (cancelled || !vantaRef.current || !window.VANTA?.CLOUDS) return;
          vantaFx.current = window.VANTA.CLOUDS({
            el: vantaRef.current,
            THREE: window.THREE,
            ...CLOUDS_CONFIG,
          });
        }
      } catch (_) {}
    })();

    return () => { cancelled = true; };
  }, [resolvedMode]);

  useEffect(() => () => { vantaFx.current?.destroy(); }, []);

  return <div ref={vantaRef} className={`fixed inset-0 z-0 ${className}`} />;
}
