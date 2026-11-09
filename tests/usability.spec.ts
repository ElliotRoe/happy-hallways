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
      'hallway.account.v2',
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
  await expect(page.getByRole('row', { name: /Ana B\./ })).toContainText('Came back');
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

test('the teacher adds students to a line, takes one out, and clears it, from Home', async ({ page }) => {
  await setUp(page);
  await page.goto('/');
  const lineFor = page.locator('.stack', { hasText: 'In line for Bathroom 1' });
  for (const name of ['Ana B.', 'Max C.']) {
    await page.getByLabel('Student to add to a line').selectOption({ label: name });
    await page.getByRole('button', { name: 'Add', exact: true }).click();
  }
  await expect(lineFor.locator('.line-list li')).toHaveCount(2);
  await expect(lineFor.locator('.line-list li').first()).toContainText('Ana B.');

  await page.getByRole('button', { name: 'Take Ana B. out of the line' }).click();
  await expect(lineFor.locator('.line-list li')).toHaveText([/Max C\./]);

  await lineFor.getByRole('button', { name: 'Clear' }).click();
  await expect(lineFor).toHaveCount(0);
});

test('a trip to a Private destination shows only as "Out" on the kiosk, but the teacher sees where', async ({ page }) => {
  await setUp(page, {
    destinations: [
      { id: 'b1', label: 'Bathroom 1', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 },
      { id: 'nurse', label: 'Nurse', minutes: 15, color: 'pink', icon: 'stethoscope', limit: null, private: true },
    ],
  });
  await page.goto('/door');
  await page.getByRole('button', { name: /Ana B\./ }).click();
  await page.getByRole('button', { name: /^Nurse/ }).click();
  await expect(page.getByText('Ana B.: you can go')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  const ana = page.getByRole('button', { name: /Ana B\./ });
  await expect(ana).toContainText('Out');
  await expect(ana).not.toContainText('Nurse');

  // The teacher still sees where.
  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('hallway.account.v2')!);
    account.kiosk.locked = false;
    localStorage.setItem('hallway.account.v2', JSON.stringify(account));
  });
  await page.goto('/');
  await expect(page.getByRole('row', { name: /Ana B\./ })).toContainText('Nurse');
});

test('making a destination Private takes away its limit', async ({ page }) => {
  await setUp(page);
  await page.goto('/destinations');
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('checkbox', { name: /^Private/ }).check();
  await expect(page.getByLabel('Students here at once')).toHaveCount(0);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('button', { name: /^Bathroom 1/ })).toContainText('Private, no limit');
});

test("on the teacher's own computer, a stopped student is told to ask the teacher, who can let them go", async ({ page }) => {
  await setUp(page, {
    passes: [
      { id: 'p-zoe', classId: 'p1', studentId: 'zoe', studentName: 'Zoe A.', destination: 'Bathroom 1', minutes: 5, outAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    ],
  });
  await page.goto('/door');
  await page.getByRole('button', { name: /Ana B\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Need to go now? Ask your teacher to let you go.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask my teacher' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Teacher: let them go' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Teacher PIN' })).toHaveCount(0);
});

test("a kiosk that can't reach the teacher's computer shows Ask my teacher, turned off, and says why", async ({ page }) => {
  await page.goto('/door');
  await page.evaluate(() => {
    const at = new Date().toISOString();
    const setup = {
      classes: [{ id: 'p1', name: 'Period 1', students: [{ id: 'ana', name: 'Ana B.' }, { id: 'zoe', name: 'Zoe A.' }] }],
      destinations: [{ id: 'b1', label: 'Bathroom 1', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 }],
      lineEnabled: true,
      passAllowance: { enabled: false, passes: 3, per: 'week', whenUsedUp: 'stop', since: at },
      countedPasses: [],
      activeClass: { id: 'p1', changedAt: at },
      pin: '2468',
      passes: [{ id: 'p', classId: 'p1', studentId: 'zoe', studentName: 'Zoe A.', destination: 'Bathroom 1', minutes: 5, outAt: at, updatedAt: at }],
      line: [{ studentId: 'ana', studentName: 'Ana B.', classId: 'p1', destination: 'Bathroom 1', joinedAt: at }],
    };
    localStorage.setItem('hallway.door', JSON.stringify({ laptopPeerId: 'closed-laptop', kioskId: 'k', secret: 's', setup, returns: [] }));
  });
  await page.reload();
  // Ana is in line and taps her name before her turn: the In line sheet.
  await page.getByRole('button', { name: /Ana B\./ }).click();
  await expect(page.getByRole('button', { name: 'Ask my teacher' })).toBeDisabled();
  await expect(page.getByText("Your teacher's computer isn't connected")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Teacher: let them go' })).toBeVisible();
});

test('the separate-bathroom-lines tip on Destinations opens the guide, and stays closed once closed', async ({ page }) => {
  await setUp(page);
  await page.goto('/destinations');
  const tip = page.getByRole('complementary', { name: 'Tip' });
  await expect(tip.getByRole('link', { name: 'Open guide' })).toHaveAttribute('href', '/guides/separate-bathroom-lines');
  await tip.getByRole('button', { name: 'Close this tip' }).click();
  await expect(tip).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Where students can go' })).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Tip' })).toHaveCount(0);
});
