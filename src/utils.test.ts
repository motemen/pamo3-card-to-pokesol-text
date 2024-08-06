import { test, expect } from "vitest";

import {
  fixupAbility,
  fixupMoveName,
  fixupPokemonName,
  squeezeTessaractResult,
} from "./utils";

test("squeezeTessaractResult", () => {
  [
    ["バド レッ クス (は くば じょう )", "バドレックス(はくばじょう)"],
    ["じん ば いったい (は くば ぱ )", "じんばいったい(はくば)"],
    ["つら ら ば ぱり", "つららばり"],
    ["タネ ば ぱく だ ん", "タネばくだん"],
  ].forEach(([input, expected]) => {
    expect(squeezeTessaractResult(input)).toBe(expected);
  });
});

test("fixupPokemonName", async ({ expect }) => {
  const tests = [["ヒートロトムニニーー", "ヒートロトム"]];

  for (const [input, expected] of tests) {
    expect(fixupPokemonName(input)).toBe(expected);
  }
});

test("fixupMoveName", async ({ expect }) => {
  const tests = [
    ["しんそく", "しんそく"],
    ["はねやすめ", "はねやすめ"],
    ["アンコールー", "アンコール"],
    ["シャドークローーー", "シャドークロー"],
  ];

  for (const [input, expected] of tests) {
    expect(fixupMoveName(input)).toBe(expected);
  }
});

test("fixupAbility", async ({ expect }) => {
  const tests = [["サイコメイカー", "サイコメイカー"]];

  for (const [input, expected] of tests) {
    expect(fixupAbility(input)).toBe(expected);
  }
});
