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
  const preflight = page.getByRole('dialog', { name: 'Play 2027-28?' });
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
  await page.reload();
  await expect(page.locator('.topbar')).toContainText('JAN 2028');
});

test('fits a small phone: one-line dials, a pausable playback and pop-overs on screen', async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 360, height: 640 });
  await page.goto('?seed=p52&start=scenario-a');
  const rows = page.locator('.topbar-row');
  for (const row of await rows.all()) expect((await row.boundingBox())!.height).toBeLessThan(40);

  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  await hold(page, page.getByRole('button', { name: 'Play the year (press and hold)' }));
  const playback = page.getByTestId('playback');
  await expect(playback.getByRole('button', { name: 'Pause' })).toBeInViewport();
  await page.waitForTimeout(6500);
  await expect(playback).toContainText('school');
  await expect(playback.getByRole('button', { name: 'Pause' })).toBeInViewport();
  await shot(page, 'm5-playback-360');
  await playback.getByRole('button', { name: 'Skip' }).tap();

  await page.locator('.flow [data-source="model.movingRoll"]').first().tap();
  const popover = page.getByRole('dialog', { name: 'Yearly moving roll' });
  await expect(popover.getByRole('link').last()).toBeInViewport();
  await shot(page, 'm5-popover-360');
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
  await sheet.getByRole('button', { name: 'Call it', exact: true }).tap();
  await expect(sheet).toBeHidden();

  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  await expect(page.getByRole('dialog', { name: 'Play 2027-28?' })).toContainText('Close Peninsula → Rosa Parks');
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

test('slices 30% of Peninsula into Rosa Parks and reports the re-zoned kids', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('?seed=p52&start=status-quo');
  await page.getByRole('button', { name: 'Plan' }).tap();
  await page.getByRole('button', { name: 'Rosa Parks Elementary School' }).tap();
  await page.getByRole('button', { name: 'Edit boundary' }).tap();
  const sheet = page.getByRole('region', { name: 'Zone: Rosa Parks' });
  await expect(page.getByTestId('zone-grid')).toBeVisible();

  const from = (await page.locator('[data-school="peninsula"] > rect').last().boundingBox())!;
  const [x, y] = [from.x + from.width / 2, from.y + from.height / 2];
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x + i * 8, y - i * 4);
  await page.mouse.up();
  await expect(page.getByTestId('boundary-chip')).toContainText('blocks');
  await expect(page.locator('[data-painted]')).not.toHaveAttribute('d', '');
  await shot(page, 'm3-zone-paint');
  await sheet.getByRole('button', { name: 'Undo stroke' }).tap();
  await expect(page.getByTestId('boundary-chip')).toHaveCount(0);

  await sheet.getByRole('button', { name: 'Slice…' }).tap();
  await sheet.getByRole('combobox', { name: 'Zone' }).selectOption('peninsula');
  await sheet.getByRole('button', { name: 'More Share' }).tap();
  await expect(sheet).toContainText('Move the 30% of Peninsula nearest Rosa Parks');
  await sheet.getByRole('checkbox', { name: /Grandfather/ }).tap();
  const chip = page.getByTestId('boundary-chip');
  await expect(chip).toContainText('kids must move');
  await expect(chip).not.toContainText('\n0 kids must move');
  expect((await sheet.getByRole('button', { name: 'More Share' }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect((await sheet.getByRole('button', { name: 'Add to plan' }).boundingBox())!.height).toBeGreaterThanOrEqual(48);
  expect(await sheet.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  await sheet.locator('.window-body').evaluate((e) => e.scrollTo(0, 0));
  await shot(page, 'm3-slice');
  await sheet.getByRole('button', { name: 'Add to plan' }).tap();

  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  await expect(page.getByRole('dialog', { name: 'Play 2027-28?' })).toContainText(/Rezone \d+ blocks → Rosa Parks/);
  await hold(page, page.getByRole('button', { name: 'Play the year (press and hold)' }));
  await page.getByTestId('playback').getByRole('button', { name: 'Skip' }).tap();

  const where = page.getByRole('region', { name: 'Where re-zoned kids went' });
  for (const row of ['New zone school', 'Other PPS school', 'Left PPS']) await expect(where).toContainText(row);
  await expect(where).toContainText('~');
  await expect(page.getByText(/K-5 walkers \d/)).toBeVisible();
  await where.scrollIntoViewIfNeeded();
  await shot(page, 'm3-report');
});

async function playYear(page: Page, year: number) {
  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  await hold(page, page.getByRole('button', { name: 'Play the year (press and hold)' }));
  await page.getByTestId('playback').getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('region', { name: new RegExp(`DEC ${year}`) })).toBeVisible();
}

test('puts a new levy rate to voters and reports the vote', async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto('?seed=smoke&start=status-quo');
  await expect(page.locator('.topbar')).toContainText(/Trust \d+/);

  await page.getByRole('button', { name: 'Budget' }).tap();
  await expect(page.getByText('Levy runs through June 2030')).toBeVisible();
  await page.getByRole('button', { name: 'Less Levy rate' }).tap();
  const ballot = page.getByRole('group', { name: 'Levy ballot' });
  await expect(ballot).toContainText(/May 2027 levy vote\$1\.89 per \$1K · poll \d+–\d+%~/);
  await ballot.scrollIntoViewIfNeeded();
  await shot(page, 'm4-ballot');

  await hold(page, page.getByRole('button', { name: 'End year (press and hold)' }));
  const preflight = page.getByRole('dialog', { name: 'Play 2027-28?' });
  await expect(preflight).toContainText(/May 2027 levy vote\$1\.89 per \$1K · poll/);
  await expect(preflight).toContainText('The plan books it as passing.');
  await shot(page, 'm4-preflight');
  await hold(page, page.getByRole('button', { name: 'Play the year (press and hold)' }));

  const playback = page.getByTestId('playback');
  await expect(playback).toContainText(/Voters approve a \$1\.89 levy: \d+% yes|Levy fails: \d+% yes/);
  await page.getByRole('button', { name: 'Pause' }).tap();
  await shot(page, 'm4-playback-vote');
  await playback.getByRole('button', { name: 'Skip' }).tap();

  const vote = page.getByRole('region', { name: 'Levy vote' });
  await expect(vote).toContainText(/You: \$1\.89, \d+%~ yes (PASSED|FAILED)/);
  await expect(page.getByRole('region', { name: 'The Bulletin' })).toContainText(/levy/i);
  await vote.scrollIntoViewIfNeeded();
  await shot(page, 'm4-report-vote');
});

test('reveals the hidden cards after three years', async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto('?seed=p52&start=scenario-a');
  await page.getByRole('button', { name: 'Plan' }).tap();
  const calendar = page.getByRole('list', { name: 'Calendar' });
  await expect(calendar).toContainText('Teacher bargaining opens');
  await expect(calendar).toContainText('Legislature sets the 2027-29 budget');
  await expect(calendar).toContainText('Levy expires');
  await calendar.getByRole('button', { name: 'Teacher bargaining opens' }).tap();
  await expect(page.getByRole('dialog', { name: 'Teacher bargaining' })).toContainText('[N] news');
  await page.getByRole('dialog', { name: 'Teacher bargaining' }).getByRole('button', { name: 'Close' }).tap();
  await shot(page, 'm4-calendar');
  await page.getByRole('button', { name: 'Map', exact: true }).tap();

  await playYear(page, 2027);
  await page.locator('.flow [data-source="model.followRate"]').first().tap();
  await expect(page.getByRole('dialog', { name: 'Follow a closed school' })).toContainText('Hidden until the December 2029 report.');
  await shot(page, 'm4-hidden');
  await page.getByRole('dialog', { name: 'Follow a closed school' }).getByRole('button', { name: 'Close' }).tap();
  await page.getByRole('button', { name: 'Plan 2028' }).tap();
  await playYear(page, 2028);
  await page.getByRole('button', { name: 'Plan 2029' }).tap();
  await playYear(page, 2029);

  const reveal = page.getByRole('region', { name: 'Revealed: Follow a closed school' });
  const chart = reveal.getByRole('img');
  await expect(chart).toHaveAttribute('aria-label', /Possible values: 95%, 88%, 80% and 65%.*This game drew \d+%\./);
  await expect(reveal.locator('[data-drawn]')).toHaveCount(1);
  await expect(reveal).toContainText('>93% stayed');
  await reveal.scrollIntoViewIfNeeded();
  await shot(page, 'm4-reveal');
  await expect(page.getByRole('region', { name: "Revealed: Closed zone's kindergarten capture" })).toBeVisible();
});

async function dialsFit(page: Page) {
  const topbar = page.locator('.topbar');
  expect(await topbar.evaluate((e) => e.scrollWidth <= e.clientWidth)).toBe(true);
  for (const dial of await topbar.locator('.sourced').all()) await dial.click({ trial: true, timeout: 2000 });
}

for (const width of [900, 1024, 1440]) {
  test.describe(`on a ${width}px desktop`, () => {
    test.use({ viewport: { width, height: 800 }, isMobile: false, hasTouch: false });

    test('keeps the map wide, the dials in reach and sheets beside the map', async ({ page }) => {
      await page.goto('?seed=p52');
      const picker = page.getByRole('region', { name: 'New game' });
      expect((await picker.boundingBox())!.width).toBeLessThan(720);
      await picker.getByRole('button', { name: 'Status quo 2026' }).click();
      await dialsFit(page);

      const map = page.locator('.pps-map');
      const beside = async (sheet: Locator) => {
        const [m, s] = [(await map.boundingBox())!, (await sheet.boundingBox())!];
        expect(m.width).toBeGreaterThan(width * 0.6);
        expect(s.x).toBeGreaterThanOrEqual(m.x + m.width);
      };

      await page.getByRole('button', { name: 'Plan' }).click();
      await page.getByRole('button', { name: 'Rosa Parks Elementary School' }).click();
      await beside(page.getByRole('region', { name: 'Rosa Parks Elementary School' }));
      const [m, badge] = [(await map.boundingBox())!, (await page.locator('[data-school="rosa-parks"] > rect').first().boundingBox())!];
      expect(Math.abs(badge.y + badge.height / 2 - (m.y + m.height / 2))).toBeLessThan(m.height * 0.1);

      await page.getByRole('button', { name: 'Budget' }).click();
      await beside(page.getByRole('region', { name: 'Budget' }));
      await page.mouse.click(badge.x + badge.width / 2, badge.y + badge.height / 2);
      const choose = page.getByRole('dialog', { name: 'Choose a school' });
      if (await choose.isVisible()) await choose.getByRole('button', { name: 'Rosa Parks' }).click();
      await expect(page.getByRole('region', { name: 'Rosa Parks Elementary School' })).toBeVisible();

      await playYear(page, 2027);
      await beside(page.getByRole('region', { name: /DEC 2027/ }));
      await dialsFit(page);
    });
  });
}

test('defines jargon on a phone', async ({ page }) => {
  await page.goto('?seed=p52&start=status-quo');
  await page.locator('.topbar').getByRole('button', { name: /^Cap \d/ }).tap();
  const capture = page.getByRole('dialog', { name: 'Capture' });
  await expect(capture.locator('.definition')).toContainText('share of K-8 kids');
  await expect(capture).toContainText('[M] model assumption');
  await capture.getByRole('button', { name: 'Close' }).tap();

  await page.getByRole('button', { name: 'Plan' }).tap();
  await page.getByRole('button', { name: 'Rosa Parks Elementary School' }).tap();
  const urm = (await page.getByRole('button', { name: 'What is URM?' }).boundingBox())!;
  await page.touchscreen.tap(urm.x + urm.width / 2, urm.y + urm.height / 2 - 20);
  const dialog = page.getByRole('dialog', { name: 'URM' });
  await expect(dialog).toContainText('Unreinforced masonry');
  await expect(dialog).toBeInViewport();
  await shot(page, 'glossary-phone');
  await dialog.getByRole('button', { name: 'Close' }).tap();

  await page.getByRole('button', { name: 'Edit boundary' }).tap();
  const grandfather = page.getByRole('checkbox', { name: /Grandfather/ });
  const text = (await page.getByText('Grandfather current').boundingBox())!;
  const mark = (await page.getByRole('button', { name: 'What is Grandfather?' }).boundingBox())!;
  for (const x of [text.x + 4, mark.x - 15]) {
    const before = await grandfather.isChecked();
    await page.touchscreen.tap(x, text.y + text.height / 2);
    await expect(grandfather).toBeChecked({ checked: !before });
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test.describe('on a desktop', () => {
  test.use({ viewport: { width: 1280, height: 800 }, isMobile: false, hasTouch: false });

  test('spells out the dials and defines them', async ({ page }) => {
    await page.goto('?seed=p52&start=status-quo');
    const topbar = page.locator('.topbar');
    await expect(topbar).toContainText(/Capture \d/);
    await expect(topbar).toContainText(/Reserves \d/);
    await page.getByRole('button', { name: 'What is Reserves?' }).click();
    await expect(page.getByRole('dialog', { name: 'Reserves' })).toContainText('at least 5%');
    await page.keyboard.press('Escape');
    await page.locator('.topbar [data-source="dial.trust"]').click();
    const trust = page.getByRole('dialog', { name: 'Trust' });
    await expect(trust.locator('.definition')).toContainText('from 0 to 100');
    await expect(trust).toContainText('[M] model assumption');
    await shot(page, 'glossary-desktop');
  });
});
