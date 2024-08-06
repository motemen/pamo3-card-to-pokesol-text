import Tesseract, { createWorker } from "tesseract.js";
import cv from "@techstark/opencv-js";
import {
  squeezeTessaractResult,
  fixupPokemonName,
  fixupAbility,
  fixupMoveName,
  PokemonInfo,
  toPokesolText,
  buffsToNature,
} from "./utils";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PAMO3_CARD_TEXT_RECTS: Record<string, Rect> = {
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

const PAMO3_CARD_NATURE_MARKER_RECT: Rect = {
  x: 0.636,
  // y: 0.306,
  y: 0.401,
  width: 0.035,
  // height: 0.57,
  height: 0.47,
};

const PAMO3_CARD_TERASTAL_ICON_RECT: Rect = {
  x: 0.905,
  y: 0.11,
  width: 0.06,
  height: 0.125,
};

const TERASTAL_COLORS = {
  フェアリー: [237, 163, 237],
  どく: [183, 123, 215],
  ノーマル: [189, 194, 197],
  はがね: [150, 190, 204],
  エスパー: [242, 134, 180],
  みず: [90, 174, 251],
  ひこう: [147, 197, 236],
  じめん: [76, 62, 45],
  こおり: [97, 212, 251],
  ドラゴン: [49, 79, 136],
  でんき: [248, 206, 56],
  ほのお: [168, 73, 62],
};

function debugShowImage(image: cv.Mat, text?: string) {
  return;

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
  // canvas.remove();
  document.body.appendChild(canvas);
}

export async function extractAndDrawSquareIcons(
  src: cv.Mat,
  logImage?: (image: cv.Mat) => Promise<void>
) {
  const dst = new cv.Mat();

  // グレースケールに変換
  cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
  // await logImage?.(dst);

  // エッジ検出（Canny法）
  cv.Canny(dst, dst, 100, 200, 3);
  // await logImage?.(dst);

  // モルフォロジー変換
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));
  cv.dilate(dst, dst, kernel);
  // await logImage?.(dst);

  // 輪郭を見つける
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  cv.findContours(
    dst,
    contours,
    hierarchy,
    cv.RETR_TREE,
    cv.CHAIN_APPROX_SIMPLE
  );

  const squareIcons = [];

  // 各輪郭をチェック
  for (let i = 0; i < contours.size(); ++i) {
    const cnt = contours.get(i);
    const rect = cv.boundingRect(cnt);

    // 正方形に近い形状かチェック（幅と高さの比率が0.9~1.1の範囲内）
    if (
      rect.width > src.rows / 15 &&
      rect.height > src.rows / 15 && // 小さすぎる領域を除外
      rect.x < src.cols / 10 &&
      Math.abs(rect.width / rect.height - 1) < 0.05
    ) {
      // 輪郭を近似
      const peri = cv.arcLength(cnt, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(cnt, approx, 0.04 * peri, true);

      // 近似後の頂点数が4つ（正方形）の場合
      if (approx.rows == 4) {
        squareIcons.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });

        // 正方形を描画
        const color = new cv.Scalar(255, 0, 0, 255); // 赤色
        const thickness = 2;
        const point1 = new cv.Point(rect.x, rect.y);
        const point2 = new cv.Point(rect.x + rect.width, rect.y + rect.height);
        cv.rectangle(src, point1, point2, color, thickness);
      }
      approx.delete();
    }
  }

  // それはそれとして、性格マーカー検出領域も描画してみる
  const natureMarkerRect = new cv.Rect(
    PAMO3_CARD_NATURE_MARKER_RECT.x * src.cols,
    PAMO3_CARD_NATURE_MARKER_RECT.y * src.rows,
    PAMO3_CARD_NATURE_MARKER_RECT.width * src.cols,
    PAMO3_CARD_NATURE_MARKER_RECT.height * src.rows
  );
  cv.rectangle(
    src,
    new cv.Point(natureMarkerRect.x, natureMarkerRect.y),
    new cv.Point(
      natureMarkerRect.x + natureMarkerRect.width,
      natureMarkerRect.y + natureMarkerRect.height
    ),
    new cv.Scalar(0, 255, 0, 0),
    2,
    cv.LINE_AA
  );

  // 描画結果を表示
  await logImage?.(src);
  // cv.imshow('canvasOutput', src);

  // メモリ解放
  dst.delete();
  contours.delete();
  hierarchy.delete();

  return squareIcons;
}

export async function detectSquareEdges(image: cv.Mat) {
  const src = image.clone();
  const dst = cv.Mat.zeros(src.rows, src.cols, cv.CV_8UC3);
  const lines = new cv.Mat();
  const gray = new cv.Mat();
  const edges = new cv.Mat();

  // グレースケール変換
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

  // エッジ検出
  cv.Canny(gray, edges, 50, 200, 3);

  // 確率的ハフ変換で直線検出
  cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, 50, 10);

  // 検出された直線を描画
  for (let i = 0; i < lines.rows; ++i) {
    let startPoint = new cv.Point(
      lines.data32S[i * 4],
      lines.data32S[i * 4 + 1]
    );
    let endPoint = new cv.Point(
      lines.data32S[i * 4 + 2],
      lines.data32S[i * 4 + 3]
    );
    cv.line(dst, startPoint, endPoint, [255, 0, 0, 255], 3);

    // console.log(startPoint, endPoint);
  }

  // 結果を表示
  // cv.imshow("canvasOutput", dst);

  // メモリ解放
  src.delete();
  // dst.delete();
  lines.delete();
  gray.delete();
  edges.delete();

  return dst;
}

export async function readImageToPokesolText(
  imageURL: string,
  { setProgress }: { setProgress: (percentage: number) => void } = {
    setProgress: () => {},
  }
): Promise<string> {
  let progress = 0;

  setProgress(progress);

  const targetImage = await loadImageFromURL(imageURL);

  // copy targetImage
  const wipImage = targetImage.clone();

  const terastalIcon = targetImage.roi(
    new cv.Rect(
      PAMO3_CARD_TERASTAL_ICON_RECT.x * targetImage.cols,
      PAMO3_CARD_TERASTAL_ICON_RECT.y * targetImage.rows,
      PAMO3_CARD_TERASTAL_ICON_RECT.width * targetImage.cols,
      PAMO3_CARD_TERASTAL_ICON_RECT.height * targetImage.rows
    )
  );
  debugShowImage(terastalIcon, "terastalIcon");

  const pixels = new cv.Mat();
  terastalIcon.convertTo(pixels, cv.CV_32F);

  const samples = [];
  for (let row = 0; row < pixels.rows; row++) {
    for (let col = 0; col < pixels.cols; col++) {
      const pixel = pixels.floatPtr(row, col);
      samples.push([pixel[0], pixel[1], pixel[2]]);
    }
  }
  const samplesMat = cv.matFromArray(
    samples.length,
    3,
    cv.CV_32F,
    samples.flat()
  );

  const K = 2;
  const attemps = 10;
  const labels = new cv.Mat();
  const centers = new cv.Mat();
  cv.kmeans(
    samplesMat,
    K,
    labels,
    new cv.TermCriteria(
      cv.TermCriteria_EPS + cv.TermCriteria_MAX_ITER,
      100,
      0.1
    ),
    attemps,
    2, // KMEANS_PP_CENTERS
    centers
  );

  // 最も頻出するラベル（代表色）を見つける
  let counts = new Array(K).fill(0);
  for (let i = 0; i < labels.rows; i++) {
    counts[labels.data32S[i]]++;
  }

  let dominantColorIndex = counts.indexOf(Math.max(...counts));
  let dominantColor = {
    r: Math.round(centers.data32F[dominantColorIndex * 3]),
    g: Math.round(centers.data32F[dominantColorIndex * 3 + 1]),
    b: Math.round(centers.data32F[dominantColorIndex * 3 + 2]),
  };

  console.log("代表色:", [dominantColor.r, dominantColor.g, dominantColor.b]);

  console.log(
    `%cテラス色`,
    `background-color: rgb(${dominantColor.r}, ${dominantColor.g}, ${dominantColor.b}); color: white; padding: 0.5em;`
  );

  const natureMarker = targetImage.roi(
    new cv.Rect(
      PAMO3_CARD_NATURE_MARKER_RECT.x * targetImage.cols,
      PAMO3_CARD_NATURE_MARKER_RECT.y * targetImage.rows,
      PAMO3_CARD_NATURE_MARKER_RECT.width * targetImage.cols,
      PAMO3_CARD_NATURE_MARKER_RECT.height * targetImage.rows
    )
  );
  debugShowImage(natureMarker, "natureMarker");

  const natureMarkerThreshold = new cv.Mat();
  cv.cvtColor(natureMarker, natureMarkerThreshold, cv.COLOR_RGBA2RGB);
  cv.threshold(
    natureMarkerThreshold,
    natureMarkerThreshold,
    180,
    255,
    cv.THRESH_BINARY
  );

  debugShowImage(natureMarkerThreshold, "natureMarkerThreshold");

  let natureBuffs: [number, number] = [-1, -1];
  const buffRanges = [
    [
      [255, 0, 0],
      [255, 255, 0],
    ],
    [
      [0, 0, 255],
      [0, 255, 255],
    ],
  ];
  buffRanges.forEach(([lower, upper], i) => {
    const mat = new cv.Mat();
    cv.inRange(
      natureMarkerThreshold,
      cv.matFromArray(1, 3, cv.CV_8UC3, lower),
      cv.matFromArray(1, 3, cv.CV_8UC3, upper),
      mat
    );
    debugShowImage(mat, "mat");

    for (let r = 0; r < mat.rows; r++) {
      const row = mat.row(r);
      if (row.data.some((v) => v !== 0)) {
        natureBuffs[i] = Math.floor((r * 5) / mat.rows);
        break;
      }
    }

    mat.delete();
  });

  const result: Record<string, string> = {};

  result["nature"] = buffsToNature(natureBuffs);

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
    ability: fixupAbility(result["ability"]),
    nature: result["nature"],
    terastalType: null as unknown as string,
    item: null as unknown as string,
    moves: [
      result["move_1"],
      result["move_2"],
      result["move_3"],
      result["move_4"],
    ].map((moveName) => fixupMoveName(moveName)),
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
    resolve();
  };
});

let _tessaractWorker: Tesseract.Worker | null = null;

export function loadImageFromURL(url: string): Promise<cv.Mat> {
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
