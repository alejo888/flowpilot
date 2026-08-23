import { test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './assert-no-overflow';
import { guestRoutes } from './routes';

for (const route of guestRoutes) {
  test(`stays within viewport width: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expectNoHorizontalOverflow(page);
  });
}
