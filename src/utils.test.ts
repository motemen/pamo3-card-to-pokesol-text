import { test, expect } from "vitest";

import { squeezeTessaractResult } from "./utils";

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
