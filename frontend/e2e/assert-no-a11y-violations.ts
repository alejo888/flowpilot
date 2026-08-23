import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/**
 * Fails on any WCAG 2.1 A/AA violation axe-core detects (aria misuse, color
 * contrast, missing labels, focus order, landmark structure). Scoped to
 * `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` tags rather than the full axe rule
 * set, which also flags best-practice items that aren't WCAG requirements.
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}
