import { expect, test, type Locator, type Page } from '@playwright/test';

/** Set SCREENSHOT_DIR to save phone-size screenshots along the way. */
async function shot(page: Page, name: string) {
  const dir = process.env.SCREENSHOT_DIR;
  if (dir) await page.screenshot({ path: `${dir}/${name}.png` });
}

async function hold(page: Page, button: Locator) {
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1200);
  await page.mouse.up();
}

test('plays a status-quo year on a phone', async ({ page }) => {
  await page.goto('?seed=smoke&start=status-quo');

  const badges = page.locator('.pps-map [data-school]');
  await expect(badges).toHaveCount(74);
  await expect(page.locator('.topbar')).toContainText('JAN 2027');
  await shot(page, 'm1-plan');

  const badge = (await page.locator('[data-school="rosa-parks"] > rect').first().boundingBox())!;
  await page.touchscreen.tap(badge.x + badge.width / 2, badge.y + badge.height / 2);
  const picker = page.getByRole('dialog', { name: 'Choose a school' });
  if (await picker.isVisible()) await picker.getByRole('button', { name: 'Rosa Parks' }).tap();
  const sheet = page.getByRole('region', { name: 'Rosa Parks Elementary School' });
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: '2006' }).tap();
  await expect(page.getByRole('dialog', { name: 'Year built' })).toContainText('[F] public source');
  await shot(page, 'm1-school-popover');
  await page.getByRole('dialog', { name: 'Year built' }).getByRole('button', { name: 'Close' }).tap();
  await sheet.getByRole('button', { name: 'Close', exact: true }).tap();

  const gap = page.getByTestId('gapbar');
  const before = await gap.textContent();
  await page.getByRole('button', { name: 'Budget' }).tap();
  await page.getByRole('button', { name: 'More K-5 class size' }).tap();
  await expect(page.locator('.chip')).toBeVisible();
  await expect(gap).not.toHaveText(before!);
  await shot(page, 'm1-budget');

  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  const preflight = page.getByRole('region', { name: 'Play 2027-28?' });
  await expect(preflight).toContainText('K-5 class size 24 → 25');
  await hold(page, page.getByRole('button', { name: 'Play the year (press and hold)' }));

  const playback = page.getByTestId('playback');
  await expect(playback).toBeVisible();
  await expect(playback).toContainText('Kindergarten lottery');
  await shot(page, 'm1-playback');
  await playback.getByRole('button', { name: 'Skip' }).tap();

  const report = page.getByRole('region', { name: /DEC 2027/ });
  await expect(report).toBeVisible();
  for (const flow of ['Stayed', 'Moved in PPS', 'Came back', 'New kindergartners', 'Kids now', 'Left PPS', 'To high school'])
    await expect(report.locator('.flows')).toContainText(flow);
  await expect(page.getByRole('region', { name: 'The Bulletin' }).locator('li')).toHaveCount(3);
  await shot(page, 'm1-report');
  await page.setViewportSize({ width: 360, height: 640 });
  await expect(page.getByRole('button', { name: 'Plan 2028' })).toBeInViewport();
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('button', { name: 'Plan 2028' }).tap();
  await expect(page.locator('.topbar')).toContainText('JAN 2028');
});

/** The design's first ten minutes. Seed p52 starts Peninsula and Rosa Parks at 399 kids. */
test('closes Peninsula into Rosa Parks and reports where the kids went', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('?seed=p52');
  const starts = page.getByRole('region', { name: 'New game' });
  await expect(starts).toContainText('Not modeled yet');
  await starts.getByRole('button', { name: 'Status quo 2026' }).tap();
  await expect(page).toHaveURL(/\?seed=p52&start=status-quo$/);

  await page.getByRole('button', { name: 'Plan' }).tap();
  await page.getByRole('button', { name: 'Peninsula Elementary School' }).tap();
  await page.getByRole('button', { name: 'Close & send' }).tap();
  const sheet = page.getByRole('region', { name: 'Close Peninsula' });
  await expect(page.locator('[data-mark="candidate"]')).toHaveCount(5);
  await sheet.getByRole('button', { name: /Rosa Parks/ }).tap();
  await expect(page.locator('[data-mark="receiver"]')).toHaveCount(1);
  for (const row of await sheet.locator('.pick').all()) expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(48);
  await shot(page, 'm2-step1');

  await sheet.getByRole('button', { name: 'Next >' }).tap();
  const chip = page.getByTestId('closure-chip');
  await expect(chip).toContainText('Seats377–421~/594');
  await expect(chip).toContainText('Pays off if fewer than');
  await shot(page, 'm2-step2');

  await sheet.getByRole('button', { name: 'Next >' }).tap();
  await sheet.getByRole('radio', { name: /Sell/ }).tap();
  await expect(sheet.getByRole('alert')).toContainText("can't reopen");
  await shot(page, 'm2-step3');
  await sheet.getByRole('radio', { name: /Mothball/ }).tap();
  await sheet.getByRole('button', { name: 'Close it' }).tap();
  const step = sheet.getByRole('button', { name: 'Less Stay in PPS' });
  expect((await step.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await sheet.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  for (let i = 0; i < 4; i++) await step.tap();
  await shot(page, 'm2-call-it');
  await sheet.getByRole('button', { name: 'Call it' }).tap();

  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  await expect(page.getByRole('region', { name: 'Play 2027-28?' })).toContainText('Close Peninsula → Rosa Parks');
  await hold(page, page.getByRole('button', { name: 'Play the year (press and hold)' }));

  const playback = page.getByTestId('playback');
  await expect(playback.locator('.season')).toHaveText('Fall', { timeout: 20_000 });
  await expect(playback).toContainText('Families of the closed school decide');
  await page.getByRole('button', { name: 'Pause' }).tap();
  await page.waitForTimeout(1700);
  await shot(page, 'm2-playback');
  await playback.getByRole('button', { name: 'Skip' }).tap();

  const where = page.getByRole('region', { name: 'Where Peninsula kids went' });
  await expect(where).toContainText('Rosa Parks');
  await expect(where).toContainText('Left PPS');
  await expect(where.locator('.call')).toContainText(/HIT|MISS/);
  await shot(page, 'm2-report');
});
