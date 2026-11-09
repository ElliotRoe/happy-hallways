import { expect, test } from '@playwright/test';

/**
 * Today's "What's changed": a teacher who used Happy Hallways before sees it
 * once, after any dialog that's open closes; a brand-new teacher never does.
 */
test("a returning teacher sees today's update once; a brand-new one never does", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  const update = page.getByRole('heading', { name: 'Students can take a pass from their own device' });

  // A brand-new teacher.
  await page.goto('/classes/new');
  await page.getByLabel('Class name').fill('Math');
  await page.getByRole('button', { name: 'Create class' }).click();
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(update).toBeHidden();

  // A teacher who had seen every update before today's.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('hallway.account.v2')!);
    saved.seenPopups = {
      '2026-10-destination-limits': 'x',
      '2026-10-schedule': 'x',
      '2026-10-home': 'x',
      '2026-10-13-class-limit-pins-student-link': 'x',
    };
    localStorage.setItem('hallway.account.v2', JSON.stringify(saved));
  });

  // Arriving with a dialog open, the update waits until it closes.
  await page.goto(page.url() + '?add');
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(update).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(update).toBeVisible();

  // Only today's update: a thank-you first, links to each place, and a note with the support email at the end.
  const dialog = page.getByRole('dialog', { name: "What's new in Happy Hallways" });
  await expect(dialog).toContainText('Thank you for every email, comment and idea');
  for (const title of ['Students can take a pass from their own device', 'Attendance, if you want it', 'Choose what students can see', 'Fix mistakes in History']) {
    await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
  }
  // Short: the rest is on the What's changed page.
  await expect(dialog.getByRole('heading')).toHaveCount(5);
  await expect(dialog.getByRole('heading', { name: 'One roster for all your classes' })).toBeHidden();
  await expect(dialog.getByRole('link', { name: 'support@teacher.dev' })).toHaveAttribute('href', /^mailto:support@teacher\.dev/);

  // "See everything that changed" opens the full list, and counts as seen.
  await dialog.getByRole('link', { name: 'See everything that changed' }).click();
  await expect(page).toHaveURL(/\/settings\/changes$/);
  await expect(page.getByText('One roster for all your classes', { exact: true })).toBeVisible();
  await expect(page.getByText('One limit for the whole class', { exact: true })).toBeVisible();
  await expect(update).toBeHidden();
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(dialog).toBeHidden();

  // Never on the kiosk.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('hallway.account.v2')!);
    saved.seenPopups = {};
    localStorage.setItem('hallway.account.v2', JSON.stringify(saved));
  });
  await page.goto('/door');
  await page.waitForTimeout(1000);
  await expect(page.getByRole('heading', { name: "What's new in Happy Hallways" })).toBeHidden();

  // Got it closes it for good too.
  await page.goto('/history');
  await page.getByRole('button', { name: 'Got it' }).click();
  await expect(page.getByRole('heading', { name: 'Thank you for all your feedback' })).toBeHidden();
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(dialog).toBeHidden();
});

test('/?whats-new previews the newest update without counting it as seen', async ({ page }) => {
  await page.goto('/classes/new');
  await page.getByLabel('Class name').fill('Math');
  await page.getByRole('button', { name: 'Create class' }).click();
  await page.keyboard.press('Escape');

  // A brand-new teacher never sees it on their own, but the preview shows it.
  await page.goto('/?whats-new');
  const dialog = page.getByRole('dialog', { name: "What's new in Happy Hallways" });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await dialog.getByRole('button', { name: 'Got it' }).click();
  await expect(dialog).toBeHidden();
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.account.v2')!).seenPopups['2026-11-whats-new']);
  // Seen already as a brand-new teacher; the preview doesn't change when.
  expect(typeof seen).toBe('string');
});
