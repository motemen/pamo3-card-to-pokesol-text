import { test } from "vitest";
import {
  extractAndDrawSquareIcons,
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
      const [zoomed, setZoomed] = useState(false);

      return (
        <figure
          onClick={() => setZoomed(!zoomed)}
          style={{ cursor: "pointer" }}
        >
          <canvas
            ref={(ref) => ref && resolve(ref)}
            style={{ maxWidth: zoomed ? 800 : 400 }}
          ></canvas>
          {name && <figcaption style={{ fontSize: "10px" }}>{name}</figcaption>}
        </figure>
      );
    };
    render(<Canvas name={name} />);
  });
};

test.skip("extractAndDrawSquareIcons", async ({ expect }) => {
  const averages = [];
  for (const name of Object.keys(files).sort()) {
    const image = await loadImageFromURL(files[name] as string);
    const squares = await extractAndDrawSquareIcons(image, async (logImg) => {
      cv.imshow(await createCanvas(name), logImg);
    });
    expect(squares.length).toBeGreaterThan(0);

    const pts = squares.map(({ x, y, width, height }) => [
      (x / image.cols) * 100,
      (y / image.rows) * 100,
      (width / image.cols) * 100,
      (height / image.rows) * 100,
    ]);

    // 相対位置をログ
    console.log(name, [
      pts.map(([x]) => x).reduce((a, b) => a + b) / pts.length,
      pts.map(([, , width]) => width).reduce((a, b) => a + b) / pts.length,
      pts.map(([, , , height]) => height).reduce((a, b) => a + b) / pts.length,
    ]);

    const cluster =
      name.match(/\/([a-z])_/)![1].charCodeAt(0) - "a".charCodeAt(0);
    averages.push([
      [
        pts.map(([x]) => x).reduce((a, b) => a + b) / pts.length,
        pts.map(([, , width]) => width).reduce((a, b) => a + b) / pts.length,
        pts.map(([, , , height]) => height).reduce((a, b) => a + b) /
          pts.length,
      ],
      cluster,
    ]);

    image.delete();
  }

  console.log(JSON.stringify(averages));
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
