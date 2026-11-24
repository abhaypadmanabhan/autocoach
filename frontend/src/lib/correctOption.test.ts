import { test } from "node:test";
import assert from "node:assert/strict";

import type * as CorrectOption from "./correctOption";

// Node's type stripping needs the ".ts" extension on a runtime import, which
// tsconfig rejects without allowImportingTsExtensions: load the module by URL
// and take its types from the type-only import above.
const { resolveCorrectOptionIndex } = (await import(
  new URL("./correctOption.ts", import.meta.url).href
)) as typeof CorrectOption;

const LABELLED = ["A) Oslo", "B) Paris", "C) Rome", "D) Madrid"];
const PLAIN = ["Oslo", "Paris", "Rome", "Madrid"];

test("user picked A, B is right: B resolves as correct, A does not", () => {
  const correct = resolveCorrectOptionIndex(LABELLED, "B");
  assert.equal(correct, 1);
  assert.notEqual(correct, 0);
});

test("a bare letter key resolves in any case and with a ) or . suffix", () => {
  for (const key of ["B", "b", "B)", "b.", " B ", "B:"]) {
    assert.equal(resolveCorrectOptionIndex(LABELLED, key), 1, key);
    assert.equal(resolveCorrectOptionIndex(PLAIN, key), 1, key);
  }
});

test("a labelled key resolves against labelled and plain options", () => {
  assert.equal(resolveCorrectOptionIndex(LABELLED, "C) Rome"), 2);
  assert.equal(resolveCorrectOptionIndex(PLAIN, "C) Rome"), 2);
});

test("a full-text legacy key matches with or without a label on either side", () => {
  assert.equal(resolveCorrectOptionIndex(PLAIN, "Madrid"), 3);
  assert.equal(resolveCorrectOptionIndex(LABELLED, "Madrid"), 3);
  assert.equal(resolveCorrectOptionIndex(LABELLED, "  madrid "), 3);
  assert.equal(resolveCorrectOptionIndex(PLAIN, "D) Madrid"), 3);
});

test("option text that starts with a capital letter and a space is not a label", () => {
  const options = ["A device that stores charge", "A wire", "A switch", "A fuse"];
  assert.equal(resolveCorrectOptionIndex(options, "A switch"), 2);
});

test("no match returns null", () => {
  assert.equal(resolveCorrectOptionIndex(LABELLED, "Berlin"), null);
  assert.equal(resolveCorrectOptionIndex(LABELLED, "E"), null);
  assert.equal(resolveCorrectOptionIndex(LABELLED, ""), null);
  assert.equal(resolveCorrectOptionIndex(LABELLED, null), null);
  assert.equal(resolveCorrectOptionIndex(LABELLED, undefined), null);
  assert.equal(resolveCorrectOptionIndex([], "A"), null);
});

test("the old direct comparison misses a letter key (regression guard)", () => {
  // The page used to test `correctAnswer === opt`; "B" never equals "B) Paris".
  assert.equal(LABELLED.findIndex((opt) => opt === "B"), -1);
  assert.equal(resolveCorrectOptionIndex(LABELLED, "B"), 1);
});
