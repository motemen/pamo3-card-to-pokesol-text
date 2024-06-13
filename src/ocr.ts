import Tesseract, { createWorker } from "tesseract.js";
import cv from "@techstark/opencv-js";
import {
  squeezeTessaractResult,
  fixupPokemonName,
  PokemonInfo,
  toPokesolText,
} from "./utils";

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
  canvas.remove();
}

export async function readImageToPokesolText(
  imageURL: string,
  { setProgress }: { setProgress: (percentage: number) => void }
): Promise<string> {
  let progress = 0;

  setProgress(progress);

  const targetImage = await loadImageFromURL(imageURL);

  // copy targetImage
  const wipImage = targetImage.clone();

  const result: Record<string, string> = {};

  const progressDelta = 95 / Object.keys(PAMO3_CARD_TEXT_RECTS).length;

  // FIXME: pokemon_name は単タイプと複合タイプで位置が変わる
  for (const name of Object.keys(PAMO3_CARD_TEXT_RECTS)) {
    const { x, y, width, height } = PAMO3_CARD_TEXT_RECTS[name];
    const rectX = x * targetImage.cols;
    const rectY = y * targetImage.rows;
    const rectWidth = width * targetImage.cols;
    const rectHeight = height * targetImage.rows;

    progress += progressDelta;
    setProgress(progress);

    // 領域を切り取る
    const roi = targetImage.roi(
      new cv.Rect(rectX, rectY, rectWidth, rectHeight)
    );
    debugShowImage(roi, name);

    const text = await doOCR(roi, { numberOnly: /^[HABCDS]/.test(name) });
    console.log(name, text);
    result[name] = squeezeTessaractResult(text);

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
    name: pokemonName1 ?? pokemonName2 ?? result["pokemon_name1"],
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

  setProgress(100);

  return toPokesolText(pokemonInfo);
}

const cv$ = new Promise<void>((resolve) => {
  cv.onRuntimeInitialized = () => {
    console.log("onRuntimeInitialized");
    resolve();
  };
});

let _tessaractWorker: Tesseract.Worker | null = null;

function loadImageFromURL(url: string): Promise<cv.Mat> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = url;
    img.onload = () => {
      cv$.then(() => resolve(cv.imread(img)));
    };
    img.onerror = (err) => reject(err);
  });
}

async function doOCR(
  image: cv.Mat,
  options?: { numberOnly?: boolean }
): Promise<string> {
  console.log("doOCR");

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

  if (_tessaractWorker === null) {
    _tessaractWorker = await createWorker("jpn");
  }

  const worker = _tessaractWorker;
  await worker.setParameters({
    tessedit_pageseg_mode: Tesseract.PSM.SINGLE_WORD,
    tessedit_char_whitelist: numberOnly ? "0123456789" : "",
  });

  const {
    data: { text },
  } = await worker.recognize(canvas);

  return text;
}
