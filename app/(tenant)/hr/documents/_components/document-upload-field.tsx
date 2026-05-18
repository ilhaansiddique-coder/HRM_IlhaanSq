"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadHrDocumentAction } from "../../actions-phase2";

const ACCEPT =
  "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,image/jpeg,image/png,image/webp";
const MAX_BYTES = 15 * 1024 * 1024;

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Uploaded = { url: string; name: string; size: number; mime: string };

export function DocumentUploadField({ name = "fileUrl" }: { name?: string }) {
  const [file, setFile] = useState<Uploaded | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  const upload = useCallback(async (f: File) => {
    setError(null);
    if (f.size > MAX_BYTES) {
      setError("File too large (max 15MB).");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      startTransition(async () => {
        const result = await uploadHrDocumentAction(fd);
        setUploading(false);
        if (result.error) {
          setError(result.error);
        } else {
          setFile({ url: result.url, name: result.name, size: result.size, mime: result.mime });
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
      setUploading(false);
    }
  }, []);

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;
    const f = e.dataTransfer.files?.[0];
    if (f) void upload(f);
  }

  function onBrowse() {
    if (uploading) return;
    inputRef.current?.click();
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void upload(f);
    e.target.value = "";
  }

  function clearFile() {
    setFile(null);
    setError(null);
  }

  return (
    <div className="space-y-1.5">
      <input type="hidden" name={name} value={file?.url ?? ""} />
      <input type="hidden" name="mimeType" value={file?.mime ?? ""} />
      <input type="hidden" name="fileSize" value={file?.size ?? ""} />
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={onFileInput}
        disabled={uploading}
      />

      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-background/40 p-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
            <FileText className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{file.name}</p>
            <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0"
            onClick={onBrowse}
            title="Replace file"
          >
            <UploadCloud className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 shrink-0 text-destructive"
            onClick={clearFile}
            title="Remove file"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!uploading) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={onBrowse}
          className={[
            "flex h-28 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center transition-colors",
            dragOver
              ? "border-primary bg-primary/5"
              : "border-input bg-muted/30 hover:bg-muted/50",
            uploading && "pointer-events-none opacity-70",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              Uploading...
            </div>
          ) : (
            <>
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
              <div className="text-sm">
                <span className="font-medium text-foreground">Click to upload</span>
                <span className="text-muted-foreground"> or drag &amp; drop</span>
              </div>
              <div className="text-[10px] text-muted-foreground">
                PDF, Word, Excel, or image · up to 15MB
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
