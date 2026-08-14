"use client";

import { useMemo, useRef } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";

interface SqlResultsTableProps {
  columns: string[];
  rows: unknown[][];
  truncated?: boolean;
  rowCount?: number;
}

export function SqlResultsTable({ columns, rows, truncated, rowCount }: SqlResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const parentRef = useRef<HTMLDivElement>(null);

  const tableCols = useMemo<ColumnDef<unknown[]>[]>(
    () =>
      columns.map((col, i) => ({
        id: col,
        accessorFn: (row: unknown[]) => row[i],
        header: col,
        size: 150,
      })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: tableCols,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const { rows: tableRows } = table.getRowModel();

  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 33,
    overscan: 20,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const paddingBottom =
    virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : 0;

  if (columns.length === 0) return null;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-1.5 bg-muted border-b border-border flex items-center gap-3 text-xs text-muted-foreground">
        <span>{rowCount?.toLocaleString() ?? rows.length.toLocaleString()} rows</span>
        <span>·</span>
        <span>{columns.length} columns</span>
        {truncated && (
          <>
            <span>·</span>
            <span className="text-amber-600 font-medium">Results truncated — increase limit to see more</span>
          </>
        )}
      </div>
      <div ref={parentRef} className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse" style={{ minWidth: columns.length * 150 }}>
          <thead className="sticky top-0 z-10 bg-muted border-b border-border">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                <th className="px-2 py-2 text-left text-muted-foreground font-mono w-10 border-r border-border">
                  #
                </th>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap cursor-pointer select-none hover:bg-muted border-r border-border last:border-r-0"
                    style={{ width: header.getSize() }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" ? (
                        <ChevronUp className="w-3 h-3 text-brand" />
                      ) : header.column.getIsSorted() === "desc" ? (
                        <ChevronDown className="w-3 h-3 text-brand" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 text-muted-foreground/60" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {paddingTop > 0 && (
              <tr>
                <td style={{ height: paddingTop }} />
              </tr>
            )}
            {virtualRows.map((vrow) => {
              const row = tableRows[vrow.index];
              return (
                <tr
                  key={row.id}
                  className="border-b border-border hover:bg-brand/10/40 transition-colors"
                >
                  <td className="px-2 py-1.5 text-muted-foreground/60 font-mono text-[10px] border-r border-border text-right">
                    {vrow.index + 1}
                  </td>
                  {row.getVisibleCells().map((cell) => {
                    const val = cell.getValue();
                    const display = val === null || val === undefined ? "" : String(val);
                    const isNull = val === null || val === undefined;
                    return (
                      <td
                        key={cell.id}
                        className="px-3 py-1.5 font-mono whitespace-nowrap border-r border-border last:border-r-0 max-w-[300px] overflow-hidden text-ellipsis"
                        title={display}
                      >
                        {isNull ? (
                          <span className="text-muted-foreground/60 italic">NULL</span>
                        ) : (
                          <span className="text-foreground">{display.length > 80 ? display.slice(0, 80) + "..." : display}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {paddingBottom > 0 && (
              <tr>
                <td style={{ height: paddingBottom }} />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
