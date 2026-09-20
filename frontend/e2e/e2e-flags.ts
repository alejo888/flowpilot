/**
 * True only when `E2E_AI` is explicitly `true` or `1` (trimmed, case-insensitive).
 * A bare truthiness check would treat `E2E_AI=false` or `E2E_AI=0` as enabled.
 * Shared by `playwright.config.ts` and `global-setup.ts` so both agree on
 * whether the AI-only run is active.
 */
export function isAiE2e(): boolean {
  const value = (process.env['E2E_AI'] ?? '').trim().toLowerCase();
  return value === 'true' || value === '1';
}
