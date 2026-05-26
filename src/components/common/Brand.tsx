export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? "brand brand--compact" : "brand"}>
      <span className="brand__mark">T</span>
      <span className="brand__text">TYPELY</span>
    </div>
  );
}
