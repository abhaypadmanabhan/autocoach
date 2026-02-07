"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

type Variant = "neutral" | "thinking" | "wrong" | "success" | "timeout";

interface SentinelMascotProps {
  variant?: Variant;
  className?: string;
}

// Mouse position hook for sentient eye tracking
function useMousePosition() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener("mousemove", updateMousePosition);
    return () => window.removeEventListener("mousemove", updateMousePosition);
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
  }, [mousePosition, leftEyeX, leftEyeY, rightEyeX, rightEyeY]);

  // Render eyes based on variant
  const renderEyes = () => {
    const blinkScale = isBlinking ? 0.1 : 1;

    switch (variant) {
      case "neutral":
        // Two solid black circles
        return (
          <>
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
          </>
        );

      case "success":
        // Two Dusty Rose four-pointed stars
        return (
          <>
            <motion.g
              style={{ x: leftEyeX, y: leftEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            >
              <path
                d={`M${LEFT_EYE_CENTER.x} ${LEFT_EYE_CENTER.y - 50} 
                    L${LEFT_EYE_CENTER.x + 15} ${LEFT_EYE_CENTER.y - 15} 
                    L${LEFT_EYE_CENTER.x + 50} ${LEFT_EYE_CENTER.y} 
                    L${LEFT_EYE_CENTER.x + 15} ${LEFT_EYE_CENTER.y + 15} 
                    L${LEFT_EYE_CENTER.x} ${LEFT_EYE_CENTER.y + 50} 
                    L${LEFT_EYE_CENTER.x - 15} ${LEFT_EYE_CENTER.y + 15} 
                    L${LEFT_EYE_CENTER.x - 50} ${LEFT_EYE_CENTER.y} 
                    L${LEFT_EYE_CENTER.x - 15} ${LEFT_EYE_CENTER.y - 15} Z`}
                fill={COLORS.dustyRose}
              />
            </motion.g>
            <motion.g
              style={{ x: rightEyeX, y: rightEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            >
              <path
                d={`M${RIGHT_EYE_CENTER.x} ${RIGHT_EYE_CENTER.y - 50} 
                    L${RIGHT_EYE_CENTER.x + 15} ${RIGHT_EYE_CENTER.y - 15} 
                    L${RIGHT_EYE_CENTER.x + 50} ${RIGHT_EYE_CENTER.y} 
                    L${RIGHT_EYE_CENTER.x + 15} ${RIGHT_EYE_CENTER.y + 15} 
                    L${RIGHT_EYE_CENTER.x} ${RIGHT_EYE_CENTER.y + 50} 
                    L${RIGHT_EYE_CENTER.x - 15} ${RIGHT_EYE_CENTER.y + 15} 
                    L${RIGHT_EYE_CENTER.x - 50} ${RIGHT_EYE_CENTER.y} 
                    L${RIGHT_EYE_CENTER.x - 15} ${RIGHT_EYE_CENTER.y - 15} Z`}
                fill={COLORS.dustyRose}
              />
            </motion.g>
          </>
        );

      case "thinking":
        // Three solid black dots in horizontal row
        return (
          <>
            <motion.g
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            >
              <circle cx={1340} cy={LEFT_EYE_CENTER.y} r="25" fill={COLORS.black} />
              <circle cx={1408} cy={LEFT_EYE_CENTER.y} r="25" fill={COLORS.black} />
              <circle cx={1476} cy={LEFT_EYE_CENTER.y} r="25" fill={COLORS.black} />
            </motion.g>
          </>
        );

      case "wrong":
        // Two black X-shapes (thick strokes)
        return (
          <>
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
          </>
        );

      case "timeout":
        // Two flat black rectangles
        return (
          <>
            <motion.rect
              x={LEFT_EYE_CENTER.x - 45}
              y={LEFT_EYE_CENTER.y - 20}
              width="90"
              height="40"
              fill={COLORS.black}
              style={{ x: leftEyeX, y: leftEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            />
            <motion.rect
              x={RIGHT_EYE_CENTER.x - 45}
              y={RIGHT_EYE_CENTER.y - 20}
              width="90"
              height="40"
              fill={COLORS.black}
              style={{ x: rightEyeX, y: rightEyeY }}
              animate={{ scaleY: blinkScale }}
              transition={{ duration: 0.075 }}
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      className={cn("relative", className)}
      animate={{
        y: [-8, 8, -8],
      }}
      transition={{
        duration: 4,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "loop",
      }}
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

        {/* Eyes */}
        {renderEyes()}

        {/* Whistle for timeout variant */}
        {variant === "timeout" && (
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
            {/* Whistle positioned below eyes */}
            <rect
              x={1358}
              y={950}
              width="100"
              height="60"
              rx="8"
              fill={COLORS.dustyRose}
            />
            <circle
              cx={1408}
              cy={980}
              r="20"
              fill={COLORS.black}
            />
            {/* Whistle ring */}
            <path
              d="M1458 1000 C1480 1000, 1490 990, 1490 980 C1490 970, 1480 960, 1458 960"
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
