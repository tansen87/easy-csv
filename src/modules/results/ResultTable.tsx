import React, { useMemo } from "react";

import { cn } from "@/lib/utils";
import { numericColumns } from "@/modules/results/lib/resultTable";

interface ResultTableProps {
  headers: string[];
  rows: string[][];
}

/**
 * The result ledger (design 084).
 *
 * One strong rule under the head, hairlines between rows, no vertical rules: a
 * grid of boxes reads as a spreadsheet, ruled rows read as a statement. Numbers
 * are right aligned in tabular figures so decimals line up; blank cells get a
 * short hairline instead of nothing, because an empty square cannot tell
 * "empty value" from "not loaded".
 */
export const ResultTable = React.memo(function ResultTable({
  headers,
  rows,
}: ResultTableProps) {
  const numeric = useMemo(
    () => numericColumns(rows, headers.length),
    [rows, headers.length],
  );

  return (
    <table className="result-ledger w-full border-separate border-spacing-0 text-[13px]">
      <thead>
        <tr>
          <th
            scope="col"
            className="sticky left-0 top-0 z-20 h-8 w-11 bg-background px-2 text-right font-mono text-[10.5px] font-normal tabular-nums text-muted-foreground/60"
          >
            #
          </th>
          {headers.map((header, index) => (
            <th
              key={`${header}-${index}`}
              scope="col"
              className={cn(
                "sticky top-0 z-10 h-8 whitespace-nowrap bg-background px-3 text-[11px] font-medium text-muted-foreground",
                numeric[index] ? "text-right" : "text-left",
              )}
              title={header}
            >
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            <td className="sticky left-0 z-10 h-[30px] w-11 bg-background px-2 text-right font-mono text-[10.5px] tabular-nums text-muted-foreground/50">
              {rowIndex + 1}
            </td>
            {headers.map((_, cellIndex) => {
              const raw = row[cellIndex] ?? "";
              const value = raw.trim();
              return (
                <td
                  key={cellIndex}
                  className={cn(
                    "h-[30px] max-w-[320px] truncate whitespace-nowrap px-3",
                    numeric[cellIndex] &&
                      "text-right font-mono text-[12.5px] tabular-nums text-foreground",
                  )}
                  title={value === "" ? undefined : raw}
                >
                  {value === "" ? (
                    <span
                      className="inline-block h-px w-3 align-middle bg-foreground/25"
                      aria-hidden="true"
                    />
                  ) : (
                    raw
                  )}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
});
