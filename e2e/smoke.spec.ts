import { expect, test, type Locator, type Page } from '@playwright/test';

/** Set SCREENSHOT_DIR to save phone-size screenshots along the way. */
async function shot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/m1-${name}.png` });
}

async function hold(page: Page, button: Locator) {
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
}

test('plays a status-quo year on a phone', async ({ page }) => {
  await page.goto('?seed=smoke');

  const badges = page.locator('.pps-map [data-school]');
  await expect(badges).toHaveCount(74);
  await expect(page.locator('.topbar')).toContainText('JAN 2027');
  await shot(page, 'plan');

  const badge = (await page.locator('[data-school="rosa-parks"] > rect').first().boundingBox())!;
  await page.touchscreen.tap(badge.x + badge.width / 2, badge.y + badge.height / 2);
  const picker = page.getByRole('dialog', { name: 'Choose a school' });
  if (await picker.isVisible()) await picker.getByRole('button', { name: 'Rosa Parks' }).tap();
  const sheet = page.getByRole('region', { name: 'Rosa Parks Elementary School' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '2006' }).tap();
  await expect(page.getByRole('dialog', { name: 'Year built' })).toContainText('[F] public source');
  await shot(page, 'school-popover');
  await page.getByRole('dialog', { name: 'Year built' }).getByRole('button', { name: 'Close' }).tap();
  await sheet.getByRole('button', { name: 'Close' }).tap();

  const gap = page.getByTestId('gapbar');
  const before = await gap.textContent();
  await page.getByRole('button', { name: 'Budget' }).tap();
  await page.getByRole('button', { name: 'More K-5 class size' }).tap();
  await expect(page.locator('.chip')).toBeVisible();
  await expect(gap).not.toHaveText(before!);
  await shot(page, 'budget');

  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  const preflight = page.getByRole('region', { name: 'Play 2027-28?' });
  await expect(preflight).toContainText('K-5 class size 24 → 25');
  await hold(page, page.getByRole('button', { name: 'Play the year (press and hold)' }));

  const playback = page.getByTestId('playback');
  await expect(playback).toBeVisible();
  await expect(playback).toContainText('Kindergarten lottery');
  await shot(page, 'playback');
  await playback.getByRole('button', { name: 'Skip' }).tap();

  const report = page.getByRole('region', { name: /DEC 2027/ });
  await expect(report).toBeVisible();
  for (const flow of ['Stayed', 'Moved in PPS', 'Came back', 'New kindergartners', 'Kids now', 'Left PPS', 'To high school'])
    await expect(report.locator('.flows')).toContainText(flow);
  await expect(page.getByRole('region', { name: 'The Bulletin' }).locator('li')).toHaveCount(3);
  await shot(page, 'report');
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(page.getByRole('button', { name: 'Plan 2028' })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('button', { name: 'Plan 2028' }).tap();
  await expect(page.locator('.topbar')).toContainText('JAN 2028');
});
