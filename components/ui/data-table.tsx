"use client";

// Reusable data table — the project-wide table look.
//   ┌───────────────────────────────────────────────┐
//   │ ◯  Col …                Actions (⟳)(🖨)(🗑)    │  header bar + toolbar
//   ├───────────────────────────────────────────────┤
//   │ ◯  cell …               (✎)(⊘) …               │  rows + circular actions
//   ├───────────────────────────────────────────────┤
//   │ Showing 1–10 of 24 items        ‹ Page 1/3 ›   │  footer + pagination
//   └───────────────────────────────────────────────┘
// Server pages pass plain data + (optionally) server actions; a thin client
// wrapper per table supplies the column/render/action functions.

import { Fragment, useMemo, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import {
  Printer,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

export type Column<T> = {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  /** td className */
  className?: string;
  /** th className */
  headClassName?: string;
  /** Column width (e.g. "16%" or "120px"). When any column sets a width the
   *  table switches to a fixed layout so widths are honored and gaps stay even. */
  width?: string;
};

export type RowAction<T> = {
  key: string;
  icon: ReactNode;
  label: string;
  href?: (row: T) => string;
  onClick?: (row: T) => void;
  variant?: "default" | "destructive";
  hidden?: (row: T) => boolean;
};

export type DataTableProps<T> = {
  rows: T[];
  columns: Column<T>[];
  getId: (row: T) => string;
  rowActions?: (row: T) => RowAction<T>[];
  /** Custom actions cell (e.g. an existing row-actions component that owns its
   *  own edit/delete dialogs). Takes precedence over rowActions. */
  actionsCell?: (row: T) => ReactNode;
  /** rows per page (default 10) */
  pageSize?: number;
  /** show the left selection column + bulk toolbar (default true) */
  selectable?: boolean;
  /** wired to a server action; receives the selected row ids */
  onBulkDelete?: (ids: string[]) => Promise<void> | void;
  /** override print (defaults to window.print) */
  onPrint?: () => void;
  emptyState?: ReactNode;
  /** noun for the footer count, e.g. "employees" (default "items") */
  itemNoun?: string;
  /** Width of the actions column when using fixed widths (e.g. "15rem"). */
  actionsWidth?: string;
  /** Min width for the (fixed-layout) table so it scrolls instead of squashing
   *  on narrow screens, e.g. "1180px". */
  tableMinWidth?: string;
  /** When provided, each row gets a leading chevron that expands a full-width
   *  panel beneath it rendering this content (e.g. a task's subtasks). */
  renderExpanded?: (row: T) => ReactNode;
};

export function DataTable<T>({
  rows,
  columns,
  getId,
  rowActions,
  actionsCell,
  pageSize = 10,
  selectable = true,
  onBulkDelete,
  onPrint,
  emptyState,
  itemNoun = "items",
  actionsWidth,
  tableMinWidth,
  renderExpanded,
}: DataTableProps<T>) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pending, startTransition] = useTransition();
  const expandable = Boolean(renderExpanded);

  const total = rows.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const start = total === 0 ? 0 : (current - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);
  const showingFrom = total === 0 ? 0 : start + 1;
  const showingTo = Math.min(start + pageSize, total);

  const allIds = useMemo(() => rows.map(getId), [rows, getId]);
  const allSelected = total > 0 && selected.size === total;
  const someSelected = selected.size > 0 && !allSelected;
  const headerState: boolean | "indeterminate" = allSelected
    ? true
    : someSelected
      ? "indeterminate"
      : false;

  const hasActions = Boolean(rowActions || actionsCell);
  const hasWidths = columns.some((c) => c.width) || Boolean(actionsWidth);
  const colSpan =
    columns.length +
    (selectable ? 1 : 0) +
    (hasActions ? 1 : 0) +
    (expandable ? 1 : 0);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function toggleAll(next: boolean) {
    setSelected(next ? new Set(allIds) : new Set());
  }
  function toggleRow(id: string, next: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (next) n.add(id);
      else n.delete(id);
      return n;
    });
  }

  function handlePrint() {
    if (onPrint) onPrint();
    else if (typeof window !== "undefined") window.print();
  }
  function handleBulkDelete() {
    if (!onBulkDelete || selected.size === 0) return;
    const ids = [...selected];
    startTransition(async () => {
      await onBulkDelete(ids);
      setSelected(new Set());
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-card/60">
      <div className="overflow-x-auto">
        <table
          className={cn(
            "app-table w-full caption-bottom text-sm",
            hasWidths && "table-fixed"
          )}
          style={
            hasWidths && tableMinWidth ? { minWidth: tableMinWidth } : undefined
          }
        >
          {hasWidths && (
            <colgroup>
              {selectable && <col style={{ width: "2.75rem" }} />}
              {expandable && <col style={{ width: "2.5rem" }} />}
              {columns.map((c) => (
                <col
                  key={c.key}
                  style={c.width ? { width: c.width } : undefined}
                />
              ))}
              {hasActions && (
                <col
                  style={actionsWidth ? { width: actionsWidth } : undefined}
                />
              )}
            </colgroup>
          )}
          <thead className="bg-[var(--table-head)]">
            <tr className="border-b border-border/70">
              {selectable && (
                <th className="w-10 px-3 py-3 align-middle">
                  <Checkbox
                    aria-label="Select all"
                    className="checkbox-round"
                    checked={headerState}
                    onCheckedChange={(v) => toggleAll(v === true)}
                  />
                </th>
              )}
              {expandable && <th className="w-10 px-1 py-3" aria-hidden />}
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={cn(
                    "px-4 py-3 text-left align-middle text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                    c.headClassName
                  )}
                >
                  {c.header}
                </th>
              ))}
              {hasActions && (
                <th className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-end gap-1.5 pr-4">
                    <span className="mr-1">Actions</span>
                    <ToolbarBtn title="Print" onClick={handlePrint}>
                      <Printer className="h-3.5 w-3.5" />
                    </ToolbarBtn>
                    {onBulkDelete && (
                      <ToolbarBtn
                        title={
                          selected.size
                            ? `Delete ${selected.size} selected`
                            : "Select rows to delete"
                        }
                        onClick={handleBulkDelete}
                        disabled={selected.size === 0 || pending}
                        destructive
                      >
                        {pending ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </ToolbarBtn>
                    )}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {total === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-16 text-center">
                  {emptyState ?? (
                    <p className="text-sm text-muted-foreground">
                      No {itemNoun} found.
                    </p>
                  )}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const id = getId(row);
                const isSel = selected.has(id);
                const actions = rowActions
                  ? rowActions(row).filter((a) => !a.hidden?.(row))
                  : [];
                const isExpanded = expanded.has(id);
                return (
                  <Fragment key={id}>
                  <tr
                    data-state={isSel ? "selected" : undefined}
                    className={cn(
                      "border-b border-border/60 transition-colors hover:bg-[var(--table-head)] data-[state=selected]:bg-primary/5",
                      !isExpanded && "last:border-0"
                    )}
                  >
                    {selectable && (
                      <td className="w-10 px-3 py-3 align-middle">
                        <Checkbox
                          aria-label="Select row"
                          className="checkbox-round"
                          checked={isSel}
                          onCheckedChange={(v) => toggleRow(id, v === true)}
                        />
                      </td>
                    )}
                    {expandable && (
                      <td className="w-10 px-1 py-3 align-middle">
                        <button
                          type="button"
                          aria-label={isExpanded ? "Collapse" : "Expand subtasks"}
                          onClick={() => toggleExpand(id)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <ChevronDown
                            className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-180"
                            )}
                          />
                        </button>
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn("px-4 py-3 align-middle", c.className)}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                    {hasActions && (
                      <td className="px-4 py-3 align-middle">
                        <div className="app-row-actions flex items-center justify-end gap-1.5 pr-4">
                          {actionsCell
                            ? actionsCell(row)
                            : actions.map((a) => {
                            const inner = (
                              <Button
                                variant="ghost"
                                size="icon"
                                title={a.label}
                                aria-label={a.label}
                                className={cn(
                                  "h-8 w-8 rounded-full",
                                  a.variant === "destructive" &&
                                    "text-destructive/70 hover:text-destructive"
                                )}
                                onClick={
                                  a.onClick ? () => a.onClick!(row) : undefined
                                }
                              >
                                {a.icon}
                              </Button>
                            );
                            return a.href ? (
                              <Link key={a.key} href={a.href(row)}>
                                {inner}
                              </Link>
                            ) : (
                              <span key={a.key}>{inner}</span>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                  {expandable && isExpanded && (
                    <tr className="border-b border-border/60 bg-muted/20 last:border-0">
                      <td colSpan={colSpan} className="px-4 pb-4 pt-1">
                        {renderExpanded!(row)}
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer — count + pagination */}
      <div className="flex flex-col gap-2 border-t border-border/70 px-4 py-2.5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          {total === 0
            ? `No ${itemNoun}`
            : `Showing ${showingFrom}–${showingTo} of ${total} ${itemNoun}`}
          {selected.size > 0 && (
            <span className="ml-2 text-foreground">· {selected.size} selected</span>
          )}
        </span>
        {pageCount > 1 && (
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full"
              disabled={current <= 1}
              onClick={() => setPage(current - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="tabular-nums">
              Page {current} of {pageCount}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 rounded-full"
              disabled={current >= pageCount}
              onClick={() => setPage(current + 1)}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolbarBtn({
  children,
  title,
  onClick,
  disabled,
  destructive,
}: {
  children: ReactNode;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-background/70 text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40",
        destructive && "text-destructive/80 hover:text-destructive"
      )}
    >
      {children}
    </button>
  );
}
