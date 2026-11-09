import { expect, test, type Page } from '@playwright/test';

/** Small things teachers asked for. */

test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.locator('.tip'), async (tip) => {
    await tip.getByRole('button', { name: /Skip|Got it/ }).click();
  });
  await page.addLocatorHandler(page.locator('[aria-labelledby="whats-changed-title"]'), async () => {
    await page.keyboard.press('Escape');
  });
});

/** A class with three students, imported in the "wrong" order, on this computer's kiosk. */
async function setUp(page: Page, extra: object = {}) {
  await page.goto('/');
  await page.evaluate((extra) => {
    const at = new Date().toISOString();
    localStorage.setItem(
      'hallway.account',
      JSON.stringify({
        version: 1,
        laptopPeerId: 'hallway-usability',
        roster: [
          { id: 'zoe', firstName: 'Zoe', lastName: 'Adams' },
          { id: 'ana', firstName: 'Ana', lastName: 'Brown' },
          { id: 'max', firstName: 'Max', lastName: 'Cole' },
        ],
        rosterMergeSeen: true,
        classes: [
          {
            id: 'p1',
            name: 'Period 1',
            createdAt: at,
            members: [
              { studentId: 'zoe', lastPrefix: 'A', status: 'current' },
              { studentId: 'ana', lastPrefix: 'B', status: 'current' },
              { studentId: 'max', lastPrefix: 'C', status: 'current' },
            ],
          },
        ],
        destinations: [
          { id: 'b1', label: 'Bathroom 1', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 },
          { id: 'nurse', label: 'Nurse', minutes: 15, color: 'pink', icon: 'stethoscope', limit: null },
        ],
        passes: [],
        lineEnabled: true,
        line: [],
        requests: [],
        deniedRequests: [],
        pin: '2468',
        kiosk: { kind: 'this-computer', locked: false },
        activeClass: { id: 'p1', changedAt: at },
        replacedKiosks: [],
        networkBlocked: false,
        studentLink: null,
        claims: [],
        attendance: [],
        ...extra,
      }),
    );
    // Needs you starts closed here, so it doesn't sit over the bottom of short pages.
    localStorage.setItem('hallway.drawer-open', 'false');
  }, extra);
}

test('the kiosk lists students A to Z by the name it shows', async ({ page }) => {
  await setUp(page);
  await page.goto('/door');
  await expect(page.locator('.name .name-text')).toHaveText(['Ana B.', 'Max C.', 'Zoe A.']);
});

test('destinations can be reordered, and the kiosk shows them in that order', async ({ page }) => {
  await setUp(page);
  await page.goto('/destinations');
  await page.getByRole('button', { name: 'Move Nurse' }).focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.destination-card strong')).toHaveText(['Nurse', 'Bathroom 1']);
  await page.goto('/door');
  await page.getByRole('button', { name: /Ana B\./ }).click();
  await expect(page.locator('.choices button').first()).toContainText('Nurse');
});

/** Ana took one pass today, and the Pass Allowance is one a day. */
async function anaUsedHerPass(page: Page) {
  const out = new Date(Date.now() - 20 * 60_000).toISOString();
  const back = new Date(Date.now() - 15 * 60_000).toISOString();
  await setUp(page, {
    passAllowance: { enabled: true, passes: 1, per: 'day', whenUsedUp: 'stop', since: out },
    passes: [
      { id: 'p-ana', classId: 'p1', studentId: 'ana', studentName: 'Ana B.', destination: 'Bathroom 1', minutes: 5, outAt: out, inAt: back, endedBy: 'student', updatedAt: back },
    ],
  });
}

test('a pass tapped by mistake can be cancelled from History, and the student gets it back', async ({ page }) => {
  await anaUsedHerPass(page);
  await page.goto('/classes/p1');
  await expect(page.getByRole('row', { name: /Ana B\./ })).toContainText('1 of 1');

  await page.goto('/history');
  await page.getByRole('row', { name: /Ana B\./ }).getByRole('button', { name: 'Correct this pass' }).click();
  await page.getByRole('button', { name: 'Cancel pass, give it back' }).click();
  await expect(page.getByRole('row', { name: /Ana B\./ })).toContainText('Cancelled, given back');
  await expect(page.getByRole('row', { name: /Ana B\./ })).toContainText('Corrected');

  await page.goto('/classes/p1');
  await expect(page.getByRole('row', { name: /Ana B\./ })).toContainText('0 of 1');

  // And back again, if that was the mistake.
  await page.goto('/history');
  await page.getByRole('row', { name: /Ana B\./ }).getByRole('button', { name: 'Correct this pass' }).click();
  await page.getByRole('button', { name: 'Count it again' }).click();
  await expect(page.getByRole('row', { name: /Ana B\./ })).toContainText('Signed back in');
});

test('the teacher can leave a note on a pass, shown in History and in the CSV', async ({ page }) => {
  await anaUsedHerPass(page);
  await page.goto('/history');
  await page.getByRole('row', { name: /Ana B\./ }).getByRole('button', { name: 'Correct this pass' }).click();
  await page.getByLabel('Note (only you see it)').fill('Stopped at the office');
  await page.getByRole('button', { name: 'Save correction' }).click();
  const row = page.getByRole('row', { name: /Ana B\./ });
  await expect(row).toContainText('Stopped at the office');
  await expect(row).not.toContainText('Corrected');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Download CSV' }).click()]);
  const csv = await (await download.createReadStream())!.toArray().then((chunks) => Buffer.concat(chunks).toString());
  expect(csv.split('\n')[0].endsWith(',Corrected,Note')).toBe(true);
  expect(csv).toContain('Stopped at the office');
});
