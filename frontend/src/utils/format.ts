export function formatUnixSeconds(sec: number): string {
  if (sec == null || Number.isNaN(sec)) return '—';
  return new Date(sec * 1000).toLocaleString();
}
