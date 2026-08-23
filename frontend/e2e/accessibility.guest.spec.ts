import { test } from '@playwright/test';

import { expectNoA11yViolations } from './assert-no-a11y-violations';
import { guestRoutes } from './routes';

for (const route of guestRoutes) {
  test(`has no WCAG 2.1 A/AA violations: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expectNoA11yViolations(page);
  });
}
