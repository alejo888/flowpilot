import { Injectable, signal } from '@angular/core';

/**
 * Global UI density (spec: ui-density; design D5). Scales ONLY spacing
 * tokens (see `styles.scss`'s `[data-fp-density="compact"]` block) — never
 * colors, fonts, or radius.
 */
export type FpDensity = 'comfortable' | 'compact';

export const FP_DENSITY_STORAGE_KEY = 'fp-density';

const DENSITY_ATTRIBUTE = 'data-fp-density';

@Injectable({ providedIn: 'root' })
export class DensityService {
  readonly density = signal<FpDensity>(this.readStoredDensity());

  constructor() {
    this.applyDensity(this.density());
  }

  toggle(): void {
    this.setDensity(this.density() === 'comfortable' ? 'compact' : 'comfortable');
  }

  setDensity(value: FpDensity): void {
    this.density.set(value);
    this.applyDensity(value);
  }

  /** Applies `value` to `document.documentElement` so overlays rendered outside the app shell (e.g. `fp-dialog`) inherit it too, and persists it to localStorage. */
  private applyDensity(value: FpDensity): void {
    document.documentElement.setAttribute(DENSITY_ATTRIBUTE, value);
    try {
      localStorage.setItem(FP_DENSITY_STORAGE_KEY, value);
    } catch {
      // localStorage unavailable (e.g. disabled/private mode) — density still
      // works for the current page load, it just won't persist across reloads.
    }
  }

  private readStoredDensity(): FpDensity {
    try {
      const stored = localStorage.getItem(FP_DENSITY_STORAGE_KEY);
      return stored === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  }
}
