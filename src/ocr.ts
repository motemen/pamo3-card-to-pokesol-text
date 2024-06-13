import Tesseract, { createWorker } from "tesseract.js";
import cv from "@techstark/opencv-js";
import terastalPNGPath from "../templates/terastal_mark.png";
import {
  squeezeTessaractResult,
  fixupPokemonName,
  PokemonInfo,
  toPokesolText,
} from "./utils";

function setProgress(percentage: number): void {
  console.log(percentage);

  return;

  const progressBar = document.getElementById("progress")!;
  if (!progressBar) return;
  progressBar.style.width = `${percentage}%`;
  if (percentage === 0) {
    progressBar.classList.remove("opacity-0");
    progressBar.classList.add("animate-pulse");
  } else if (percentage >= 100) {
    progressBar.classList.remove("animate-pulse");
    setTimeout(() => {
      progressBar.classList.add("opacity-0");
    }, 500);
  }
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
  canvas.remove();
}

// 画像ファイルを選択したら読み込み、Tessaract.jsでOCRする

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
