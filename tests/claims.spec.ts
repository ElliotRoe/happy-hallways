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
  await laptop.getByRole('link', { name: 'Roster', exact: true }).click();
  await laptop.getByRole('switch', { name: 'Students use PINs' }).check();

  await laptop.getByRole('link', { name: 'Student devices', exact: true }).click();
  await laptop.getByRole('button', { name: 'Turn on student devices' }).click();
  const url = await laptop.getByRole('textbox', { name: 'Join link' }).inputValue();
  await expect(laptop.getByText('Nobody is viewing right now')).toBeVisible({ timeout: 20_000 });

  // Claiming: type your first name and PIN. No names are ever sent to the device; a wrong PIN is refused.
  await student.goto(url);
  await expect(student.getByRole('heading', { name: 'Period 2' })).toBeVisible({ timeout: 30_000 });
  await expect(student.locator('main')).not.toContainText('Sam');
  await expect(student.locator('main')).not.toContainText('Ava');
  await student.getByRole('button', { name: 'Use this device for passes' }).click();
  await student.getByLabel('Your first name').fill('sam');
  await student.getByLabel('Your PIN').fill('9999');
  await student.getByRole('button', { name: 'Use this device' }).click();
  await expect(student.getByRole('alert')).toContainText("don't match anyone");
  await student.getByLabel('Your PIN').fill('1357');
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
  await student.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(student.getByRole('alert')).toContainText('Sam L.: Bathroom');
  await expect(student.getByText(/Out at Bathroom 1 · 0 min/)).toBeVisible();
  // Everyone sees how many are out, never who.
  await expect(student.getByRole('region', { name: /Out of class/ })).toContainText('Bathroom 1');
  await laptop.getByRole('link', { name: 'History', exact: true }).click();
  const row = laptop.getByRole('row', { name: /Sam L\./ });
  await expect(row).toContainText('Still out', { timeout: 10_000 });
  await expect(row).toContainText('Student device');

  // Back again.
  await student.getByRole('button', { name: "I'm back" }).click();
  await expect(student.getByRole('button', { name: 'I need to leave' })).toBeVisible({ timeout: 10_000 });
  await expect(row).not.toContainText('Still out', { timeout: 10_000 });

  // The teacher stops the device acting as Sam; it goes back to only looking.
  await laptop.getByRole('link', { name: 'Student devices', exact: true }).click();
  await laptop.getByRole('listitem').filter({ hasText: 'Sam L.' }).getByRole('button', { name: 'Stop' }).click();
  await expect(student.getByRole('button', { name: 'Use this device for passes' })).toBeVisible({ timeout: 10_000 });
  expect(await student.evaluate(() => Object.keys(localStorage))).toEqual([]);
});

test('each class is a new Room with a new code, and every Claim ends with its Room', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => {
    const at = new Date(Date.now() - 60_000).toISOString();
    localStorage.setItem(
      'hallway.account.v2',
      JSON.stringify({
        version: 1,
        laptopPeerId: 'hallway-claims',
        roster: [{ id: 'sam', firstName: 'Sam', lastName: 'Lee', pin: '1357' }],
        rosterMergeSeen: true,
        studentPins: true,
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
        studentLink: { open: true, room: { code: '481516', classId: 'p1', startedAt: at } },
        claims: [{ token: 'secret', studentId: 'sam', claimedAt: at }],
        seenPopups: {},
      }),
    );
  });
  // A returning teacher sees what's changed first; close it whenever it shows.
  await page.addLocatorHandler(page.locator('[aria-labelledby="whats-changed-title"]'), async () => {
    await page.keyboard.press('Escape');
  });
  await page.goto('/student-link');
  // The code itself is on Home and the kiosk; this page has the link to share.
  await expect(page.getByRole('textbox', { name: 'Join link' })).toHaveValue(/481516/);
  await expect(page.getByRole('listitem').filter({ hasText: 'Sam L.' })).toBeVisible();

  await page.locator('.status-box').click();
  await page.getByRole('button', { name: /^Class on the kiosk:/ }).click();
  await page.getByRole('menuitemradio', { name: 'Period 2' }).click();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.account.v2')!));
  expect(saved.claims).toEqual([]);
  expect(saved.studentLink.room.classId).toBe('p2');
  expect(saved.studentLink.room.code).toMatch(/^\d{6}$/);
  expect(saved.studentLink.room.code).not.toBe('481516');
});

test('students type the class code at /join', async ({ page }) => {
  await page.goto('/join');
  await page.getByLabel('Class code').fill('481 516');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(/\/join\/481516$/);
});

test('a link with ?code= fills in the class code', async ({ page }) => {
  await page.goto('/join?code=481516');
  await expect(page.getByLabel('Class code')).toHaveValue('481516');
  await page.getByRole('button', { name: 'Join' }).click();
  await expect(page).toHaveURL(/\/join\/481516$/);
});

test("the teacher reloading doesn't end a student's setup: their device says it's reconnecting, then carries on", async ({ browser }) => {
  test.setTimeout(120_000);
  const laptop = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await laptop.addLocatorHandler(laptop.locator('.tip'), async (tip) => {
    await tip.getByRole('button', { name: /Skip|Got it/ }).click();
  });
  await laptop.goto('/classes/new');
  await laptop.getByLabel('Class name').fill('Period 2');
  await laptop.getByRole('button', { name: 'Create class' }).click();
  await laptop.getByLabel('One student per line').fill('Sam Lee, 1357');
  await laptop.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  await laptop.getByRole('link', { name: 'Roster', exact: true }).click();
  await laptop.getByRole('switch', { name: 'Students use PINs' }).check();
  await laptop.getByRole('link', { name: 'Student devices', exact: true }).click();
  await laptop.getByRole('button', { name: 'Turn on student devices' }).click();
  const url = await laptop.getByRole('textbox', { name: 'Join link' }).inputValue();
  await expect(laptop.getByText('Nobody is viewing right now')).toBeVisible({ timeout: 20_000 });
  await student.goto(url);
  await student.getByRole('button', { name: 'Use this device for passes' }).click();
  await student.getByLabel('Your first name').fill('sam');
  await student.getByLabel('Your PIN').fill('1357');
  await student.getByRole('button', { name: 'Use this device' }).click();
  await expect(student.getByRole('button', { name: 'I need to leave' })).toBeVisible({ timeout: 20_000 });
  const code = url.split('/').pop();

  await laptop.reload();
  await expect(student.getByRole('heading', { name: /Reconnecting to your teacher's computer/ })).toBeVisible({ timeout: 20_000 });
  await expect(student.getByText("Can't reach this class")).toHaveCount(0);
  await expect(student.getByRole('button', { name: 'I need to leave' })).toBeVisible({ timeout: 40_000 });
  // Same class code, and the device is still Sam's.
  expect(await laptop.evaluate(() => JSON.parse(localStorage.getItem('hallway.account.v2')!).studentLink.room.code)).toBe(code);
  expect(await student.evaluate(() => Object.keys(localStorage))).toEqual([`hallway.claim.${code}`]);
});
