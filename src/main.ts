import "./style.css";
import Tesseract, { createWorker } from "tesseract.js";
import cv from "@techstark/opencv-js";
import terastalPNGPath from "../templates/terastal_mark.png";
import debugTargetImage from "../sample_data/1717307435926-0zOki0ySSM.webp";
import pokemon_names_ja from "../data/pokemon_names_ja.txt?raw";
import move_names_ja from "../data/move_names_ja.txt";

const POKEMON_NAMES_JA = pokemon_names_ja.trim().split("\n");

function fixupPokemonName(name: string): string | null {
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

const PAMO3_CARD_TEXT_RECTS: Record<
  string,
  { x: number; y: number; width: number; height: number }
> = {
  pokemon_name2: {
    x: 0.1652,
    y: 0.1429,
    width: 0.5302,
    height: 0.0714,
  },
  pokemon_name1: {
    // 単タイプ
    x: 0.1,
    y: 0.1429,
    width: 0.5954,
    height: 0.0714,
  },
  ability: {
    x: 0.0336,
    y: 0.2997,
    width: 0.4431,
    height: 0.0662,
  },
  move_1: {
    x: 0.1019,
    y: 0.4251,
    width: 0.2809,
    height: 0.061,
  },
  B_effort: {
    x: 0.8813,
    y: 0.5122,
    width: 0.0653,
    height: 0.0453,
  },
  H: {
    x: 0.7428,
    y: 0.3188,
    width: 0.0653,
    height: 0.0488,
  },
  H_effort: {
    x: 0.8813,
    y: 0.3188,
    width: 0.0653,
    height: 0.0488,
  },
  A: {
    x: 0.7428,
    y: 0.4146,
    width: 0.0653,
    height: 0.0488,
  },
  A_effort: {
    x: 0.8813,
    y: 0.4146,
    width: 0.0653,
    height: 0.0488,
  },
  B: {
    x: 0.7428,
    y: 0.5105,
    width: 0.0653,
    height: 0.047,
  },
  move_2: {
    x: 0.1019,
    y: 0.5575,
    width: 0.2809,
    height: 0.0523,
  },
  C: {
    x: 0.7428,
    y: 0.6045,
    width: 0.0653,
    height: 0.047,
  },
  C_effort: {
    x: 0.8813,
    y: 0.6063,
    width: 0.0653,
    height: 0.0453,
  },
  move_3: {
    x: 0.1019,
    y: 0.6794,
    width: 0.2809,
    height: 0.0575,
  },
  D: {
    x: 0.7428,
    y: 0.6986,
    width: 0.0653,
    height: 0.0488,
  },
  D_effort: {
    x: 0.8813,
    y: 0.7038,
    width: 0.0653,
    height: 0.0418,
  },
  move_4: {
    x: 0.1029,
    y: 0.8049,
    width: 0.2809,
    height: 0.054,
  },
  S: {
    x: 0.7428,
    y: 0.7944,
    width: 0.0653,
    height: 0.0453,
  },
  S_effort: {
    x: 0.8813,
    y: 0.7944,
    width: 0.0653,
    height: 0.0453,
  },
};

interface PokemonStats {
  H: number;
  A: number;
  B: number;
  C: number;
  D: number;
  S: number;
}

const STATS_KEYS = ["H", "A", "B", "C", "D", "S"] as (keyof PokemonStats)[];

interface PokemonInfo {
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

function toPokesolText(pokemonInfo: PokemonInfo): string {
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
}

function getContours(image: cv.Mat): [cv.MatVector, cv.Mat] {
  const gray = new cv.Mat();
  const blurred = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  // image[:, :, 3]
  const mats = new cv.MatVector();
  // cv.split(image, mats);
  //cv.imshow("yo", mats.get(3));

  cv.cvtColor(image, gray, cv.COLOR_RGBA2GRAY);
  cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
  cv.Canny(blurred, edges, 50, 150);

  cv.findContours(
    gray,
    contours,
    hierarchy,
    cv.RETR_CCOMP,
    cv.CHAIN_APPROX_SIMPLE
  );

  // 輪郭を描く
  for (let i = 0; i < contours.size(); i++) {
    const color = new cv.Scalar(0, 255, 0, 0);
    cv.drawContours(gray, contours, i, color, 1, cv.LINE_8, hierarchy, 100);
  }
  debugShowImage(gray);
  // cv.imshow("yo", gray);

  gray.delete();
  blurred.delete();
  edges.delete();

  return [contours, hierarchy];
}

function debugShowImage(image: cv.Mat, text?: string) {
  const canvas = document.createElement("canvas");
  cv.imshow(canvas, image);
  console.log(
    `%c${text ?? " "}`,
    `
    background: url(${canvas.toDataURL()});
    display: inline-block;
    padding-bottom: ${image.rows}px;
    padding-right: ${image.cols}px;
    background-repeat: no-repeat;
    `
  );
}

// 画像ファイルを選択したら読み込み、Tessaract.jsでOCRする

const SECOND_TYPE_MARK_COORDS = {
  x: 0.096,
  y: 0.123,
  width: 0.06,
  height: 0.11,
};

async function findCircles(image: cv.Mat) {
  const thresholded = new cv.Mat();

  // 輪郭検出

  cv.cvtColor(image, thresholded, cv.COLOR_RGBA2GRAY, cv.CV_8U);
  // cv.threshold(thresholded, thresholded, 100, 255, cv.THRESH_BINARY);
  debugShowImage(thresholded, "thresholded");

  /*
  const cc = new cv.Mat();
  cv.HoughCircles(
    thresholded,
    cc,
    cv.HOUGH_GRADIENT,
    1,
    20,
    100,
    50,
    0,
    image.cols / 10
  );
  console.log(cc);

  let dst = cv.Mat.zeros(thresholded.rows, thresholded.cols, cv.CV_8U);

  for (let i = 0; i < cc.cols; ++i) {
    let x = cc.data32F[i * 3];
    let y = cc.data32F[i * 3 + 1];
    let radius = cc.data32F[i * 3 + 2];
    let center = new cv.Point(x, y);
    cv.circle(dst, center, radius, new cv.Scalar(255, 0, 0));
    console.log(x, y, radius);
  }

  debugShowImage(dst, "circles");
  */

  // q: cv.Mat.roiでない方法で領域を切り出すには？
  // a: cv.Mat.roiを使うか、cv.getRectSubPixを使うか

  const roi = image.roi(new cv.Rect(0, 0, image.cols * 0.2, image.rows * 0.25));
  const roit = new cv.Mat();
  cv.threshold(roi, roit, 140, 255, cv.THRESH_BINARY);
  cv.cvtColor(roit, roit, cv.COLOR_RGBA2GRAY, cv.CV_8U);
  debugShowImage(roi, "roi");
  const cc = new cv.Mat();

  cv.HoughCircles(
    roit,
    cc,
    cv.HOUGH_GRADIENT,
    1,
    10,
    100,
    50,
    0,
    image.cols / 10
  );
  console.log(cc.cols);

  for (let i = 0; i < cc.cols; ++i) {
    let x = cc.data32F[i * 3];
    let y = cc.data32F[i * 3 + 1];
    let radius = cc.data32F[i * 3 + 2];
    let center = new cv.Point(x, y);
    cv.circle(roit, center, radius, new cv.Scalar(255, 0, 0, 0), 2);
    console.log(x, y, radius);
  }
  debugShowImage(roit, "circles2");
}

async function processImage(targetImage: cv.Mat) {
  cv.imshow("canvas", targetImage);

  const [templateContours] = await loadStaticImage(terastalPNGPath).then(
    getContours
  );

  findCircles(targetImage);

  // copy targetImage
  const wipImage = targetImage.clone();

  const result: Record<string, string> = {};

  // FIXME: pokemon_name は単タイプと複合タイプで位置が変わる
  for (const name of Object.keys(PAMO3_CARD_TEXT_RECTS)) {
    const { x, y, width, height } = PAMO3_CARD_TEXT_RECTS[name];
    const rectX = x * targetImage.cols;
    const rectY = y * targetImage.rows;
    const rectWidth = width * targetImage.cols;
    const rectHeight = height * targetImage.rows;

    // 領域を切り取る
    const roi = targetImage.roi(
      new cv.Rect(rectX, rectY, rectWidth, rectHeight)
    );
    debugShowImage(roi, name);

    const text = await doOCR(roi, { numberOnly: /^[HABCDS]/.test(name) });
    console.log(name, text);
    // TODO: "ば ぱ ば" などのように濁点・半濁点で混乱している場合の対応
    result[name] = text.replace(/ /g, "").trim();

    cv.rectangle(
      wipImage,
      new cv.Point(rectX, rectY),
      new cv.Point(rectX + rectWidth, rectY + rectHeight),
      new cv.Scalar(0, 255, 0, 0),
      2,
      cv.LINE_AA,
      0
    );
    cv.putText(
      wipImage,
      name,
      new cv.Point(rectX, rectY - 5),
      cv.FONT_HERSHEY_SIMPLEX,
      0.8,
      new cv.Scalar(0, 255, 0, 0),
      1
    );
  }

  debugShowImage(wipImage, "original");

  console.log(result);

  const pokemonName1 = fixupPokemonName(result["pokemon_name1"]);
  const pokemonName2 = fixupPokemonName(result["pokemon_name2"]);

  const pokemonInfo: PokemonInfo = {
    name: pokemonName1 ?? pokemonName2,
    ability: result["ability"],
    nature: null as unknown as string,
    terastalType: null as unknown as string,
    item: null as unknown as string,
    moves: [
      result["move_1"],
      result["move_2"],
      result["move_3"],
      result["move_4"],
    ],
    actualValues: {
      H: parseInt(result["H"]),
      A: parseInt(result["A"]),
      B: parseInt(result["B"]),
      C: parseInt(result["C"]),
      D: parseInt(result["D"]),
      S: parseInt(result["S"]),
    },
    effortValues: {
      H: parseInt(result["H_effort"]),
      A: parseInt(result["A_effort"]),
      B: parseInt(result["B_effort"]),
      C: parseInt(result["C_effort"]),
      D: parseInt(result["D_effort"]),
      S: parseInt(result["S_effort"]),
    },
  };

  document.getElementById("output")!.textContent = toPokesolText(pokemonInfo);

  return;

  cv.threshold(targetImage, targetImage, 140, 255, cv.THRESH_BINARY);

  debugShowImage(targetImage, "thresholded");

  const [contours, hierarchy] = getContours(targetImage);

  const d = cv.Mat.zeros(targetImage.rows, targetImage.cols, cv.CV_8UC3);

  for (let i = 0; i < contours.size(); ++i) {
    let color = new cv.Scalar(
      Math.round(Math.random() * 255),
      Math.round(Math.random() * 255),
      Math.round(Math.random() * 255)
    );
    cv.drawContours(d, contours, i, color, 1, cv.LINE_8, hierarchy, 100);
  }
  debugShowImage(d, "d");

  // contoursとtemplateContoursを比較して、一致するものを抽出する
  cv.imshow(canvas, targetImage);

  const d2 = cv.Mat.zeros(targetImage.rows, targetImage.cols, cv.CV_8UC3);

  for (let i = 0; i < contours.size(); i++) {
    const matchScore = cv.matchShapes(
      templateContours!.get(0),
      contours.get(i),
      cv.CONTOURS_MATCH_I1,
      0
    );

    if (matchScore < 0.1) {
      console.log(matchScore);

      // 一致度の閾値を設定（必要に応じて調整）

      const boundingRect = cv.boundingRect(contours.get(i));
      if (
        (boundingRect.height * boundingRect.width) /
          (targetImage.rows * targetImage.cols) <
        0.002
      ) {
        continue;
      }

      // 輪郭を描く
      const color = new cv.Scalar(
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255)
      );
      cv.drawContours(d2, contours, i, color, 3);

      // スコアも描く
      cv.putText(
        d2,
        matchScore.toFixed(2),
        new cv.Point(boundingRect.x, boundingRect.y),
        cv.FONT_HERSHEY_SIMPLEX,
        0.5,
        color,
        1
      );

      // cv.drawContours(d, templateContours!, 0, color, 3);

      //        const boundingRect = cv.boundingRect(contours.get(i));
      const ctx = canvas.getContext("2d")!;
      ctx.beginPath();
      ctx.rect(
        boundingRect.x,
        boundingRect.y,
        boundingRect.width,
        boundingRect.height
      );
      ctx.strokeStyle = "red";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  debugShowImage(d2);

  return;

  // 文字を見たいときはこれ
  cv.threshold(targetImage, targetImage, 180, 255, cv.THRESH_BINARY);

  //cv.cvtColor(img, img, cv.COLOR_RGBA2GRAY, 0);

  const cc = new cv.Mat();
  cv.HoughCircles(targetImage, cc, cv.HOUGH_GRADIENT, 1, 20, 100, 50, 0, 0);
  console.log(cc);

  let dst = cv.Mat.zeros(targetImage.rows, targetImage.cols, cv.CV_8U);

  for (let i = 0; i < cc.cols; ++i) {
    let x = cc.data32F[i * 3];
    let y = cc.data32F[i * 3 + 1];
    let radius = cc.data32F[i * 3 + 2];
    let center = new cv.Point(x, y);
    cv.circle(dst, center, radius, new cv.Scalar(255, 0, 0));
  }

  // cv.imshow(canvas, dst);

  // // 画像をOCR
  // const text = await ocr(canvas);
  // console.log(text);
}

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

async function loadStaticImage(path: string): Promise<cv.Mat> {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = path;
    img.onload = () => {
      resolve(cv.imread(img));
    };
  });
}

/*
const templateContoursPromise = new Promise<[cv.MatVector, cv.Mat]>(
  (resolve) => {
    const img = new Image();
    img.src = terastalPNGPath;
    img.onload = () => {
      const tmpl = cv.imread(img);

      // 輪郭抽出
      resolve(getContours(tmpl));
    };
  }
);
*/

addEventListener("load", () => {
  cv.onRuntimeInitialized = async () => {
    const target = await loadStaticImage(debugTargetImage);
    processImage(target);
  };
});

// ファイル選択ボタン
const fileInput = document.getElementById("fileInput") as HTMLInputElement;
fileInput.addEventListener("change", async (e) => {
  const file = (e.target! as HTMLInputElement).files![0];
  if (!file) return;

  // 画像ファイルを読み込む
  const image = await loadFileAsDataURL(file);
  if (!image) return;

  // キャンバスに描画する
  const ctx = canvas.getContext("2d")!;

  const imgElement = new Image();
  imgElement.src = image;
  imgElement.onload = async () => {
    // const [templateContours] = await templateContoursPromise;
    const templateImg = await loadStaticImage(terastalPNGPath);
    const [templateContours] = getContours(templateImg);

    const img = cv.imread(imgElement);
    processImage(img);
    return;

    cv.threshold(img, img, 140, 255, cv.THRESH_BINARY);
    // cv.imshow(canvas, img);

    const [contours, hierarchy] = getContours(img);

    let d = cv.Mat.zeros(img.rows, img.cols, cv.CV_8UC3);

    for (let i = 0; i < contours.size(); ++i) {
      let color = new cv.Scalar(
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255),
        Math.round(Math.random() * 255)
      );
      // cv.drawContours(d, contours, i, color, 1, cv.LINE_8, hierarchy, 100);
    }
    cv.imshow(canvas, d);

    // contoursとtemplateContoursを比較して、一致するものを抽出する
    cv.imshow(canvas, img);

    for (let i = 0; i < contours.size(); i++) {
      const matchScore = cv.matchShapes(
        templateContours!.get(0),
        contours.get(i),
        cv.CONTOURS_MATCH_I3,
        0
      );

      if (matchScore < 0.1) {
        console.log(matchScore);

        // 一致度の閾値を設定（必要に応じて調整）

        // 輪郭を描く
        const color = new cv.Scalar(
          Math.round(Math.random() * 255),
          Math.round(Math.random() * 255),
          Math.round(Math.random() * 255)
        );
        cv.drawContours(d, contours, i, color, 3);
        // スコアも描く
        const boundingRect = cv.boundingRect(contours.get(i));
        cv.putText(
          d,
          matchScore.toFixed(2),
          new cv.Point(boundingRect.x, boundingRect.y),
          cv.FONT_HERSHEY_SIMPLEX,
          0.5,
          color,
          1
        );

        // cv.drawContours(d, templateContours!, 0, color, 3);

        //        const boundingRect = cv.boundingRect(contours.get(i));
        ctx.beginPath();
        ctx.rect(
          boundingRect.x,
          boundingRect.y,
          boundingRect.width,
          boundingRect.height
        );
        ctx.strokeStyle = "red";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    cv.imshow(canvas, d);

    return;

    // 文字を見たいときはこれ
    cv.threshold(img, img, 180, 255, cv.THRESH_BINARY);

    //cv.cvtColor(img, img, cv.COLOR_RGBA2GRAY, 0);

    const cc = new cv.Mat();
    cv.HoughCircles(img, cc, cv.HOUGH_GRADIENT, 1, 20, 100, 50, 0, 0);
    console.log(cc);

    let dst = cv.Mat.zeros(img.rows, img.cols, cv.CV_8U);

    for (let i = 0; i < cc.cols; ++i) {
      let x = cc.data32F[i * 3];
      let y = cc.data32F[i * 3 + 1];
      let radius = cc.data32F[i * 3 + 2];
      let center = new cv.Point(x, y);
      cv.circle(dst, center, radius, new cv.Scalar(255, 0, 0));
    }

    // cv.imshow(canvas, dst);

    // // 画像をOCR
    // const text = await ocr(canvas);
    // console.log(text);
  };
});

let _worker: Tesseract.Worker | null = null;

// 画像ファイルを読み込む
function loadFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.readAsDataURL(file);
  });
}

async function doOCR(
  image: cv.Mat,
  options?: { numberOnly?: boolean }
): Promise<string> {
  const canvas = document.createElement("canvas");

  // 周囲に10pxの黒の余白を追加
  const padded = new cv.Mat();
  cv.copyMakeBorder(
    image,
    padded,
    10,
    10,
    10,
    10,
    cv.BORDER_CONSTANT,
    new cv.Scalar(0, 0, 0, 0)
  );
  cv.threshold(padded, padded, 140, 255, cv.THRESH_BINARY);

  cv.imshow(canvas, padded);
  debugShowImage(padded);

  const numberOnly = options?.numberOnly ?? false;

  if (_worker === null) {
    _worker = await createWorker("jpn");
  }

  const worker = _worker;
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
    tessedit_char_whitelist: numberOnly ? "0123456789" : "",
  });
  const {
    data: { text },
  } = await worker.recognize(canvas);

  return text;
}
