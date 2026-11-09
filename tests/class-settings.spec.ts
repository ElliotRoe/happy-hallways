import { expect, test } from '@playwright/test';

async function newClass(page: import('@playwright/test').Page, name: string, roster: string) {
  // Needs you starts closed, so it doesn't cover the bottom of the page.
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('hallway.drawer-open', 'false'));
  await page.goto('/classes/new');
  await page.getByLabel('Class name').fill(name);
  await page.getByRole('button', { name: 'Create class' }).click();
  await page.getByLabel('One student per line').fill(roster);
  await page.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
}

test("a class's settings are a tab beside its students, and save as they change", async ({ page }) => {
  await newClass(page, 'Period 1', 'Maya Chen\nJordan Ellis');
  const tabs = page.getByRole('navigation', { name: 'Period 1' });
  await expect(tabs.getByRole('link', { name: 'Students' })).toHaveAttribute('aria-current', 'page');
  // This class's PINs, to see and print, are a tab too.
  await tabs.getByRole('link', { name: 'PINs' }).click();
  await expect(page.getByText('PINs are off.')).toBeVisible();
  await tabs.getByRole('link', { name: 'Students' }).click();

  await tabs.getByRole('link', { name: 'Settings' }).click();
  await expect(page).toHaveURL(/\/classes\/[^/]+\/settings$/);

  // Renaming saves when the box is left; there's no Save button.
  const name = page.getByLabel('Class name');
  await name.fill('Period 1A');
  await name.press('Tab');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Period 1A');

  // What students can see: all on to start, and a change sticks after a reload.
  const where = page.getByRole('switch', { name: 'Show where students went' });
  await expect(where).toBeChecked();
  await where.uncheck();
  await page.reload();
  await expect(page.getByRole('switch', { name: 'Show where students went' })).not.toBeChecked();
  await expect(page.getByRole('switch', { name: 'Show names on student devices' })).toBeChecked();

  // Deleting asks first, then goes Home (the welcome page, with no classes left).
  await page.getByRole('button', { name: 'Delete class' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete class' }).click();
  await expect(page).toHaveURL(/\/(welcome)?$/);
});

test('attendance is one setting for every class, in Pass Options', async ({ page }) => {
  await newClass(page, 'Period 1', 'Maya Chen');
  await page.goto('/pass-options');
  const take = page.getByRole('switch', { name: 'Take attendance' });
  await expect(take).not.toBeChecked();
  await take.check();
  const grace = page.getByLabel(/before an arrival is tardy/);
  await grace.fill('7');
  await grace.press('Tab');
  await page.reload();
  await expect(page.getByLabel(/before an arrival is tardy/)).toHaveValue('7');
  // Every class shows today's attendance once it's on.
  await page.getByRole('navigation').getByRole('link', { name: 'Period 1', exact: true }).first().click();
  await expect(page.getByRole('region', { name: "Today's attendance" })).toBeVisible();
});

test("a class that took attendance before carries it over to the one setting", async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const at = new Date().toISOString();
    localStorage.setItem(
      'hallway.account.v2',
      JSON.stringify({
        version: 1,
        laptopPeerId: 'hallway-migrate',
        roster: [],
        rosterMergeSeen: true,
        classes: [
          { id: 'a', name: 'Period 1', createdAt: at, members: [] },
          { id: 'b', name: 'Period 2', createdAt: at, members: [], attendance: { graceMinutes: 4, absentAfterMinutes: 25 } },
        ],
        passes: [],
      }),
    );
  });
  await page.goto('/pass-options');
  await expect(page.getByRole('switch', { name: 'Take attendance' })).toBeChecked();
  await expect(page.getByLabel(/before an arrival is tardy/)).toHaveValue('4');
  await expect(page.getByLabel(/hasn't arrived is absent/)).toHaveValue('25');
});
