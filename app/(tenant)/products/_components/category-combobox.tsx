"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Plus, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { deriveCategoryCode } from "@/lib/sku";

export type CategoryValue = {
  code: string;
  label: string;
  isNew: boolean;
};

type CategoryOption = {
  id: string;
  code: string;
  label: string;
};

type Props = {
  value: CategoryValue | null;
  onChange: (v: CategoryValue | null) => void;
  disabled?: boolean;
};

function deriveCodePreview(label: string): string {
  return deriveCategoryCode(label);
}

async function fetchCategories(): Promise<CategoryOption[]> {
  const res = await fetch("/api/products/categories");
  const data = await res.json();
  return Array.isArray(data?.categories) ? data.categories : [];
}

export function CategoryCombobox({ value, onChange, disabled }: Props) {
  const [query, setQuery] = useState<string>(value?.label ?? "");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: options = [], isLoading: loading } = useQuery({
    queryKey: ["product-categories"],
    queryFn: fetchCategories,
  });

  useEffect(() => {
    setQuery(value?.label ?? "");
  }, [value?.label]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const trimmed = query.trim();
  const filtered = useMemo(() => {
    const q = trimmed.toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.code.toLowerCase().includes(q)
    );
  }, [options, trimmed]);

  const exactMatch = options.find(
    (o) => o.label.toLowerCase() === trimmed.toLowerCase()
  );
  const canCreate = trimmed.length >= 2 && !exactMatch;

  function pick(o: CategoryOption) {
    onChange({ code: o.code, label: o.label, isNew: false });
    setQuery(o.label);
    setOpen(false);
  }

  function createNew() {
    if (!canCreate) return;
    onChange({
      code: deriveCodePreview(trimmed),
      label: trimmed,
      isNew: true,
    });
    setQuery(trimmed);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (exactMatch) pick(exactMatch);
      else if (canCreate) createNew();
    } else if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "ArrowDown") {
      setOpen(true);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (value && e.target.value !== value.label) onChange(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="e.g., T-Shirt"
          autoComplete="off"
        />
        <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-64 overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-muted-foreground">Loading…</div>
          )}
          {!loading && filtered.length === 0 && !canCreate && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Type at least 2 characters to create a category.
            </div>
          )}
          {filtered.map((o) => (
            <button
              type="button"
              key={o.id}
              onClick={() => pick(o)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-accent"
            >
              <span>{o.label}</span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">
                  {o.code}
                </span>
                {value?.code === o.code && !value.isNew && (
                  <Check className="h-3.5 w-3.5" />
                )}
              </span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={createNew}
              className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm hover:bg-accent"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                Create <span className="font-medium">{trimmed}</span>
              </span>
              <span className="ml-auto font-mono text-xs text-muted-foreground">
                {deriveCodePreview(trimmed)}
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
