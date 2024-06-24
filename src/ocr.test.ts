import { test } from "vitest";
import { readImageToPokesolText } from "./ocr";
import image_07_ブリムオン from "../sample_data/07_ブリムオン.png";
import image_08_イエッサン from "../sample_data/08_イエッサン.png";

test("readImageToPokesolText", async ({ expect }) => {
  const tests = [
    ["07_ブリムオン", image_07_ブリムオン],
    ["08_イエッサン", image_08_イエッサン],
  ];

  for (const [name, image] of tests) {
    expect(
      await readImageToPokesolText(image, {
        setProgress: () => {},
      })
    ).toMatchSnapshot(name);
  }
});
