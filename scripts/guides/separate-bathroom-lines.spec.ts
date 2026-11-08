import { expect, test, type Page } from '@playwright/test';
import { circle, createClass, snap } from './helpers.ts';

/** Pictures for the guide at /guides/separate-bathroom-lines. */
const guide = 'separate-bathroom-lines';

/** Fills in the open destination window. Leaves it open, so the picture can show it. */
async function fillDestination(page: Page, name: string, limit: string, color: string, icon: string) {
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel(/Minutes the trip should take/).fill('5');
  await dialog.getByLabel('Students here at once').selectOption({ label: limit });
  await dialog.getByRole('button', { name: color }).click();
  await dialog.getByLabel('Search icons').fill(icon);
  await dialog.getByRole('button', { name: icon, exact: true }).click();
  await dialog.getByLabel('Search icons').fill('');
}

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
}

test('a separate line for each bathroom', async ({ page }) => {
  await createClass(page, 'Period 3', ['Ava Johnson', 'Mia Rodriguez', 'Liam Chen', 'Noah Patel']);

  // The guide doesn't assume the teacher has a bathroom already, so the pictures start without one.
  await page.getByRole('link', { name: 'Destinations' }).click();
  for (const name of [/^Bathroom 1/, /^Bathroom 2/]) {
    await page.getByRole('button', { name }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  }
  const add = page.getByRole('button', { name: 'Add destination' }).first();
  for (const [name, color, icon] of [
    ['Nurse', 'pink', 'stethoscope'],
    ['Library', 'purple', 'book open'],
  ]) {
    await add.click();
    await fillDestination(page, name, 'No limit', color, icon);
    await save(page);
  }

  // 1. Add a destination.
  await circle(add);
  await snap(page, guide, '1-add-destination', page.getByRole('heading', { name: 'Where students can go' }));

  // 2. The first bathroom, one student at a time.
  await add.click();
  await fillDestination(page, 'Left Hall Bathroom', '1 at a time', 'blue', 'toilet');
  await circle(page.getByRole('dialog').getByLabel('Name'));
  await circle(page.getByRole('dialog').getByLabel('Students here at once'));
  await snap(page, guide, '2-first-bathroom');
  await save(page);

  // 3. The second bathroom, the same way.
  await add.click();
  await fillDestination(page, 'Right Hall Bathroom', '1 at a time', 'teal', 'toilet');
  await circle(page.getByRole('dialog').getByLabel('Name'));
  await circle(page.getByRole('dialog').getByLabel('Students here at once'));
  await snap(page, guide, '3-second-bathroom');
  await save(page);

  // 4. Each bathroom has its own limit.
  await circle(page.getByRole('button', { name: /^Left Hall Bathroom/ }));
  await circle(page.getByRole('button', { name: /^Right Hall Bathroom/ }));
  await snap(page, guide, '4-both-bathrooms');

  // 5. Turn on lines.
  await page.getByRole('link', { name: 'Pass Options' }).click();
  const lines = page.getByRole('switch', { name: 'Let students line up' });
  await lines.check();
  const row = page.locator('.option-row').filter({ has: lines });
  await circle(row.locator('.switch'));
  await snap(page, guide, '5-turn-on-lines', row);

  // At the kiosk: Ava is at the left hall bathroom, so Mia lines up for it while Liam goes straight to the right hall.
  await page.getByRole('link', { name: 'Kiosk', exact: true }).click();
  await page.getByLabel('PIN (4 to 8 digits)').fill('2468');
  await page.getByRole('button', { name: 'Save PIN' }).click();
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await page.getByRole('button', { name: /^Ava/ }).click();
  await page.getByRole('button', { name: /^Left Hall Bathroom/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /^Mia/ }).click();
  await circle(page.getByRole('button', { name: /^Left Hall Bathroom/ }));
  await circle(page.getByRole('button', { name: /^Right Hall Bathroom/ }));
  await snap(page, guide, '6-kiosk-one-full');
  await page.getByRole('button', { name: /^Left Hall Bathroom/ }).click();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: /^Liam/ }).click();
  await page.getByRole('button', { name: /^Right Hall Bathroom/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('2 out · 1 in line')).toBeVisible();
  await snap(page, guide, '7-kiosk-line');
});
