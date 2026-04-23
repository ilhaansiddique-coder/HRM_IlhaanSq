"use client";

import { useCallback, useRef, useState } from "react";
import { ImagePlus, Loader2, UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  name: string;
  defaultValue?: string | null;
  disabled?: boolean;
  businessName?: string;
};

export function LogoDropzone({
  name,
  defaultValue,
  disabled,
  businessName,
}: Props) {
  const [url, setUrl] = useState<string>(defaultValue ?? "");
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
    if (file.size > 2 * 1024 * 1024) {
      setError("Logo too large (max 2MB).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload/business-logo", {
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
        throw new Error(
          payload?.error ||
            (res.status === 401 || res.status === 403
              ? "Only admins can change the logo."
              : `Upload failed (HTTP ${res.status}).`)
        );
      }
      if (!payload?.url) throw new Error("Server did not return a URL.");
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

  function clearLogo() {
    setUrl("");
    setError(null);
  }

  const hasLogo = Boolean(url);
  const initial = (businessName ?? "").trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={url} />
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/svg+xml"
        className="hidden"
        onChange={onFileInput}
        disabled={disabled || uploading}
      />

      <div className="flex items-start gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
          {hasLogo ? (
            <img
              src={url}
              alt="Business logo"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-2xl font-semibold text-muted-foreground">
              {initial}
            </span>
          )}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled && !uploading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={!hasLogo ? onBrowse : undefined}
          className={[
            "flex-1 rounded-lg border border-dashed px-4 py-3 transition-colors",
            hasLogo ? "" : "cursor-pointer",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-input bg-muted/30 hover:bg-muted/50",
            (disabled || uploading) && "pointer-events-none opacity-70",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {uploading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Uploading…
            </div>
          ) : hasLogo ? (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-muted-foreground">
                Logo uploaded. Appears on printed invoices.
              </p>
              <div className="flex gap-1 ml-auto">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onBrowse}
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={clearLogo}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="h-3.5 w-3.5" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm">
              <UploadCloud className="h-5 w-5 text-muted-foreground" />
              <span>
                <span className="font-medium">Click to upload</span>
                <span className="text-muted-foreground"> or drag &amp; drop</span>
              </span>
              <span className="ml-auto text-xs text-muted-foreground">
                PNG/JPG/WebP/SVG · up to 2MB
              </span>
            </div>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
