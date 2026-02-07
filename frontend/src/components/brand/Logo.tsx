"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  animated?: boolean;
}

// Mascot head path from SentinelMascot (simplified for logo use)
const MASCOT_HEAD_PATH = "M1006.98 666.764C1120.11 308.446 1605.94 269.517 1779.76 594.804C1802.71 637.748 1816.13 684.065 1824.77 731.813C1826.52 741.481 1829.72 756.332 1830.16 765.696C1833.11 782.774 1835.1 800.916 1836.51 818.198C1842.42 890.518 1842.36 970.382 1798.59 1032.32C1798.2 1032.87 1797.81 1033.41 1797.41 1033.95C1783.84 1057.39 1749.48 1087.21 1726.06 1100.44C1715.11 1107.17 1703.73 1113.18 1691.98 1118.41C1685.21 1121.53 1679.28 1124.34 1672.2 1126.81C1657.38 1131.95 1616.79 1145.2 1601.02 1146.66C1585.06 1150.55 1519.51 1161.7 1505.37 1160.09C1494.68 1162.3 1452.96 1162.86 1440.81 1162.93C1378.61 1163.3 1309.19 1163.45 1247.82 1152.6C1242.91 1152.35 1231.25 1149.76 1225.98 1148.71C1140.81 1131.73 1064.42 1103.2 1015.02 1027.81C997.348 999.553 982.989 961.143 979.721 927.912C971.64 845.742 983.157 745.842 1006.98 666.764Z";

// Left and right eye positions
const LEFT_EYE = { cx: 1250, cy: 750, r: 40 };
const RIGHT_EYE = { cx: 1566, cy: 750, r: 40 };

const sizes = {
  sm: { mascot: "w-8 h-8", text: "text-xl", gap: "gap-2" },
  md: { mascot: "w-10 h-10", text: "text-2xl", gap: "gap-2.5" },
  lg: { mascot: "w-14 h-14", text: "text-3xl", gap: "gap-3" },
};

export function Logo({ className, size = "md", showText = true, animated = true }: LogoProps) {
  const sizeClasses = sizes[size];

  const MascotSvg = (
    <svg
      viewBox="0 0 2816 1536"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", sizeClasses.mascot)}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Head shape with brand secondary color */}
      <path
        d={MASCOT_HEAD_PATH}
        className="fill-[var(--brand-secondary)]"
      />
      {/* Eyes */}
      <circle
        cx={LEFT_EYE.cx}
        cy={LEFT_EYE.cy}
        r={LEFT_EYE.r}
        className="fill-[var(--surface-dark)]"
      />
      <circle
        cx={RIGHT_EYE.cx}
        cy={RIGHT_EYE.cy}
        r={RIGHT_EYE.r}
        className="fill-[var(--surface-dark)]"
      />
    </svg>
  );

  if (!showText) {
    return animated ? (
      <motion.div
        className={className}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        {MascotSvg}
      </motion.div>
    ) : (
      <div className={className}>{MascotSvg}</div>
    );
  }

  const content = (
    <div className={cn("flex items-center", sizeClasses.gap, className)}>
      {MascotSvg}
      <span
        className={cn(
          "font-bold tracking-tight text-[var(--indigo-space)] dark:text-[var(--text-primary)] font-heading",
          sizeClasses.text
        )}
      >
        utoCoach
      </span>
    </div>
  );

  if (animated) {
    return (
      <motion.div
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="cursor-pointer"
      >
        {content}
      </motion.div>
    );
  }

  return content;
}

// Full logo with wordmark for hero/landing sections
export function LogoFull({ className, size = "lg" }: { className?: string; size?: "md" | "lg" | "xl" }) {
  const sizeClasses = {
    md: { mascot: "w-16 h-16", text: "text-4xl", subtext: "text-sm" },
    lg: { mascot: "w-20 h-20", text: "text-5xl", subtext: "text-base" },
    xl: { mascot: "w-28 h-28", text: "text-6xl", subtext: "text-lg" },
  }[size];

  return (
    <motion.div
      className={cn("flex flex-col items-center", className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      {/* Mascot A with glow effect */}
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-[var(--brand-primary)] opacity-20 blur-3xl rounded-full scale-150" />
        <motion.div
          animate={{ y: [-4, 4, -4] }}
          transition={{ duration: 4, ease: "easeInOut", repeat: Infinity }}
          className="relative"
        >
          <svg
            viewBox="0 0 2816 1536"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={sizeClasses.mascot}
          >
            <path
              d={MASCOT_HEAD_PATH}
              className="fill-[var(--brand-secondary)]"
            />
            <circle
              cx={LEFT_EYE.cx}
              cy={LEFT_EYE.cy}
              r={LEFT_EYE.r}
              className="fill-[var(--surface-dark)]"
            />
            <circle
              cx={RIGHT_EYE.cx}
              cy={RIGHT_EYE.cy}
              r={RIGHT_EYE.r}
              className="fill-[var(--surface-dark)]"
            />
          </svg>
        </motion.div>
      </div>

      {/* Wordmark */}
      <div className="text-center">
        <h1
          className={cn(
            "font-extrabold tracking-tight text-[var(--indigo-space)] dark:text-[var(--text-primary)] font-heading",
            sizeClasses.text
          )}
        >
          utoCoach
        </h1>
        <p className={cn("text-[var(--text-secondary)] mt-1", sizeClasses.subtext)}>
          Your AI Learning Companion
        </p>
      </div>
    </motion.div>
  );
}
