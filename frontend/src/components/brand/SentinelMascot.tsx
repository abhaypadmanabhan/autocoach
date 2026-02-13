"use client";

import { useEffect, useState, useRef } from "react";
import { motion, useSpring, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "smiling" | "proud" | "pleading" | "thinking" | "timesUp" | "wrong";

interface SentinelMascotProps {
  variant?: Variant;
  className?: string;
}

// Mouse position hook for sentient eye tracking (throttled with rAF)
function useMousePosition() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const rafId = useRef<number>(0);

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      rafId.current = requestAnimationFrame(() => {
        setMousePosition({ x: e.clientX, y: e.clientY });
      });
    };

    window.addEventListener("mousemove", updateMousePosition, { passive: true });
    return () => {
      window.removeEventListener("mousemove", updateMousePosition);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
  }, []);

  return mousePosition;
}

// Exact head path as specified
const HEAD_PATH = "M1006.98 666.764C1120.11 308.446 1605.94 269.517 1779.76 594.804C1802.71 637.748 1816.13 684.065 1824.77 731.813C1826.52 741.481 1829.72 756.332 1830.16 765.696C1833.11 782.774 1835.1 800.916 1836.51 818.198C1842.42 890.518 1842.36 970.382 1798.59 1032.32C1798.2 1032.87 1797.81 1033.41 1797.41 1033.95C1783.84 1057.39 1749.48 1087.21 1726.06 1100.44C1715.11 1107.17 1703.73 1113.18 1691.98 1118.41C1685.21 1121.53 1679.28 1124.34 1672.2 1126.81C1657.38 1131.95 1616.79 1145.2 1601.02 1146.66C1585.06 1150.55 1519.51 1161.7 1505.37 1160.09C1494.68 1162.3 1452.96 1162.86 1440.81 1162.93C1378.61 1163.3 1309.19 1163.45 1247.82 1152.6C1242.91 1152.35 1231.25 1149.76 1225.98 1148.71C1140.81 1131.73 1064.42 1103.2 1015.02 1027.81C997.348 999.553 982.989 961.143 979.721 927.912C971.64 845.742 983.157 745.842 1006.98 666.764Z";

// Colors
const COLORS = {
  black: "#000000",
  dustyRose: "#CD776A",
};

// Eye positions (within 2816x1536 viewBox)
const LEFT_EYE_CENTER = { x: 1250, y: 750 };
const RIGHT_EYE_CENTER = { x: 1566, y: 750 };

// Variants where mouse tracking is disabled
const NO_TRACKING_VARIANTS: Variant[] = ["thinking", "timesUp"];

export function SentinelMascot({ variant = "neutral", className }: SentinelMascotProps) {
  const mousePosition = useMousePosition();
  const [isBlinking, setIsBlinking] = useState(false);

  // Smooth spring animation for eye movement (up to 10px)
  const leftEyeX = useSpring(0, { stiffness: 150, damping: 15 });
  const leftEyeY = useSpring(0, { stiffness: 150, damping: 15 });
  const rightEyeX = useSpring(0, { stiffness: 150, damping: 15 });
  const rightEyeY = useSpring(0, { stiffness: 150, damping: 15 });

  // Blink logic: random intervals between 3-7 seconds
  useEffect(() => {
    const scheduleBlink = () => {
      const delay = 3000 + Math.random() * 4000;
      const timeoutId = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleBlink();
      }, delay);
      return timeoutId;
    };

    const timeoutId = scheduleBlink();
    return () => clearTimeout(timeoutId);
  }, []);

  // Sentient "Look At" feature: track mouse position (max 10px)
  useEffect(() => {
    if (NO_TRACKING_VARIANTS.includes(variant)) {
      leftEyeX.set(0);
      leftEyeY.set(0);
      rightEyeX.set(0);
      rightEyeY.set(0);
      return;
    }

    // Calculate offset toward mouse (simplified for SVG coordinate space)
    const offsetX = ((mousePosition.x - window.innerWidth / 2) / window.innerWidth) * 20;
    const offsetY = ((mousePosition.y - window.innerHeight / 2) / window.innerHeight) * 20;

    // Clamp to max 10px
    const clampedX = Math.max(-10, Math.min(10, offsetX));
    const clampedY = Math.max(-10, Math.min(10, offsetY));

    leftEyeX.set(clampedX);
    leftEyeY.set(clampedY);
    rightEyeX.set(clampedX);
    rightEyeY.set(clampedY);
  }, [mousePosition, variant, leftEyeX, leftEyeY, rightEyeX, rightEyeY]);

  // Render eyes based on variant
  const renderEyes = () => {
    const blinkScale = isBlinking ? 0.1 : 1;

    switch (variant) {
      case "neutral":
        // Two solid black circles
        return (
          <motion.g key="neutral" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.circle
              cx={LEFT_EYE_CENTER.x}
              cy={LEFT_EYE_CENTER.y}
              r="40"
              fill={COLORS.black}
              style={{ x: leftEyeX, y: leftEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            />
            <motion.circle
              cx={RIGHT_EYE_CENTER.x}
              cy={RIGHT_EYE_CENTER.y}
              r="40"
              fill={COLORS.black}
              style={{ x: rightEyeX, y: rightEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            />
          </motion.g>
        );

      case "smiling":
        // Two small arc paths (happy curved eyes), sized to match neutral ~80px
        return (
          <motion.g key="smiling" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.g style={{ x: leftEyeX, y: leftEyeY }}>
              <path
                d="M1210 770 Q1250 730 1290 770"
                stroke={COLORS.black}
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
              />
            </motion.g>
            <motion.g style={{ x: rightEyeX, y: rightEyeY }}>
              <path
                d="M1526 770 Q1566 730 1606 770"
                stroke={COLORS.black}
                strokeWidth="14"
                strokeLinecap="round"
                fill="none"
              />
            </motion.g>
          </motion.g>
        );

      case "proud":
        // Left eye = open circle, Right eye = thick wink line
        return (
          <motion.g key="proud" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.g style={{ x: leftEyeX, y: leftEyeY }}>
              <path
                d="M1237 780 m-65 0 a65 65 0 1 0 130 0 a65 65 0 1 0 -130 0"
                fill="none"
                stroke={COLORS.black}
                strokeWidth="12"
              />
            </motion.g>
            <motion.g style={{ x: rightEyeX, y: rightEyeY }}>
              <line
                x1={1514}
                y1={780}
                x2={1644}
                y2={780}
                stroke={COLORS.black}
                strokeWidth="16"
                strokeLinecap="round"
              />
            </motion.g>
          </motion.g>
        );

      case "pleading":
        // Two flat-top chord shapes (puppy eyes)
        return (
          <motion.g key="pleading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.g style={{ x: leftEyeX, y: leftEyeY }}>
              <path
                d="M1172 780 a65 65 0 0 0 130 0 H1172 Z"
                fill={COLORS.black}
              />
            </motion.g>
            <motion.g style={{ x: rightEyeX, y: rightEyeY }}>
              <path
                d="M1514 780 a65 65 0 0 0 130 0 H1514 Z"
                fill={COLORS.black}
              />
            </motion.g>
          </motion.g>
        );

      case "thinking":
        // 3 animated dots with staggered opacity
        return (
          <motion.g key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.circle
              cx={1200}
              cy={780}
              r="35"
              fill={COLORS.black}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0 }}
            />
            <motion.circle
              cx={1408}
              cy={780}
              r="35"
              fill={COLORS.black}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
            />
            <motion.circle
              cx={1616}
              cy={780}
              r="35"
              fill={COLORS.black}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
            />
          </motion.g>
        );

      case "timesUp":
        // Two squint lines
        return (
          <motion.g key="timesUp" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <line
              x1={1180}
              y1={780}
              x2={1300}
              y2={780}
              stroke={COLORS.black}
              strokeWidth="20"
              strokeLinecap="round"
            />
            <line
              x1={1520}
              y1={780}
              x2={1640}
              y2={780}
              stroke={COLORS.black}
              strokeWidth="20"
              strokeLinecap="round"
            />
          </motion.g>
        );

      case "wrong":
        // Two black X-shapes (thick strokes)
        return (
          <motion.g key="wrong" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.g
              style={{ x: leftEyeX, y: leftEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            >
              <line
                x1={LEFT_EYE_CENTER.x - 35}
                y1={LEFT_EYE_CENTER.y - 35}
                x2={LEFT_EYE_CENTER.x + 35}
                y2={LEFT_EYE_CENTER.y + 35}
                stroke={COLORS.black}
                strokeWidth="20"
                strokeLinecap="round"
              />
              <line
                x1={LEFT_EYE_CENTER.x + 35}
                y1={LEFT_EYE_CENTER.y - 35}
                x2={LEFT_EYE_CENTER.x - 35}
                y2={LEFT_EYE_CENTER.y + 35}
                stroke={COLORS.black}
                strokeWidth="20"
                strokeLinecap="round"
              />
            </motion.g>
            <motion.g
              style={{ x: rightEyeX, y: rightEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            >
              <line
                x1={RIGHT_EYE_CENTER.x - 35}
                y1={RIGHT_EYE_CENTER.y - 35}
                x2={RIGHT_EYE_CENTER.x + 35}
                y2={RIGHT_EYE_CENTER.y + 35}
                stroke={COLORS.black}
                strokeWidth="20"
                strokeLinecap="round"
              />
              <line
                x1={RIGHT_EYE_CENTER.x + 35}
                y1={RIGHT_EYE_CENTER.y - 35}
                x2={RIGHT_EYE_CENTER.x - 35}
                y2={RIGHT_EYE_CENTER.y + 35}
                stroke={COLORS.black}
                strokeWidth="20"
                strokeLinecap="round"
              />
            </motion.g>
          </motion.g>
        );

      default:
        return null;
    }
  };

  // Determine head animation based on variant
  const headAnimation = (() => {
    if (variant === "wrong") {
      return {
        animate: { x: [-10, 10, -10, 10, 0] },
        transition: { type: "spring" as const, stiffness: 300, damping: 10 },
      };
    }
    if (variant === "proud") {
      return {
        animate: { rotate: [-5, 0] },
        transition: { type: "spring" as const, stiffness: 120, damping: 14 },
      };
    }
    return {};
  })();

  // Determine float class based on variant
  const floatClass =
    variant === "timesUp"
      ? "animate-mascot-float-fast"
      : variant === "pleading"
        ? "animate-mascot-float-slow"
        : "animate-mascot-float";

  return (
    <motion.div
      className={cn("relative", floatClass, className)}
      {...headAnimation}
    >
      <svg
        viewBox="0 0 2816 1536"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Head shape */}
        <path
          d={HEAD_PATH}
          className="fill-[var(--brand-secondary)]"
        />

        {/* Eyes with morph transitions */}
        <AnimatePresence mode="wait">
          {renderEyes()}
        </AnimatePresence>

        {/* Whistle for timesUp variant */}
        {variant === "timesUp" && (
          <motion.g
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              x: [-5, 5, -5, 5, -5],
            }}
            transition={{
              opacity: { duration: 0.2 },
              x: {
                duration: 0.2,
                repeat: Infinity,
                ease: "linear",
              },
            }}
          >
            {/* Whistle positioned at mouth level */}
            <rect
              x={1358}
              y={870}
              width="100"
              height="60"
              rx="8"
              fill={COLORS.dustyRose}
            />
            <circle
              cx={1408}
              cy={900}
              r="20"
              fill={COLORS.black}
            />
            {/* Whistle ring */}
            <path
              d="M1458 920 C1480 920, 1490 910, 1490 900 C1490 890, 1480 880, 1458 880"
              stroke={COLORS.dustyRose}
              strokeWidth="12"
              strokeLinecap="round"
              fill="none"
            />
          </motion.g>
        )}
      </svg>
    </motion.div>
  );
}
