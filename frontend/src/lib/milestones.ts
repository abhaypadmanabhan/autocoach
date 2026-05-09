export type MilestoneLevel = "apprentice" | "scholar" | "expert" | "master";

const labels: Record<MilestoneLevel, string> = {
  apprentice: "Apprentice",
  scholar: "Scholar",
  expert: "Expert",
  master: "Master",
};

export function milestoneFromMastery(mastery: number): MilestoneLevel {
  const m = Math.max(0, Math.min(100, mastery));
  if (m >= 80) return "master";
  if (m >= 50) return "expert";
  if (m >= 25) return "scholar";
  return "apprentice";
}

export function milestoneLabel(level: MilestoneLevel): string {
  return labels[level];
}
