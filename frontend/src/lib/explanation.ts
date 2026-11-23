// The backend appends a citation to a question's explanation as a final
// paragraph, exactly "\n\nSource: Page 3" or "\n\nSource: Slide 9" (see
// backend/app/services/quiz_generator.py). Split it off so the screen can set
// it apart from the explanation text. Explanations without one pass through.

export type SourceKind = "page" | "slide";

export interface SplitExplanation {
  body: string;
  source: { kind: SourceKind; number: number } | null;
}

const SOURCE_SUFFIX = /\n\nSource: (Page|Slide) (\d+)\s*$/;

export function splitExplanation(explanation: string | null | undefined): SplitExplanation {
  const text = explanation ?? "";
  const match = SOURCE_SUFFIX.exec(text);
  if (!match) return { body: text.trim(), source: null };
  return {
    body: text.slice(0, match.index).trim(),
    source: {
      kind: match[1] === "Page" ? "page" : "slide",
      number: Number(match[2]),
    },
  };
}
