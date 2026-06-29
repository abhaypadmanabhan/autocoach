export type LearningTip = {
  id: string;
  label: string;
  title: string;
  body: string;
};

export const LEARNING_TIP_ROTATION_MS = 3500;

export const LEARNING_TIPS: readonly LearningTip[] = [
  {
    id: "effortful-recall",
    label: "Retrieval",
    title: "Make recall do the work",
    body: "Before checking options, name the answer in your own words. Effortful retrieval is the part that sticks.",
  },
  {
    id: "explain-the-miss",
    label: "Feedback",
    title: "Explain the miss",
    body: "When feedback appears, reduce the gap to one sentence. A precise miss is easier to repair.",
  },
  {
    id: "source-language",
    label: "Evidence",
    title: "Use document language",
    body: "If two choices feel close, prefer the one that matches the source terms and relationships.",
  },
  {
    id: "find-the-cue",
    label: "Focus",
    title: "Separate fact from cue",
    body: "Ask what the question is really testing before locking in the answer.",
  },
  {
    id: "reuse-feedback",
    label: "Review",
    title: "Turn feedback into a prompt",
    body: "After a correction, ask how you would recognize the same idea in a new format.",
  },
];

export function getNextTipIndex(currentIndex: number, totalTips: number): number {
  if (totalTips <= 1) return 0;
  return normalizeTipIndex(currentIndex + 1, totalTips);
}

export function getRotatingTip<T>(
  tips: readonly T[],
  index: number,
): T | undefined {
  if (tips.length === 0) return undefined;
  return tips[normalizeTipIndex(index, tips.length)];
}

function normalizeTipIndex(index: number, totalTips: number): number {
  return ((Math.trunc(index) % totalTips) + totalTips) % totalTips;
}
