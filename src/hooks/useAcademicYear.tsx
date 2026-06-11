import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type AcademicYear } from "../utils/api";

/* Lightweight context that:
   - loads the list of academic years for the actor's sede once per mount
   - persists the current selection in localStorage (per sede)
   - exposes `selectedId`, `setSelectedId`, `years`, and a forced `refresh()`
   - automatically falls back to the active year if nothing is selected
   - the listing endpoints don't yet filter by year, but the dashboard,
     the year selector and the wizard all read from this single source. */

const STORAGE_KEY = (sedeId: string) => `edutic_selected_academic_year_${sedeId}`;

interface Ctx {
  years: AcademicYear[];
  selectedId: string;
  setSelectedId: (id: string) => void;
  selected: AcademicYear | null;
  refresh: () => Promise<void>;
  loading: boolean;
}

const AcademicYearContext = createContext<Ctx | null>(null);

export function AcademicYearProvider({ sedeId, children }: { sedeId: string | null; children: ReactNode }) {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedId, setSelectedIdState] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!sedeId) { setYears([]); return; }
    setLoading(true);
    try {
      const list = await api.listAcademicYears(sedeId);
      setYears(list);
      // If nothing selected (or stale), fall back to the active year.
      const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY(sedeId)) : null;
      const storedOk = stored && list.some((y) => y.id === stored);
      if (!storedOk) {
        const active = list.find((y) => y.isActive);
        if (active) {
          setSelectedIdState(active.id);
          try { localStorage.setItem(STORAGE_KEY(sedeId), active.id); } catch { /* ignore */ }
        } else {
          setSelectedIdState(list[0]?.id ?? "");
        }
      }
    } catch { /* keep empty */ } finally { setLoading(false); }
  }, [sedeId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    if (sedeId) {
      try { localStorage.setItem(STORAGE_KEY(sedeId), id); } catch { /* ignore */ }
    }
  }, [sedeId]);

  const selected = useMemo(() => years.find((y) => y.id === selectedId) ?? null, [years, selectedId]);

  return (
    <AcademicYearContext.Provider value={{ years, selectedId, setSelectedId, selected, refresh, loading }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export function useAcademicYear() {
  const ctx = useContext(AcademicYearContext);
  if (!ctx) throw new Error("useAcademicYear must be used inside <AcademicYearProvider>");
  return ctx;
}
