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
    fired.current = true;

    const accent = "#5b8cff";
    const success = "#7ed7a3";

    const fire = (originX: number) => {
      confetti({
        particleCount: 60,
        spread: 60,
        startVelocity: 32,
        origin: { x: originX, y: 0.7 },
        colors: [accent, success, "#ffffff"],
        scalar: 0.85,
      });
    };

    fire(0.2);
    setTimeout(() => fire(0.8), 120);
    setTimeout(() => fire(0.5), 260);
  }, [score, threshold]);

  return null;
}
