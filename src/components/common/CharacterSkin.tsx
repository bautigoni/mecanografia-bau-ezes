import { useEffect, useState, type ImgHTMLAttributes } from "react";
import { skinUrl, type SkinKind } from "../../utils/assets";
import { getSkinPhaseIndex } from "../../utils/progress";

/* The student's avatar / ship, drawn at the art PHASE unlocked by their
 * cumulative star total (see `getSkinPhaseIndex`): 0★→f1, 5★→f2, 10★→f3,
 * 20★→f4, 30★→f5.
 *
 * It stays live by listening to the same `edutic:progress` event the
 * StarCounter uses (plus the cross-tab `storage` event), so the character
 * "evolves" the instant a star total crosses a threshold — even mid-session.
 *
 * `tier` selects the evolution set (0 = base / `t1`). A future character
 * evolution just adds a tier in `assets.ts` (`skinTier(kind, "t2")`) and bumps
 * this prop; the phase logic is unchanged. Every other `<img>` attribute
 * (className, style, alt, loading…) is forwarded as-is. */
export function CharacterSkin({
  kind,
  tier = 0,
  ...imgProps
}: { kind: SkinKind; tier?: number } & ImgHTMLAttributes<HTMLImageElement>) {
  const [phase, setPhase] = useState(() => getSkinPhaseIndex());

  useEffect(() => {
    const update = () => setPhase(getSkinPhaseIndex());
    update(); // re-read on mount (route change / fresh login)
    window.addEventListener("edutic:progress", update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener("edutic:progress", update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return <img src={skinUrl(kind, phase, tier)} decoding="async" {...imgProps} />;
}
