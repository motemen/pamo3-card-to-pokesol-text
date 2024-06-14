import pokemon_names_ja from "../data/pokemon_names_ja.txt?raw";

export const POKEMON_NAMES_JA = pokemon_names_ja.trim().split("\n");

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
export function fixupPokemonName(name: string): string | null {
  name = name.replace(/[^ぁ-んァ-ヶー\(\)]/g, "");
  name = name.replace(/ー+$/, "ー");

  if (POKEMON_NAMES_JA.includes(name)) {
    return name;
  }
  name = name.replace(/ー$/, "");
  if (POKEMON_NAMES_JA.includes(name)) {
    return name;
  }

  console.log(`Unknown pokemon name: ${name}`);

  return null;
}
interface PokemonStats {
  H: number;
  A: number;
  B: number;
  C: number;
  D: number;
  S: number;
}
const STATS_KEYS = ["H", "A", "B", "C", "D", "S"] as (keyof PokemonStats)[];
export interface PokemonInfo {
  name: string;
  moves: string[];
  ability: string;
  actualValues: PokemonStats;
  effortValues: PokemonStats;

  // TODO
  nature: string;
  terastalType: string;
  item: string;
}
const POKEMON_VARIANT_PAMO3_TO_POKESOL: Record<string, string | null> = {
  "(れいじゅう)": "(霊獣)",
  "(けしん)": "(化身)",
  "(みどり)": "",
  "(かまど)": "(炎)",
  "(いど)": "(水)",
  "(いしずえ)": "(岩)",
  "(はくばじょう)": "(白馬)",
  "(こくばじょう)": "(黒馬)",
  "(アカツキ)": "(赫月)",
  "(れんげき)": "(連撃)",
  "(いちげき)": "(一撃)",

  ヒートロトム: "ロトム(炎)",
  ウォッシュロトム: "ロトム(水)",
  フロストロトム: "ロトム(氷)",
  スピンロトム: "ロトム(飛)",
  カットロトム: "ロトム(草)",
  "カバルドン(オス)": "カバルドン",
  "カバルドン(メス)": "カバルドン",
};
export function toPokesolText(pokemonInfo: PokemonInfo): string {
  const statsLine = STATS_KEYS.map((key) => {
    const actual = pokemonInfo.actualValues[key];
    const effort = pokemonInfo.effortValues[key];
    if (effort > 0) {
      return `${actual}(${effort})`;
    }
    return actual;
  }).join("-");

  const pokemonName =
    POKEMON_VARIANT_PAMO3_TO_POKESOL[pokemonInfo.name] ??
    pokemonInfo.name.replace(/\(.+\)$/, (variant): string => {
      return POKEMON_VARIANT_PAMO3_TO_POKESOL[variant] ?? variant;
    });

  return [
    `${pokemonName} @ ${pokemonInfo.item ?? "ふめい"}`, // アイテム名は '[ぁ-んァ-ヶー]+' https://github.com/pokesoldev-group/pokesol-text-parser-ts/blob/80ac749def6a40ff13811fd4a0c09e382185a0da/src/grammar.peg#L15C26-L15C38
    `テラスタイプ: ${pokemonInfo.terastalType ?? ""}`,
    `特性: ${pokemonInfo.ability ?? ""}`,
    `性格: ${pokemonInfo.nature ?? ""}`,
    statsLine,
    pokemonInfo.moves.join(" / "),
  ].join("\n");
} // 画像ファイルを読み込む

export function loadFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = (err) => {
      reject(err);
    };
    reader.readAsDataURL(file);
  });
}

const BUFFS_TO_NATURE_JA: Record<string, string> = {
  "A+B-": "さみしがり",
  "A+C-": "いじっぱり",
  "A+D-": "やんちゃ",
  "A+S-": "ゆうかん",
  "B+A-": "ずぶとい",
  "B+C-": "わんぱく",
  "B+D-": "のうてんき",
  "B+S-": "のんき",
  "C+A-": "ひかえめ",
  "C+B-": "おっとり",
  "C+D-": "うっかりや",
  "C+S-": "れいせい",
  "D+A-": "おだやか",
  "D+B-": "おとなしい",
  "D+C-": "しんちょう",
  "D+S-": "なまいき",
  "S+A-": "おくびょう",
  "S+B-": "せっかち",
  "S+C-": "ようき",
  "S+D-": "むじゃき",
};

export function buffsToNature([upIndex, downIndex]: [number, number]): string {
  const up = STATS_KEYS[upIndex + 1];
  const down = STATS_KEYS[downIndex + 1];
  return BUFFS_TO_NATURE_JA[`${up}+${down}-`] ?? "まじめ";
}
