import { test } from "vitest";
import {
  extractAndDrawSquareIcons,
  fixupAbility,
  fixupMoveName,
  loadImageFromURL,
  readImageToPokesolText,
} from "./ocr";
import cv from "@techstark/opencv-js";
import { render } from "@testing-library/react";
import { useState } from "react";

const files = import.meta.glob(
  ["../sample_data/*.png", "../sample_data/*.webp"],
  {
    import: "default",
    eager: true,
  }
);

const createCanvas = (name?: string): Promise<HTMLElement> => {
  return new Promise((resolve) => {
    const Canvas = ({ name }: { name?: string }) => {
      const [zoom, setZoom] = useState(0.25);

      return (
        <figure
          onClick={() => setZoom(zoom === 0.25 ? 1 : 0.25)}
          style={{ cursor: "pointer" }}
        >
          <canvas ref={(ref) => ref && resolve(ref)} style={{ zoom }}></canvas>
          {name && <figcaption style={{ fontSize: "10px" }}>{name}</figcaption>}
        </figure>
      );
    };
    render(<Canvas name={name} />);
  });
};

test("extractAndDrawSquareIcons", async ({ expect }) => {
  for (const name of Object.keys(files).sort()) {
    const image = await loadImageFromURL(files[name] as string);
    const squares = await extractAndDrawSquareIcons(image, async (logImg) => {
      cv.imshow(await createCanvas(name), logImg);
    });
    expect(squares.length).toBeGreaterThan(0);

    // 相対位置をログ
    console.log(
      squares.map(({ x, y, width, height }) => [
        x / image.cols,
        y / image.rows,
        width / image.cols,
        height / image.rows,
      ])
    );

    image.delete();
  }
});

test(
  "readImageToPokesolText",
  {
    timeout: 60000,
  },
  async ({ expect }) => {
    for (const name of Object.keys(files).sort()) {
      expect(
        await readImageToPokesolText(files[name] as string)
      ).toMatchSnapshot(name.split("/").pop());
    }
  }
);

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
