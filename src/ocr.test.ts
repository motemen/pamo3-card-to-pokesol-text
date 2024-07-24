import { test } from "vitest";
import { readImageToPokesolText } from "./ocr";

const files = import.meta.glob(
  ["../sample_data/*.png", "../sample_data/*.webp"],
  {
    import: "default",
    eager: true,
  }
);

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
