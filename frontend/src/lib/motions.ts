/**
 * AutoCoach Motion Library
 * Framer Motion variants and transitions based on design spec
 */

import type { Transition, Variants } from "framer-motion";

// ============================================
// TRANSITION PRESETS
// ============================================

export const transitions = {
  /** Expo ease-out: 0.6s - for page transitions */
  expo: {
    duration: 0.6,
    ease: [0.22, 1, 0.36, 1],
  } as Transition,

  /** Smooth: 0.5s - for slide reveals */
  smooth: {
    duration: 0.5,
    ease: [0.33, 1, 0.68, 1],
  } as Transition,

  /** Snappy: 0.3s - for button hovers */
  snappy: {
    duration: 0.3,
    ease: [0.4, 0, 0.2, 1],
  } as Transition,

  /** Spring physics - for natural movement */
  spring: {
    type: "spring",
    stiffness: 300,
    damping: 30,
  } as Transition,

  /** Bouncy spring - for playful interactions */
  bouncy: {
    type: "spring",
    stiffness: 400,
    damping: 25,
  } as Transition,

  /** Gentle spring - for subtle movement */
  gentle: {
    type: "spring",
    stiffness: 200,
    damping: 25,
  } as Transition,
};

// ============================================
// PAGE TRANSITIONS
// ============================================

export const pageVariants: Variants = {
  enter: {
    y: 20,
    opacity: 0,
  },
  center: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: -20,
    opacity: 0,
  },
};

export const pageTransition = {
  ...transitions.expo,
};

// Slide transitions for page navigation
export const slideLeftVariants: Variants = {
  enter: {
    x: 100,
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: -100,
    opacity: 0,
  },
};

export const slideRightVariants: Variants = {
  enter: {
    x: -100,
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: 100,
    opacity: 0,
  },
};

// ============================================
// DIAMOND MOTIF ANIMATIONS
// ============================================

export const diamondVariants: Variants = {
  idle: {
    rotate: 0,
    scale: 1,
  },
  hover: {
    rotate: 45,
    scale: 1.1,
  },
  active: {
    rotate: 45,
    scale: 1,
  },
  tap: {
    scale: 0.95,
  },
};

export const diamondTransition: Transition = {
  duration: 0.5,
  ease: "easeInOut",
};

// Diamond spinner for loading states
export const diamondSpinnerVariants: Variants = {
  animate: {
    rotate: 360,
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "linear",
    },
  },
};

// ============================================
// STAGGER CONTAINERS
// ============================================

export const staggerContainer: Variants = {
  hidden: {
    opacity: 0,
  },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const staggerFast: Variants = {
  hidden: {
    opacity: 0,
  },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.1,
    },
  },
};

export const staggerSlow: Variants = {
  hidden: {
    opacity: 0,
  },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

// ============================================
// ITEM ANIMATIONS
// ============================================

export const slideUpItem: Variants = {
  hidden: {
    y: 30,
    opacity: 0,
  },
  show: {
    y: 0,
    opacity: 1,
    transition: transitions.smooth,
  },
};

export const slideUpLarge: Variants = {
  hidden: {
    y: 40,
    opacity: 0,
  },
  show: {
    y: 0,
    opacity: 1,
    transition: {
      ...transitions.smooth,
      duration: 0.6,
    },
  },
};

export const slideDownItem: Variants = {
  hidden: {
    y: -20,
    opacity: 0,
  },
  show: {
    y: 0,
    opacity: 1,
    transition: transitions.smooth,
  },
};

export const scaleItem: Variants = {
  hidden: {
    scale: 0.9,
    opacity: 0,
  },
  show: {
    scale: 1,
    opacity: 1,
    transition: transitions.spring,
  },
};

export const fadeItem: Variants = {
  hidden: {
    opacity: 0,
  },
  show: {
    opacity: 1,
    transition: {
      duration: 0.4,
    },
  },
};

// ============================================
// NUMBER COUNT ANIMATION
// ============================================

export const numberCountVariants: Variants = {
  initial: {
    y: 20,
    opacity: 0,
    filter: "blur(4px)",
  },
  animate: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
  exit: {
    y: -20,
    opacity: 0,
    filter: "blur(4px)",
    transition: {
      duration: 0.3,
    },
  },
};

// ============================================
// CIRCULAR REVEAL
// ============================================

export const circularRevealVariants: Variants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: {
    scale: 1,
    opacity: 1,
    transition: {
      duration: 0.8,
      ease: [0.16, 1, 0.3, 1],
    },
  },
};

// ============================================
// BUTTON INTERACTIONS
// ============================================

export const buttonHoverVariants = {
  initial: { scale: 1 },
  hover: {
    scale: 1.02,
    transition: transitions.snappy,
  },
  tap: {
    scale: 0.98,
    transition: transitions.snappy,
  },
};

export const buttonFillVariants: Variants = {
  idle: {
    backgroundColor: "transparent",
    color: "var(--text-primary)",
  },
  hover: {
    backgroundColor: "rgba(205, 119, 106, 0.1)",
    borderColor: "var(--brand-primary)",
  },
  selected: {
    backgroundColor: "var(--brand-primary)",
    color: "var(--surface-dark)",
    borderColor: "var(--brand-primary)",
  },
};

// ============================================
// CARD ANIMATIONS
// ============================================

export const cardHoverVariants = {
  rest: {
    y: 0,
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
  },
  hover: {
    y: -4,
    boxShadow: "0 12px 24px -8px rgba(205, 119, 106, 0.25)",
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

export const cardLiftVariants: Variants = {
  initial: {
    y: 0,
    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
  },
  hover: {
    y: -4,
    boxShadow: "0 12px 24px -8px rgba(205, 119, 106, 0.25)",
    borderColor: "rgba(205, 119, 106, 0.5)",
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1],
    },
  },
};

// ============================================
// PROGRESS & LOADING
// ============================================

export const progressBarVariants: Variants = {
  initial: {
    width: 0,
  },
  animate: (progress: number) => ({
    width: `${progress}%`,
    transition: {
      duration: 0.8,
      ease: [0.33, 1, 0.68, 1],
    },
  }),
};

export const pulseVariants: Variants = {
  animate: {
    scale: [1, 1.02, 1],
    opacity: [0.8, 1, 0.8],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// ============================================
// STEP TRANSITIONS
// ============================================

export const stepExitVariants: Variants = {
  initial: {
    y: 0,
    opacity: 1,
  },
  exit: {
    y: -20,
    opacity: 0,
    transition: {
      duration: 0.3,
      ease: [0.33, 1, 0.68, 1],
    },
  },
};

export const stepEnterVariants: Variants = {
  initial: {
    y: 20,
    opacity: 0,
  },
  enter: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.33, 1, 0.68, 1],
      delay: 0.1,
    },
  },
};

// ============================================
// FEEDBACK PANEL
// ============================================

export const feedbackPanelVariants: Variants = {
  hidden: {
    y: "100%",
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.5,
      ease: [0.33, 1, 0.68, 1],
    },
  },
  exit: {
    y: "100%",
    opacity: 0,
    transition: {
      duration: 0.3,
    },
  },
};

export const feedbackStagger: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

export const feedbackItem: Variants = {
  hidden: {
    y: 10,
    opacity: 0,
  },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      duration: 0.4,
      ease: "easeOut",
    },
  },
};

// ============================================
// SCORE CIRCLE
// ============================================

export const scoreCircleVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: 1.2,
        ease: "easeOut",
      },
      opacity: {
        duration: 0.3,
      },
    },
  },
};

export const scoreTextVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.5,
  },
  visible: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      delay: 0.8,
    },
  },
};

export const satelliteVariants: Variants = {
  hidden: {
    scale: 0,
    opacity: 0,
  },
  visible: (delay: number) => ({
    scale: 1,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 200,
      delay: 0.2 * delay,
    },
  }),
};

// ============================================
// LIST ANIMATIONS
// ============================================

export const listItemVariants: Variants = {
  hidden: {
    x: -20,
    opacity: 0,
  },
  visible: (index: number) => ({
    x: 0,
    opacity: 1,
    transition: {
      delay: index * 0.1,
      duration: 0.4,
      ease: [0.33, 1, 0.68, 1],
    },
  }),
};

export const accordionVariants: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    transition: {
      height: {
        duration: 0.3,
      },
      opacity: {
        duration: 0.2,
      },
    },
  },
  expanded: {
    height: "auto",
    opacity: 1,
    transition: {
      height: {
        duration: 0.3,
      },
      opacity: {
        duration: 0.3,
        delay: 0.1,
      },
    },
  },
};

// ============================================
// OPTION SELECTION
// ============================================

export const optionVariants: Variants = {
  idle: {
    scale: 1,
    backgroundColor: "rgba(73, 88, 103, 0.3)",
    borderColor: "rgba(73, 88, 103, 1)",
  },
  hover: {
    scale: 1.01,
    x: 4,
    backgroundColor: "rgba(205, 119, 106, 0.1)",
    borderColor: "rgba(205, 119, 106, 0.5)",
  },
  selected: {
    scale: 1,
    backgroundColor: "rgba(205, 119, 106, 0.2)",
    borderColor: "rgba(205, 119, 106, 1)",
  },
  correct: {
    scale: 1,
    backgroundColor: "rgba(34, 197, 94, 0.2)",
    borderColor: "rgba(34, 197, 94, 1)",
  },
  wrong: {
    scale: 1,
    backgroundColor: "rgba(239, 68, 68, 0.2)",
    borderColor: "rgba(239, 68, 68, 1)",
  },
  tap: {
    scale: 0.98,
  },
};

// ============================================
// TIMER
// ============================================

export const timerBarVariants: Variants = {
  idle: {
    backgroundColor: "var(--brand-secondary)",
  },
  warning: {
    backgroundColor: "#eab308",
    transition: {
      duration: 0.3,
    },
  },
  critical: {
    backgroundColor: "#ef4444",
    transition: {
      duration: 0.3,
    },
  },
};

export const timerPulseVariants: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    opacity: [1, 0.8, 1],
    transition: {
      duration: 1,
      repeat: Infinity,
    },
  },
};

// ============================================
// MODAL/OVERLAY
// ============================================

export const overlayVariants: Variants = {
  hidden: {
    opacity: 0,
  },
  visible: {
    opacity: 1,
    transition: {
      duration: 0.3,
    },
  },
  exit: {
    opacity: 0,
    transition: {
      duration: 0.2,
    },
  },
};

export const modalVariants: Variants = {
  hidden: {
    scale: 0.9,
    opacity: 0,
    y: 20,
  },
  visible: {
    scale: 1,
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 30,
    },
  },
  exit: {
    scale: 0.9,
    opacity: 0,
    y: 20,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// DROP ZONE
// ============================================

export const dropZoneVariants: Variants = {
  idle: {
    borderColor: "rgba(73, 88, 103, 0.5)",
    backgroundColor: "rgba(73, 88, 103, 0.1)",
    scale: 1,
  },
  dragOver: {
    borderColor: "var(--brand-primary)",
    backgroundColor: "rgba(205, 119, 106, 0.1)",
    scale: 1.02,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// CHECKMARK DRAW
// ============================================

export const checkmarkDrawVariants: Variants = {
  hidden: {
    pathLength: 0,
    opacity: 0,
  },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: {
        duration: 0.4,
        ease: "easeOut",
      },
      opacity: {
        duration: 0.1,
      },
    },
  },
};

// ============================================
// NAVIGATION
// ============================================

export const navItemVariants: Variants = {
  initial: {
    x: 0,
  },
  hover: {
    x: 4,
    transition: {
      duration: 0.2,
    },
  },
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Creates a stagger delay for child animations
 */
export function createStaggerDelay(
  index: number,
  baseDelay: number = 0.1,
  offset: number = 0
): number {
  return index * baseDelay + offset;
}

/**
 * Easing functions for custom animations
 */
export const easings = {
  easeOutExpo: [0.22, 1, 0.36, 1] as const,
  easeInOutExpo: [0.87, 0, 0.13, 1] as const,
  easeOutQuart: [0.25, 1, 0.5, 1] as const,
  easeOutBack: [0.34, 1.56, 0.64, 1] as const,
  easeSmooth: [0.33, 1, 0.68, 1] as const,
};
