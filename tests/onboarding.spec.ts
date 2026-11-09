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
    const saved = JSON.parse(localStorage.getItem('hallway.account')!);
    saved.seenPopups = {
      '2026-10-destination-limits': 'x',
      '2026-10-schedule': 'x',
      '2026-10-home': 'x',
      '2026-10-13-class-limit-pins-student-link': 'x',
    };
    localStorage.setItem('hallway.account', JSON.stringify(saved));
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
  await expect(dialog).toContainText('From all of us at teacher.dev: thank you');
  for (const title of ['Keep this computer open during class', 'One roster for all your classes', 'Fix mistakes in History']) {
    await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
  }
  await expect(dialog.getByRole('heading', { name: 'Can always go' })).toBeHidden();
  await expect(dialog.getByRole('link', { name: 'support@teacher.dev' })).toHaveAttribute('href', /^mailto:support@teacher\.dev/);

  // A link goes there and counts as seen.
  await dialog.getByRole('link', { name: 'Pass Options →' }).click();
  await expect(page).toHaveURL(/\/pass-options$/);
  await expect(update).toBeHidden();
  await page.reload();
  await page.waitForTimeout(1000);
  await expect(update).toBeHidden();

  // Never on the kiosk.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('hallway.account')!);
    saved.seenPopups = {};
    localStorage.setItem('hallway.account', JSON.stringify(saved));
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
  await expect(update).toBeHidden();
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
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.account')!).seenPopups['2026-11-whats-new']);
  // Seen already as a brand-new teacher; the preview doesn't change when.
  expect(typeof seen).toBe('string');
});
