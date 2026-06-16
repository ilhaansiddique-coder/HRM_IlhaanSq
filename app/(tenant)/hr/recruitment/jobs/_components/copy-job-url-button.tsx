"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export function CopyJobUrlButton({ jobId }: { jobId: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${BASE_URL}/careers/${jobId}`;

  function handleCopy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 rounded-full"
      title="Copy landing page URL"
      onClick={handleCopy}
    >
      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}
