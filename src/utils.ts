// ぱ,ば など濁音半濁音のペア
const DAKUON_HANDAKUON_PAIRS: Record<string, string> = {
  ぱ: "ば",
  ぴ: "び",
  ぷ: "ぶ",
  ぺ: "べ",
  ぽ: "ぼ",

  ば: "ぱ",
  び: "ぴ",
  ぶ: "ぷ",
  べ: "ぺ",
  ぼ: "ぽ",

  パ: "バ",
  ピ: "ビ",
  プ: "ブ",
  ペ: "ベ",
  ポ: "ボ",

  バ: "パ",
  ビ: "ピ",
  ブ: "プ",
  ベ: "ペ",
  ボ: "ポ",
};

export const squeezeTessaractResult = (text: string): string => {
  return text
    .trim()
    .split(" ")
    .reduce((result, part) => {
      if (result.length === 0) return part;

      const ch = DAKUON_HANDAKUON_PAIRS[part[0]];
      if (ch && result[result.length - 1] === ch) {
        return result + part.slice(1);
      }

      return result + part;
    }, "");
};
