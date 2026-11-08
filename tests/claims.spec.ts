import { expect, test } from '@playwright/test';

/**
 * Claims on the Student link (docs/adr/0016): a student sets up their own
 * device with their name and PIN once, then signs out and back in from it.
 * The teacher's computer decides; there's no kiosk at all here.
 */
test('a student claims their own device with their PIN, then signs out and back in from it, with no kiosk', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await laptop.addLocatorHandler(laptop.locator('.tip'), async (tip) => {
    await tip.getByRole('button', { name: /Skip|Got it/ }).click();
  });

  await laptop.goto('/classes/new');
  await laptop.getByLabel('Class name').fill('Period 2');
  await laptop.getByRole('button', { name: 'Create class' }).click();
  await laptop.getByLabel('One student per line').fill('Sam Lee, 1357\nAva Diaz, 2468');
  await laptop.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  await laptop.getByRole('button', { name: 'Class settings' }).click();
  await laptop.getByLabel('Students enter a PIN at the kiosk').check();
  await laptop.getByRole('button', { name: 'Save' }).click();

  await laptop.getByRole('link', { name: 'Student link', exact: true }).click();
  await laptop.getByRole('button', { name: 'Open student link' }).click();
  const url = await laptop.getByRole('textbox', { name: 'Student link' }).inputValue();
  await expect(laptop.getByText('Nobody is viewing right now')).toBeVisible({ timeout: 20_000 });

  // Claiming: pick a name, then the PIN. A wrong one is refused.
  await student.goto(url);
  await expect(student.getByRole('heading', { name: 'Period 2' })).toBeVisible({ timeout: 30_000 });
  await student.getByRole('button', { name: 'Sign out from this device' }).click();
  await student.getByRole('button', { name: 'Sam L.' }).click();
  await student.getByRole('textbox', { name: 'Your PIN' }).fill('9999');
  await student.getByRole('button', { name: 'Use this device' }).click();
  await expect(student.getByRole('alert')).toContainText("That PIN doesn't match");
  await student.getByRole('textbox', { name: 'Your PIN' }).fill('1357');
  await student.getByRole('button', { name: 'Use this device' }).click();
  await expect(student.getByRole('heading', { name: 'Sam L.' })).toBeVisible({ timeout: 10_000 });
  await expect(laptop.getByRole('listitem').filter({ hasText: 'Sam L.' })).toBeVisible();

  // The device remembers it's Sam's, and only Sam's.
  await student.reload();
  await expect(student.getByRole('button', { name: 'I need to leave' })).toBeVisible({ timeout: 30_000 });
  const stored = await student.evaluate(() => Object.keys(localStorage));
  expect(stored).toEqual([expect.stringMatching(/^hallway\.claim\./)]);

  // Sam signs out from the device; the teacher's computer decides, and marks where it came from.
  await student.getByRole('button', { name: 'I need to leave' }).click();
  await student.getByRole('button', { name: /^Bathroom/ }).click();
  await expect(student.getByRole('alert')).toContainText('Sam L.: Bathroom');
  await expect(student.getByText(/Out · .*Bathroom · 0 min/)).toBeVisible();
  await laptop.getByRole('link', { name: 'History', exact: true }).click();
  const row = laptop.getByRole('row', { name: /Sam L\./ });
  await expect(row).toContainText('Still out', { timeout: 10_000 });
  await expect(row).toContainText('Student link');

  // Back again.
  await student.getByRole('button', { name: "I'm back" }).click();
  await expect(student.getByRole('button', { name: 'I need to leave' })).toBeVisible({ timeout: 10_000 });
  await expect(row).not.toContainText('Still out', { timeout: 10_000 });

  // The teacher stops the device acting as Sam; it goes back to only looking.
  await laptop.getByRole('link', { name: 'Student link', exact: true }).click();
  await laptop.getByRole('listitem').filter({ hasText: 'Sam L.' }).getByRole('button', { name: 'Stop' }).click();
  await expect(student.getByRole('button', { name: 'Sign out from this device' })).toBeVisible({ timeout: 10_000 });
  expect(await student.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('on shared devices, every Claim ends when the class on the kiosk changes', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const at = new Date(Date.now() - 60_000).toISOString();
    localStorage.setItem(
      'hallway.account',
      JSON.stringify({
        version: 1,
        laptopPeerId: 'hallway-claims',
        roster: [{ id: 'sam', firstName: 'Sam', lastName: 'Lee', pin: '1357' }],
        rosterMergeSeen: true,
        classes: [
          { id: 'p1', name: 'Period 1', createdAt: at, members: [{ studentId: 'sam', lastPrefix: 'L', status: 'current' }] },
          { id: 'p2', name: 'Period 2', createdAt: at, members: [] },
        ],
        passes: [],
        lineEnabled: false,
        line: [],
        requests: [],
        deniedRequests: [],
        pin: '2468',
        kiosk: null,
        activeClass: { id: 'p1', changedAt: at },
        replacedKiosks: [],
        networkBlocked: false,
        studentLink: { id: 'link', open: true },
        claims: [{ token: 'secret', studentId: 'sam', claimedAt: at }],
        claimsEndWithClass: true,
        seenPopups: {},
      }),
    );
  });
  // A returning teacher sees what's changed first; close it whenever it shows.
  await page.addLocatorHandler(page.locator('[aria-labelledby="whats-changed-title"]'), async () => {
    await page.keyboard.press('Escape');
  });
  await page.goto('/student-link');
  await expect(page.getByRole('listitem').filter({ hasText: 'Sam L.' })).toBeVisible();
  await expect(page.getByLabel(/Students share devices/)).toBeChecked();

  await page.locator('.status-box').click();
  await page.getByRole('button', { name: /^Class on the kiosk:/ }).click();
  await page.getByRole('menuitemradio', { name: 'Period 2' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.account')!));
  expect(saved.claims).toEqual([]);
});
