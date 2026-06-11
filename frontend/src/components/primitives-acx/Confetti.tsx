"use client";

import { useEffect, useRef } from "react";
import confetti from "canvas-confetti";

interface ConfettiProps {
  score: number;
  threshold?: number;
}

export function Confetti({ score, threshold = 80 }: ConfettiProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    if (score < threshold) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    fired.current = true;

    const fire = (originX: number) => {
      confetti({
        particleCount: 40,
        spread: 60,
        startVelocity: 32,
        origin: { x: originX, y: 0.7 },
        colors: ["#109462", "#171717", "#C2402A"],
        scalar: 0.8,
      });
    };

    fire(0.2);
    setTimeout(() => fire(0.8), 120);
    setTimeout(() => fire(0.5), 260);
  }, [score, threshold]);

  return null;
}
