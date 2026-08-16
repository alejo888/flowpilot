import { test } from '@playwright/test';

import { expectNoHorizontalOverflow } from './assert-no-overflow';

test('stays within viewport width: login', async ({ page }) => {
  await page.goto('/login');
  await expectNoHorizontalOverflow(page);
});
