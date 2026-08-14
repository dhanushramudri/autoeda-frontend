"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (value: unknown, row: T) => React.ReactNode;
  sortable?: boolean;
  align?: "left" | "right" | "center";
  className?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  rowKey?: keyof T | ((row: T) => string);
  className?: string;
  compact?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  rowKey,
  className,
  compact = false,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const sorted = sortKey
    ? [...data].sort((a, b) => {
        const av = a[sortKey] as string | number;
        const bv = b[sortKey] as string | number;
        if (av === null || av === undefined) return 1;
        if (bv === null || bv === undefined) return -1;
        const result = av < bv ? -1 : av > bv ? 1 : 0;
        return sortDir === "asc" ? result : -result;
      })
    : data;

  const getKey = (row: T, i: number): string => {
    if (!rowKey) return String(i);
    if (typeof rowKey === "function") return rowKey(row);
    return String(row[rowKey]);
  };

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm border-collapse data-table">
        <thead>
          <tr>
            {columns.map((col) => {
              const key = String(col.key);
              const isSorted = sortKey === key;
              return (
                <th
                  key={key}
                  onClick={() => col.sortable && handleSort(key)}
                  className={cn(
                    "px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap",
                    col.align === "right" && "text-right",
                    col.align === "center" && "text-center",
                    col.sortable && "cursor-pointer select-none hover:text-foreground hover:bg-muted",
                    compact && "py-1.5",
                    col.className
                  )}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span className="text-muted-foreground/60">
                        {isSorted ? (
                          sortDir === "asc" ? (
                            <ChevronUp className="w-3 h-3" />
                          ) : (
                            <ChevronDown className="w-3 h-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row, i) => (
            <tr key={getKey(row, i)} className="border-t border-border">
              {columns.map((col) => {
                const key = String(col.key);
                const val = row[key];
                return (
                  <td
                    key={key}
                    className={cn(
                      "px-4 py-2.5 text-foreground",
                      col.align === "right" && "text-right",
                      col.align === "center" && "text-center",
                      compact && "py-1.5 text-xs",
                      col.className
                    )}
                  >
                    {col.render ? col.render(val, row) : String(val ?? " -- ")}
                  </td>
                );
              })}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-8 text-center text-sm text-muted-foreground"
              >
                No data
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
