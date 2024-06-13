import { useCallback, useEffect, useState } from "react";
import { readImageToPokesolText } from "./ocr.ts";
import { loadFileAsDataURL } from "./utils.ts";
import debugTargetImage from "../sample_data/1717307435926-0zOki0ySSM.webp";
import { DropzoneOptions, useDropzone } from "react-dropzone";
import clsx from "clsx";

const DropZone = ({
  onDropAccepted,
  children,
}: {
  onDropAccepted: NonNullable<DropzoneOptions["onDropAccepted"]>;
  children?: React.ReactNode;
}) => {
  const {
    getRootProps,
    getInputProps,
    open,
    isFocused,
    isDragAccept,
    isDragReject,
  } = useDropzone({
    noClick: true,
    noKeyboard: true,
    onDropAccepted,
  });

  return (
    <div
      className={clsx(
        "w-full bg-gray-100 p-3 flex flex-col items-center border-2 border-gray-300 border-dotted",
        {
          "border-gray-500": isFocused,
          "border-green-500": isDragAccept,
          "border-red-500": isDragReject,
        }
      )}
      contentEditable
      onBeforeInputCapture={(ev) => {
        ev.preventDefault();
      }}
      onCutCapture={(ev) => {
        ev.preventDefault();
      }}
      onPasteCapture={(ev) => {
        ev.preventDefault();
        onDropAccepted(
          [ev.clipboardData?.items[0].getAsFile()!],
          ev as unknown as any
        );
      }}
    >
      <div {...getRootProps()}>
        {children}
        <input {...getInputProps()} />
        <p className="my-4">
          ここにファイルをドロップ、貼り付け、
          <button
            onClick={open}
            className="text-blue-500 hover:text-blue-400 active:text-blue-700 underline"
          >
            ファイルを選択
          </button>
        </p>
      </div>
    </div>
  );
};

export default function App() {
  const [progress, setProgress] = useState<number>(0);
  const [result, setResult] = useState<string | null>(null);
  const [imageURL, setImageURL] = useState<string | null>(null);

  const onDropFiles = useCallback(async (files: File[]) => {
    const url = await loadFileAsDataURL(files[0]);
    setImageURL(url);
    const text = await readImageToPokesolText(url, { setProgress });
    setResult(text);
  }, []);

  useEffect(() => {
    return;
    (async () => {
      setImageURL(debugTargetImage);
      const text = await readImageToPokesolText(debugTargetImage, {
        setProgress,
      });
      setResult(text);
    })();
  }, []);

  return (
    <div id="app" className="">
      <div className="relative mb-5 overflow-hidden">
        <textarea
          className="block border-2 border-slate-300 rounded p-2 w-full"
          value={result ?? ""}
          rows={6}
          onFocus={(ev) => {
            ev.target.select();
          }}
        ></textarea>
        <div
          className={clsx(
            "bg-blue-300/60 absolute top-0 left-0 w-0 transition-all h-full pointer-events-none",
            {
              "opacity-0": progress >= 100,
              "animate-pulse": progress < 100,
            }
          )}
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <DropZone onDropAccepted={onDropFiles}>
        {imageURL && (
          <div className="my-6">
            <img src={imageURL} className="max-w-lg" />
          </div>
        )}
      </DropZone>
    </div>
  );
}
