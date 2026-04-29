// Shared formatting helpers. Keep pure + dependency-free so they can be
// imported from any component or service without coupling.

/**
 * Render a confidence score as a clamped percent string (TR locale: `%NN`).
 *
 * Backends are inconsistent — some return 0-1 (`0.95`), others return 0-100
 * (`95`). This helper normalises both and clamps to [0, 100]. Originally
 * introduced for ADIM 1 / TR5 where Trends forecast card showed `9500%` when
 * the backend sent a 0-100 value that the UI multiplied by 100 again.
 */
export function formatConfidence(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '%0';
  const normalized = value > 1 ? value : value * 100;
  const clamped = Math.min(100, Math.max(0, Math.round(normalized)));
  return `%${clamped}`;
}
