import { expect, test, type Page } from '@playwright/test';
import { circle, createClass, snap } from './helpers.ts';

/** Pictures for the guide at /guides/schedule-no-pass-times. */
const guide = 'schedule-no-pass-times';

/** One period at the bottom of the open schedule's list. */
async function addPeriod(page: Page, className: string, start: string, end: string) {
  await page.getByRole('button', { name: 'Add a period' }).click();
  const row = page.locator('.period-item').last();
  await row.getByLabel('Class', { exact: true }).selectOption({ label: className });
  await row.getByLabel('Ends').fill(end);
  await row.getByLabel('Starts').fill(start);
}

test('a schedule with no-pass times', async ({ page }) => {
  // A school morning, five minutes into first period, so the kiosk shows a no-pass time.
  await page.clock.install({ time: new Date('2026-10-05T08:05:00') });
  const students = ['Ava Johnson', 'Mia Rodriguez', 'Liam Chen', 'Noah Patel'];
  await createClass(page, 'Period 1', students);
  await createClass(page, 'Period 2', ['Sofia Garcia', 'Ethan Brooks', 'Zoe Kim']);

  // 1. Start a new schedule.
  await page.getByRole('link', { name: /^Schedule/ }).click();
  const create = page.getByRole('button', { name: /^(No schedules|New schedule)/ });
  await circle(create);
  await snap(page, guide, '1-new-schedule', page.getByRole('heading', { level: 1 }));
  await create.click();
  await expect(page.getByRole('heading', { name: 'Create new schedule' })).toBeVisible();

  // 2. Name it.
  const name = page.getByLabel('Schedule name');
  await name.fill('Regular Day');
  await name.press('Tab');
  await circle(name);
  await snap(page, guide, '2-name-schedule');

  // 3. Each class gets a period.
  await addPeriod(page, 'Period 1', '08:00', '08:50');
  await addPeriod(page, 'Period 2', '08:55', '09:45');
  const periods = page.locator('.period-item');
  await circle(page.locator('.period-list'));
  await circle(page.getByRole('button', { name: 'Add a period' }));
  await snap(page, guide, '3-add-periods');

  // 4. No passes in the first and last minutes of each period.
  for (const row of [periods.nth(0), periods.nth(1)]) {
    await row.getByLabel('First minutes with no passes').fill('10');
    await row.getByLabel('First minutes with no passes').press('Tab');
    await row.getByLabel('Last minutes with no passes').fill('5');
    await row.getByLabel('Last minutes with no passes').press('Tab');
  }
  await circle(periods.nth(0).locator('.no-pass-row'));
  await circle(periods.nth(1).locator('.no-pass-row'));
  await snap(page, guide, '4-first-and-last-minutes', page.locator('.calendar-card'));

  // 5. A set time with no passes for anyone, like an assembly.
  await page.getByRole('button', { name: 'A set time' }).click();
  await page.getByLabel('No passes from').fill('09:15');
  await page.getByLabel('No passes from').press('Tab');
  await page.getByLabel('No passes until').fill('09:30');
  await page.getByLabel('No passes until').press('Tab');
  const setTimes = page.locator('section.card').filter({ has: page.getByRole('heading', { name: 'No-pass times' }) });
  await circle(setTimes);
  await snap(page, guide, '5-set-time');

  // 6. Use it, from Home.
  await page.locator('.status-box').click();
  const pick = page.getByRole('button', { name: /^Schedule:/ });
  await pick.click();
  await page.getByRole('menuitemradio', { name: 'Regular Day' }).click();
  await expect(page.locator('.status-box')).toContainText('Regular Day');
  await page.locator('.tip').getByRole('button', { name: 'Skip' }).click();
  await circle(page.locator('.status-box'));
  await circle(pick);
  await snap(page, guide, '6-use-schedule', page.getByRole('heading', { level: 1 }));

  // At the kiosk: Period 1 is on by itself, and it's still the first ten minutes.
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await page.getByRole('link', { name: 'Kiosk', exact: true }).click();
  await page.getByLabel('PIN (4 to 8 digits)').fill('2468');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.locator('.status-box').click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await expect(page.getByText('No passes right now.')).toBeVisible();
  await page.getByRole('button', { name: /^Ava/ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText(/Passes open at 8:10 AM. Join the line/)).toBeVisible();
  await circle(page.getByRole('button', { name: 'Join the line' }));
  await snap(page, guide, '7-kiosk-no-passes', [
    page.getByRole('heading', { name: 'Join the line?' }),
    page.getByRole('button', { name: 'Teacher: let them go' }),
  ]);
  await page.getByRole('button', { name: 'Join the line' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await snap(page, guide, '8-kiosk-line');
});
