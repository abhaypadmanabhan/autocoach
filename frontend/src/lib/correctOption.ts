// Which displayed MCQ option is the correct one.
//
// The backend's answer key arrives as a bare letter ("B"), a labelled option
// ("B) Paris") or, on legacy rows, the option's full text, while the screen
// renders each option string as stored ("B) Paris" or "Paris"). Comparing the
// two strings directly misses most keys, so the right option was often not
// highlighted after grading.
//
// Mirrors the backend's `resolve_mcq_answer` (answer_evaluator.py): a letter
// label wins; otherwise the key is matched against option text with any
// leading label ignored on either side. Kept free of path-alias imports so
// `node --test` can load it directly.

const LABEL_DELIMITERS = new Set([")", ".", ":"]);

function letterIndex(char: string): number | null {
  const code = char.toUpperCase().charCodeAt(0);
  return code >= 65 && code <= 90 ? code - 65 : null;
}

// "B", "b", "B)", "b.", "B) Paris" -> 1. Plain text such as "Paris" -> null.
function labelIndex(key: string): number | null {
  if (key.length === 1) return letterIndex(key);
  if (LABEL_DELIMITERS.has(key[1])) return letterIndex(key[0]);
  return null;
}

function stripLabel(text: string): string {
  const trimmed = text.trim();
  return labelIndex(trimmed) !== null && trimmed.length > 1
    ? trimmed.slice(2).trim()
    : trimmed;
}

function canonical(text: string): string {
  return text.split(/\s+/).filter(Boolean).join(" ").toLowerCase();
}

export function resolveCorrectOptionIndex(
  options: readonly string[],
  correctAnswer: string | null | undefined,
): number | null {
  const key = correctAnswer?.trim() ?? "";
  if (!key || options.length === 0) return null;

  const labelled = labelIndex(key);
  if (labelled !== null && labelled < options.length) return labelled;

  const target = canonical(stripLabel(key));
  if (!target) return null;
  const match = options.findIndex(
    (opt) => canonical(opt) === canonical(key) || canonical(stripLabel(opt)) === target,
  );
  return match === -1 ? null : match;
}
