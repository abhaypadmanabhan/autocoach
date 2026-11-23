import { test } from "node:test";
import assert from "node:assert/strict";

import type * as Explanation from "./explanation";

// Loaded by URL for the same reason as correctOption.test.ts.
const { splitExplanation } = (await import(
  new URL("./explanation.ts", import.meta.url).href
)) as typeof Explanation;

test("a page citation is split off the explanation", () => {
  assert.deepEqual(splitExplanation("A dark white lantern outranks an edge lantern.\n\nSource: Page 3"), {
    body: "A dark white lantern outranks an edge lantern.",
    source: { kind: "page", number: 3 },
  });
});

test("a slide citation is split off the explanation", () => {
  assert.deepEqual(splitExplanation("Red emitters are for young trees.\n\nSource: Slide 12"), {
    body: "Red emitters are for young trees.",
    source: { kind: "slide", number: 12 },
  });
});

test("an explanation without a citation passes through", () => {
  assert.deepEqual(splitExplanation("Because the filter clogs."), {
    body: "Because the filter clogs.",
    source: null,
  });
});

test("the word Source inside the text is not a citation", () => {
  const text = "Source: Page 4 is where the rule is stated, but read on.";
  assert.deepEqual(splitExplanation(text), { body: text, source: null });
});

test("a citation alone leaves an empty body", () => {
  assert.deepEqual(splitExplanation("\n\nSource: Page 1"), {
    body: "",
    source: { kind: "page", number: 1 },
  });
});

test("null and undefined are an empty explanation", () => {
  assert.deepEqual(splitExplanation(null), { body: "", source: null });
  assert.deepEqual(splitExplanation(undefined), { body: "", source: null });
});
