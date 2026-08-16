import { expect, type Page } from '@playwright/test';

/**
 * Guards against the class of bug found 2026-08-15/16: a child element
 * (nav, a table, a flex row) with no local overflow containment drags the
 * whole document into horizontal scroll on narrow viewports. 1px tolerance
 * absorbs scrollbar-width rounding, not real overflow.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}
