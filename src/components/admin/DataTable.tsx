import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  /** Cell renderer; defaults to (row as any)[key]. */
  render?: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

/* Reusable glass data table (F1). Sticky header, hover rows, optional
   per-row actions and an empty state. Keep it dumb — pages own the data. */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  actions,
  empty = "Sin resultados.",
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
}) {
  return (
    <div className="glass-card-smooth rounded-2xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[40rem]">
          <thead>
            <tr className="bg-gradient-to-r from-accent-sky/10 via-white/45 to-accent/10 border-b border-white/60">
              {columns.map((c) => (
                <th
                  key={c.key}
                  className={`px-4 py-3 text-xs font-black uppercase tracking-wider text-muted whitespace-nowrap ${c.headerClassName ?? ""}`}
                >
                  {c.header}
                </th>
              ))}
              {actions ? <th className="px-4 py-3 w-px" aria-label="Acciones" /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (actions ? 1 : 0)} className="px-4 py-10 text-center text-muted font-semibold">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={getKey(row)}
                  className={`border-b border-white/30 last:border-0 odd:bg-white/15 transition-colors duration-150 hover:bg-accent-sky/10 ${onRowClick ? "cursor-pointer" : ""}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 text-sm text-text align-middle ${c.className ?? ""}`}>
                      {c.render ? c.render(row) : ((row as Record<string, unknown>)[c.key] as ReactNode)}
                    </td>
                  ))}
                  {actions ? (
                    <td className="px-4 py-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {actions(row)}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
