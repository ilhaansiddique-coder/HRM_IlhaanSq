"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  name: string;
  defaultValue?: string | null;
  disabled?: boolean;
  onChangeUrl?: (url: string) => void;
};

export function ImageDropzone({
  name,
  defaultValue,
  disabled,
  onChangeUrl,
}: Props) {
  const [url, setUrlState] = useState<string>(defaultValue ?? "");
  const setUrl = useCallback(
    (next: string) => {
      setUrlState(next);
      onChangeUrl?.(next);
    },
    [onChangeUrl]
  );
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async (file: File) => {
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Image too large (max 5MB).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/product-image", {
        method: "POST",
        body: fd,
      });

      const text = await res.text();
      let payload: { url?: string; error?: string } | null = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }

      if (!res.ok) {
        const reason =
          payload?.error ||
          (res.status === 401 || res.status === 403
            ? "Not authorized — please sign in again."
            : res.status === 413
              ? "File is too large."
              : `Upload failed (HTTP ${res.status}).`);
        throw new Error(reason);
      }
      if (!payload?.url) {
        throw new Error("Server did not return an image URL.");
      }
      setUrl(payload.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, []);

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) void upload(file);
  }

  function onBrowse() {
    if (disabled || uploading) return;
    inputRef.current?.click();
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
  }

  function clearImage() {
    setUrl("");
    setError(null);
  }

  const hasImage = Boolean(url);

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={onFileInput}
        disabled={disabled || uploading}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !uploading) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={hasImage ? undefined : onBrowse}
        className={[
          "relative flex items-center justify-center rounded-lg border border-dashed transition-colors",
          hasImage ? "h-40 p-2" : "h-36 cursor-pointer p-4",
          dragOver
            ? "border-primary bg-primary/5"
            : "border-input bg-muted/30 hover:bg-muted/50",
          (disabled || uploading) && "pointer-events-none opacity-70",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading...
          </div>
        ) : hasImage ? (
          <>
            <img
              src={url}
              alt="Product preview"
              className="h-full w-auto rounded object-contain"
            />
            <div className="absolute right-2 top-2 flex gap-1">
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="h-7 w-7"
                onClick={onBrowse}
                title="Replace image"
              >
                <ImagePlus className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="h-7 w-7"
                onClick={clearImage}
                title="Remove image"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <UploadCloud className="h-6 w-6 text-muted-foreground" />
            <div className="text-sm">
              <span className="font-medium text-foreground">Click to upload</span>
              <span className="text-muted-foreground"> or drag & drop</span>
            </div>
            <div className="text-xs text-muted-foreground">
              JPG, PNG, WebP, or GIF · up to 5MB
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
