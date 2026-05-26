export function Toast({ message }: { message: string }) {
  if (!message) return null;

  return <div className="toast select-none">{message}</div>;
}
