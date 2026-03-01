"use client";

import type { ReactNode } from "react";
import { useRef } from "react";

type MediaInlineEditorProps = {
  uploadAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
  fieldName: "avatar_file" | "cover_file";
  returnPath: string;
  hasImage: boolean;
  children: ReactNode;
  uploadLabel: string;
};

export function MediaInlineEditor({
  uploadAction,
  deleteAction,
  fieldName,
  returnPath,
  hasImage,
  children,
  uploadLabel
}: MediaInlineEditorProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative">
      <form action={uploadAction} ref={formRef}>
        <input type="hidden" name="return_path" value={returnPath} />
        <input
          ref={inputRef}
          type="file"
          name={fieldName}
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          onChange={() => formRef.current?.requestSubmit()}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="group relative block w-full text-left"
          aria-label={uploadLabel}
          title={uploadLabel}
        >
          {children}
          <span className="pointer-events-none absolute inset-0 flex items-end justify-center rounded-xl bg-black/0 p-2 text-xs font-semibold text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
            {uploadLabel}
          </span>
        </button>
      </form>
      {hasImage ? (
        <form action={deleteAction} className="absolute right-2 top-2">
          <input type="hidden" name="return_path" value={returnPath} />
          <button
            type="submit"
            className="rounded-full bg-white/95 px-2 py-1 text-[11px] font-semibold text-red-600 shadow"
            title="Delete image"
          >
            Delete
          </button>
        </form>
      ) : null}
    </div>
  );
}
