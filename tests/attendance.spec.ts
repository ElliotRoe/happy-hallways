import { expect, test, type Page } from '@playwright/test';

/** Attendance (docs/adr/0020): the teacher's own log, recorded at the door. */

test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(page.locator('.tip'), async (tip) => {
    await tip.getByRole('button', { name: /Skip|Got it/ }).click();
  });
  await page.addLocatorHandler(page.locator('[aria-labelledby="whats-changed-title"]'), async () => {
    await page.keyboard.press('Escape');
  });
});

const clock = (date: Date) => `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/** A teacher whose Period 1 began `minutesAgo` minutes ago on the schedule, taking Attendance, on this computer's kiosk. */
async function setUp(page: Page, minutesAgo: number, attendance: { graceMinutes: number; absentAfterMinutes: number }, extra: object = {}) {
  await page.goto('/');
  const start = new Date(Date.now() - minutesAgo * 60_000);
  const end = new Date(Date.now() + 40 * 60_000);
  await page.evaluate(
    ({ start, end, startAt, attendance, extra }) => {
      localStorage.setItem(
        'hallway.account',
        JSON.stringify({
          version: 1,
          laptopPeerId: 'hallway-attendance',
          roster: [
            { id: 'maya', firstName: 'Maya', lastName: 'Chen' },
            { id: 'jordan', firstName: 'Jordan', lastName: 'Ellis' },
          ],
          rosterMergeSeen: true,
          classes: [
            {
              id: 'p1',
              name: 'Period 1',
              createdAt: startAt,
              attendance,
              members: [
                { studentId: 'maya', lastPrefix: 'C', status: 'current' },
                { studentId: 'jordan', lastPrefix: 'E', status: 'current' },
              ],
            },
          ],
          destinations: [{ id: 'b1', label: 'Bathroom 1', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 }],
          schedules: [{ id: 's1', name: 'Schedule 1', periods: [{ id: 'per1', classId: 'p1', start, end }], rules: [], noPassTimes: [] }],
          currentScheduleId: 's1',
          passes: [],
          lineEnabled: false,
          line: [],
          requests: [],
          deniedRequests: [],
          pin: '2468',
          kiosk: { kind: 'this-computer', locked: false },
          activeClass: { id: 'p1', changedAt: startAt, onSchedule: true },
          replacedKiosks: [],
          networkBlocked: false,
          studentLink: null,
          claims: [],
          attendance: [],
          ...extra,
        }),
      );
    },
    { start: clock(start), end: clock(end), startAt: start.toISOString(), attendance, extra },
  );
}

const saved = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('hallway.account')!));

/** Opening the kiosk screen locks this computer as the kiosk; the teacher's PIN would unlock it. */
async function unlockAndGo(page: Page, path: string) {
  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('hallway.account')!);
    account.kiosk.locked = false;
    localStorage.setItem('hallway.account', JSON.stringify(account));
  });
  await page.goto(path);
}

test('students tap in at the kiosk; a late Arrival is Tardy for the teacher, but the door never says so', async ({ page }) => {
  await setUp(page, 10, { graceMinutes: 5, absentAfterMinutes: 30 });
  await page.goto('/door');
  const maya = page.getByRole('button', { name: /Maya C\./ });
  await expect(maya).toContainText('Tap when you arrive');

  await maya.click();
  await expect(page.getByText('Welcome, Maya C.')).toBeVisible();
  await expect(page.locator('.door')).not.toContainText(/tardy/i);
  const mark = (await saved(page)).attendance.find((each: { studentId: string }) => each.studentId === 'maya');
  expect(mark.status).toBe('tardy');
  expect(mark.tardyMinutes).toBeGreaterThanOrEqual(9);

  // Once arrived, tapping their name goes on to a pass as usual.
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(maya).toContainText('In class');
  await maya.click();
  await expect(page.getByText('Where are you going?')).toBeVisible();
});

test('a student who never arrives is Absent and hidden from the door; the teacher marking them arrived makes them Tardy', async ({ page }) => {
  await setUp(page, 20, { graceMinutes: 0, absentAfterMinutes: 15 });
  await page.goto('/classes/p1');
  const attendance = page.getByRole('region', { name: "Today's attendance" });
  await expect(attendance.getByRole('row', { name: /Jordan E\./ })).toContainText('Absent', { timeout: 20_000 });
  await expect(attendance.getByRole('row', { name: /Maya C\./ })).toContainText('Absent');

  // Hidden from the door.
  await page.goto('/door');
  await expect(page.getByText('Tap your name')).toBeVisible();
  await expect(page.getByRole('button', { name: /Maya C\.|Jordan E\./ })).toHaveCount(0);

  // Jordan turns up late; the teacher marks him arrived, and he's back on the door.
  await unlockAndGo(page, '/classes/p1');
  await attendance.getByLabel('Mark Jordan E.').selectOption('present');
  await expect(attendance.getByRole('row', { name: /Jordan E\./ })).toContainText('Tardy');
  await expect(attendance.getByRole('row', { name: /Jordan E\./ })).toContainText('Corrected');
  await page.goto('/door');
  await expect(page.getByRole('button', { name: /Jordan E\./ })).toContainText('In class');
  await expect(page.getByRole('button', { name: /Maya C\./ })).toHaveCount(0);
  await unlockAndGo(page, '/classes/p1');

  // The teacher excuses it; History shows it and exports it.
  await attendance.getByRole('row', { name: /Jordan E\./ }).getByLabel('Excused').check();
  await page.getByRole('link', { name: 'History', exact: true }).click();
  const history = page.getByRole('region', { name: 'Attendance' });
  await expect(history.getByRole('row', { name: /Jordan E\./ })).toContainText('Tardy');
  await expect(history.getByRole('row', { name: /Jordan E\./ })).toContainText('excused');
  const [download] = await Promise.all([page.waitForEvent('download'), history.getByRole('button', { name: 'Download attendance CSV' }).click()]);
  const csv = await (await download.createReadStream())!.toArray().then((chunks) => Buffer.concat(chunks).toString());
  expect(csv.split('\n')[0]).toBe('Date,Class,Student,Status,Arrived,Tardy minutes,Excused,Gone for the day,Corrected');
  expect(csv).toMatch(/Period 1,Jordan E\.,Tardy,.*,yes,,yes/);
  expect(csv).toMatch(/Period 1,Maya C\.,Absent/);
});

test('a class that takes no Attendance shows no arrival tap', async ({ page }) => {
  await setUp(page, 10, { graceMinutes: 0, absentAfterMinutes: 30 });
  await page.evaluate(() => {
    const account = JSON.parse(localStorage.getItem('hallway.account')!);
    delete account.classes[0].attendance;
    localStorage.setItem('hallway.account', JSON.stringify(account));
  });
  await page.goto('/door');
  await expect(page.getByRole('button', { name: /Maya C\./ })).toContainText('In class');
});

test("a kiosk that can't reach the teacher's computer still records an Arrival, to hand over later", async ({ page }) => {
  await page.goto('/door');
  await page.evaluate(() => {
    const at = new Date().toISOString();
    const setup = {
      classes: [{ id: 'p1', name: 'Period 1', students: [{ id: 'maya', name: 'Maya C.' }] }],
      destinations: [{ id: 'b1', label: 'Bathroom 1', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 }],
      lineEnabled: false,
      passAllowance: { enabled: false, passes: 3, per: 'week', whenUsedUp: 'stop', since: at },
      countedPasses: [],
      activeClass: { id: 'p1', changedAt: at },
      pin: '2468',
      passes: [],
      arrivals: { classId: 'p1', studentIds: [] },
    };
    localStorage.setItem('hallway.door', JSON.stringify({ laptopPeerId: 'closed-laptop', kioskId: 'k', secret: 's', setup, returns: [] }));
  });
  await page.reload();
  const maya = page.getByRole('button', { name: /Maya C\./ });
  await expect(maya).toContainText('Tap when you arrive');
  await maya.click();
  await expect(page.getByText('Welcome, Maya C.')).toBeVisible();
  await expect(page.getByText(/1 tap saved here/)).toBeVisible();
  const device = await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.door')!));
  expect(device.arrivals).toEqual([{ classId: 'p1', studentId: 'maya', at: expect.any(String) }]);
});
