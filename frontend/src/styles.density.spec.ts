import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Structural test for the compact-density override block in `styles.scss`
 * (spec: ui-density "Density Scope Constraint"; design D5). jsdom cannot
 * resolve CSS custom properties, so runtime specs asserting
 * `getComputedStyle()` on a primitive only ever see the literal
 * `var(--fp-*)` reference string, not its resolved value — that can't prove
 * "unchanged across densities". This test instead inspects the stylesheet
 * source directly to prove the compact block touches ONLY `--fp-space-*`
 * spacing tokens and never redeclares color/font/radius tokens.
 */
describe('styles.scss compact density block', () => {
  const source = readFileSync(join(__dirname, 'styles.scss'), 'utf-8');

  function extractDensityBlock(): string {
    const match = source.match(/\[data-fp-density=['"]compact['"]\]\s*\{([^}]*)\}/);
    expect(match).not.toBeNull();
    return match![1];
  }

  it('exists and declares at least one spacing token', () => {
    const block = extractDensityBlock();
    expect(block).toMatch(/--fp-space-1:\s*4px/);
  });

  it('only redeclares --fp-space-* tokens, never color/font/radius tokens', () => {
    const block = extractDensityBlock();
    const declaredProperties = [...block.matchAll(/--fp-[a-z0-9-]+(?=\s*:)/g)].map((m) => m[0]);

    expect(declaredProperties.length).toBeGreaterThan(0);
    for (const property of declaredProperties) {
      expect(property).toMatch(/^--fp-space-\d+$/);
    }
  });

  it('scales spacing values tighter than the comfortable defaults', () => {
    const block = extractDensityBlock();
    // Comfortable: --fp-space-2: 8px. Compact must be strictly smaller.
    const compactSpace2 = block.match(/--fp-space-2:\s*(\d+)px/);
    expect(compactSpace2).not.toBeNull();
    expect(Number(compactSpace2![1])).toBeLessThan(8);
  });
});
