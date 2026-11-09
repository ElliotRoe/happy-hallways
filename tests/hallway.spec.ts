import { expect, test, type Page } from '@playwright/test';

async function createClassWithRoster(page: Page, name: string) {
  await page.goto('/classes/new');
  await page.getByLabel('Class name').fill(name);
  await page.getByRole('button', { name: 'Create class' }).click();
  await page.getByLabel('One student per line').fill('Maya Chen\nMaya Carter\nJordan Ellis');
  await page.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  // In a second class, the same names are offered as the same students already on the Roster.
  const sameStudents = page.getByText('Is each one the same student?');
  if (await sameStudents.isVisible({ timeout: 1_000 }).catch(() => false)) {
    await page.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  }
  await expect(page.getByText(/3 students/)).toBeVisible();
}

/** Drags down the open schedule's calendar, from and to so many pixels below its top (7 AM, a minute and a half to the pixel). */
async function dragOnCalendar(page: Page, from: number, to: number) {
  // The calendar scrolls on its own; start from its top so the pixels line up with what's on screen.
  await page.locator('.calendar').evaluate((calendar) => calendar.scrollTo(0, 0));
  const box = (await page.locator('.grid').boundingBox())!;
  await page.mouse.move(box.x + box.width / 4, box.y + from);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 4, box.y + to, { steps: 5 });
  await page.mouse.up();
}

/** Tips point out what's new on a page. They're closed as they appear, so they never cover what a test clicks next. */
function skipTips(page: Page) {
  return page.addLocatorHandler(page.locator('.tip'), async (tip) => {
    await tip.getByRole('button', { name: /Skip|Got it/ }).click();
  });
}

test.beforeEach(async ({ page }) => {
  await skipTips(page);
});

/** The status box at the top of the sidebar leads Home. */
async function goHome(page: Page) {
  await page.locator('.status-box').click();
  await expect(page.getByRole('button', { name: /^Class on the kiosk:/ })).toBeVisible();
}

/** Chooses from one of Home's menus: the class on the kiosk, or the schedule. */
async function choose(page: Page, menu: 'Class on the kiosk' | 'Schedule', option: string) {
  await page.getByRole('button', { name: new RegExp(`^${menu}:`) }).click();
  await page.getByRole('menuitemradio', { name: option }).click();
}

/** Picks the schedule the kiosk follows today, on Home. */
async function useScheduleOnHome(page: Page, name = 'Schedule 1') {
  await goHome(page);
  await choose(page, 'Schedule', name);
  await expect(page.locator('.status-box')).toContainText(name);
}

/** "No passes now" is in the control drawer in the corner; it opens the drawer first if it's down. */
async function noPassesNow(page: Page) {
  const tab = page.locator('.drawer .tab');
  if ((await tab.getAttribute('aria-expanded')) === 'false') await tab.click();
  await page.getByRole('button', { name: 'No passes now' }).click();
}

async function setPin(page: Page) {
  await page.getByRole('link', { name: 'Kiosk', exact: true }).click();
  await page.getByLabel('PIN (4 to 8 digits)').fill('2468');
  await page.getByRole('button', { name: 'Save PIN' }).click();
}

/** A brand-new schedule, open in its editor. */
async function newSchedule(page: Page) {
  await page.getByRole('link', { name: /^Schedule/ }).click();
  await page.getByRole('button', { name: /^(No schedules|New schedule)/ }).click();
  await expect(page.getByRole('heading', { name: 'Create new schedule' })).toBeVisible();
}

/** One period on the open schedule, from the list beside the calendar. */
async function addPeriod(page: Page, className: string, start: string, end: string) {
  await page.getByRole('button', { name: 'Add a period' }).click();
  const row = page.locator('.time-row').last();
  await row.getByLabel('Class', { exact: true }).selectOption({ label: className });
  await row.getByLabel('Ends').fill(end);
  await row.getByLabel('Starts').fill(start);
}

/** A schedule where the class runs 9:00 to 10:00, with no passes in its first half hour, turned on. */
async function scheduleNoPassesUntil930(page: Page, className: string) {
  await newSchedule(page);
  await addPeriod(page, className, '09:00', '10:00');
  // A period's card, opened from the calendar, holds its no-pass minutes.
  await page.locator('.grid .period .block-body').click();
  await page.getByLabel('No passes, first').fill('30');
  await page.getByLabel('No passes, first').press('Tab');
  await useScheduleOnHome(page);
}

test('a teacher runs the kiosk on their own computer', async ({ page }) => {
  await createClassWithRoster(page, 'Period 1');
  await expect(page.getByText('Maya Ch.')).toBeVisible();

  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await expect(page.getByRole('heading', { name: 'Tap your name' })).toBeVisible();

  // Sign out; the limit of 1 then refuses a second student.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Pass approved', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Please wait in class')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // Leaving the kiosk asks first; teacher pages stay locked until the PIN is entered.
  const asked = new Promise<string>((resolve) =>
    page.once('dialog', async (dialog) => {
      resolve(dialog.type());
      await dialog.accept();
    }),
  );
  await page.goto('/kiosk');
  expect(await asked).toBe('beforeunload');
  await expect(page).toHaveURL(/\/door/);

  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await expect(page.getByText('Welcome back', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("Everyone's in class")).toBeVisible();
  await expect(page.locator('.activity')).toContainText('Jordan E. came back');

  await page.getByRole('link', { name: /^Period 1/ }).click();
  await expect(page.getByRole('row', { name: /Jordan E\./ })).toContainText('1');
});

test('export and import put the teacher back where they were', async ({ page }) => {
  await createClassWithRoster(page, 'Period 2');
  await page.getByLabel('Main').getByRole('link', { name: 'Settings' }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download backup' }).click();
  const file = await (await download).path();

  await page.evaluate(() => localStorage.clear());
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await page.goto('/settings');
  await page.locator('input[type=file]').setInputFiles(file!);
  await expect(page.getByRole('button', { name: 'Replace everything' })).toBeDisabled();
  await page.getByRole('radio', { name: /My own/ }).check();
  await page.getByRole('button', { name: 'Replace everything' }).click();
  await expect(page.locator('.status-box')).toContainText('Period 2');
  await page.getByRole('link', { name: /^Period 2/ }).click();
  await expect(page.getByText(/3 students/)).toBeVisible();
});

test('a paired device runs the door and syncs to the laptop', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();

  await createClassWithRoster(laptop, 'Period 3');
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  const code = (await laptop.locator('.pair-code').textContent())!.trim();

  await tablet.goto(`/door?code=${code}`);
  await expect(tablet.getByRole('heading', { name: 'Tap your name' })).toBeVisible({ timeout: 30_000 });
  await expect(laptop.getByRole('heading', { name: 'Connected!' })).toBeVisible({ timeout: 30_000 });
  await expect(laptop.locator('.status-box')).toContainText('Kiosk online', { timeout: 10_000 });
  await laptop.getByRole('button', { name: 'Close' }).click();

  await tablet.getByRole('button', { name: /Maya Ca\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(tablet.getByText('Pass approved', { exact: true })).toBeVisible();

  await goHome(laptop);
  await expect(laptop.locator('.stat', { hasText: 'Out of class now' })).toContainText('1', { timeout: 15_000 });

  // The teacher marks the student back from the laptop; the door hears about it.
  await laptop.getByRole('button', { name: 'Mark back' }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  await expect(tablet.getByRole('button', { name: /Maya Ca\..*In class/ })).toBeVisible({ timeout: 15_000 });
});

test('a device paired from a second tab connects to the tab already holding the laptop address', async ({ browser }) => {
  const laptop = await browser.newContext();
  const olderTab = await laptop.newPage();
  const firstTablet = await (await browser.newContext()).newPage();
  const newTablet = await (await browser.newContext()).newPage();

  await createClassWithRoster(olderTab, 'Period 5');
  await setPin(olderTab);
  await olderTab.getByRole('button', { name: 'Pair a device' }).click();
  await expect(olderTab.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  await firstTablet.goto(`/door?code=${(await olderTab.locator('.pair-code').textContent())!.trim()}`);
  await expect(olderTab.locator('.status-box')).toContainText('Kiosk online', { timeout: 30_000 });
  await olderTab.getByRole('button', { name: 'Close' }).click();

  // A second tab can't claim the address the older tab holds, but can still pair.
  const newerTab = await laptop.newPage();
  await skipTips(newerTab);
  await newerTab.goto('/kiosk');
  // Another tab holds the connection, but the kiosk is still online as far as this tab can tell.
  await expect(newerTab.locator('.status-box')).toContainText('Kiosk online', { timeout: 20_000 });
  await newerTab.getByRole('button', { name: 'Pair a different device' }).click();
  await expect(newerTab.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  await newTablet.goto(`/door?code=${(await newerTab.locator('.pair-code').textContent())!.trim()}`);

  // The older tab heard about the new pairing, so it lets the new device in.
  await expect(newTablet.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(olderTab.locator('.status-box')).toContainText('Kiosk online', { timeout: 10_000 });

  // A pass reaches the older tab, and through it the newer one.
  await newTablet.getByRole('button', { name: /Maya Ca\./ }).click();
  await newTablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(newTablet.getByText('Pass approved', { exact: true })).toBeVisible();
  await goHome(newerTab);
  await expect(newerTab.locator('.stat', { hasText: 'Out of class now' })).toContainText('1', { timeout: 15_000 });

  // A request approved in the newer tab reaches the kiosk through the older one.
  await newTablet.getByRole('button', { name: /Jordan E\./ }).click();
  await newTablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await newTablet.getByRole('button', { name: 'Ask my teacher' }).click();
  await newTablet.getByRole('button', { name: 'Done' }).click();
  const request = newerTab.locator('.requests li', { hasText: 'Jordan E.' });
  await request.getByRole('button', { name: 'Approve' }).click({ timeout: 15_000 });
  await expect(newTablet.getByRole('button', { name: /Jordan E\..*Out · Bathroom/ })).toBeVisible({ timeout: 15_000 });
});

test('students line up when the pass limit is reached', async ({ page }) => {
  await createClassWithRoster(page, 'Period 4');
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Full: Maya Ch. joins the line instead of being turned away.
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await expect(page.getByText("You're 1st in line")).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Maya Ch\..*1st in line/ })).toBeVisible();

  // Someone not in line can't take the spot that opens.
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await expect(page.getByText(/it's your turn/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Join the line?')).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();

  // Maya Ch. is up next and goes where she lined up for.
  await page.getByRole('button', { name: /Maya Ch\..*Your turn/ }).click();
  await expect(page.getByText('Maya Ch.: Bathroom')).toBeVisible();
});

test('pop-ups close with Escape or a click outside', async ({ page }) => {
  await createClassWithRoster(page, 'Period 6');
  await page.getByRole('button', { name: 'Add students' }).click();
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeHidden();

  await page.getByRole('button', { name: 'Add students' }).click();
  await page.mouse.click(5, 5);
  await expect(page.getByRole('heading', { name: 'Add students' })).toBeHidden();
});

test('no-pass times hold everyone back, but students can line up', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T09:10:00') });
  await createClassWithRoster(page, 'Period 1');
  await scheduleNoPassesUntil930(page, 'Period 1');

  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  await expect(page.getByText('No passes right now.')).toBeVisible();
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText(/Passes open at 9:30 AM. Join the line/)).toBeVisible();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Jordan E\..*1st in line/ })).toBeVisible();

  // Once the no-pass time ends, the first in line is called.
  await page.clock.runFor('21:00');
  await expect(page.getByText('No passes right now.')).toBeHidden();
  await page.getByRole('button', { name: /Jordan E\..*Your turn/ }).click();
  await expect(page.getByText('Jordan E.: Bathroom')).toBeVisible();
});

test('a first visit gets the welcome page, a tour and a checklist', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { name: /Know who’s out/ })).toBeVisible();
  await page.getByRole('link', { name: 'Get started' }).first().click();

  await expect(page.getByRole('heading', { name: 'Add your class' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Set your destinations' })).toBeVisible();
  await page.getByRole('button', { name: 'Next' }).click();
  await expect(page.getByRole('heading', { name: 'Start the kiosk' })).toBeVisible();
  await expect(page.getByRole('note')).toContainText('Keep your laptop open and awake');
  await page.getByRole('button', { name: 'Add your class' }).click();

  await expect(page.getByText('Start with your first class')).toBeVisible();
  const checklist = page.getByRole('complementary', { name: 'Getting started' });
  await expect(checklist).toContainText('0 of 3');
  await page.getByLabel('Class name').fill('Period 5');
  await page.getByRole('button', { name: 'Create class' }).click();
  await page.getByLabel('One student per line').fill('Elliot Roe\nDuncan Johnson');
  await page.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  await expect(checklist).toContainText('1 of 3');
  await checklist.getByRole('link', { name: 'Set your destinations' }).click();
  await expect(checklist).toContainText('2 of 3');

  // Once welcomed, the app opens straight to Home.
  await page.goto('/');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('.status-box')).toContainText('Period 5');
});

test('a destination can have a time limit', async ({ page }) => {
  await page.goto('/destinations');
  await page.getByRole('button', { name: /New destination|Add/ }).first().click();
  await page.getByLabel('Name').fill('Nurse');
  await page.getByLabel(/Minutes the trip should take/).fill('15');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'New destination' })).toBeHidden();
  await expect(page.getByText('15 minutes')).toBeVisible();

  await page.getByRole('button', { name: /^Nurse/ }).click();
  await page.getByLabel(/Minutes the trip should take/).fill('');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Nurse' })).toBeHidden();
});

test('on a short laptop window, every icon can be reached and searched by the words teachers use', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await page.goto('/destinations');
  await page.getByRole('button', { name: /New destination|Add/ }).first().click();
  await page.getByLabel('Name').fill('Girls Restroom');
  await page.getByRole('button', { name: 'sparkles' }).click();
  await expect(page.getByRole('button', { name: 'sparkles' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByLabel('Search icons').fill('restroom');
  await page.getByRole('button', { name: 'toilet' }).click();
  await page.getByLabel('Search icons').fill('water fountain');
  await expect(page.getByRole('button', { name: 'glass water' })).toBeVisible();
  await page.getByLabel('Search icons').fill('nurse');
  await expect(page.getByRole('button', { name: 'stethoscope' })).toBeVisible();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'New destination' })).toBeHidden();
});

test('a kiosk with a long list of destinations lets students reach every one', async ({ page }) => {
  const labels = Array.from({ length: 18 }, (_, index) => `Room ${index + 1}`);
  for (const size of [
    { width: 1280, height: 650 },
    { width: 390, height: 664 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/door');
    await page.evaluate((labels) => {
      const classId = 'period-1';
      const setup = {
        classes: [{ id: classId, name: 'Period 1', noPassTimes: [], students: [{ id: 'jordan', name: 'Jordan E.' }] }],
        destinations: labels.map((label, index) => ({ id: `room-${index}`, label, minutes: 5, color: 'blue', icon: 'toilet', limit: null })),
        passLimit: 1,
        lineEnabled: false,
        passAllowance: { enabled: false, passes: 3, per: 'week', whenUsedUp: 'stop', since: new Date().toISOString() },
        countedPasses: [],
        extraPassGifts: [],
        activeClass: { id: classId, changedAt: new Date().toISOString() },
        pin: '2468',
        passes: [],
      };
      localStorage.setItem(
        'hallway.door',
        JSON.stringify({ laptopPeerId: 'laptop', kioskId: 'k', secret: 's', setup, activeClass: setup.activeClass, passes: [], outbox: [] }),
      );
    }, labels);
    await page.reload();

    await page.getByRole('button', { name: /Jordan E\./ }).click();
    // The last destination and Cancel are on screen, or the pop-up scrolls to them.
    for (const button of [page.getByRole('button', { name: /^Room 18/ }), page.getByRole('button', { name: 'Cancel' })]) {
      await button.scrollIntoViewIfNeeded();
      await expect(button).toBeInViewport({ ratio: 1 });
    }
    // This kiosk can't reach a teacher's computer, so it can't start the pass, but it says why.
    await page.getByRole('button', { name: /^Room 18/ }).click();
    await expect(page.getByText("Waiting for your teacher's computer").last()).toBeVisible();
  }
});

test('the pass allowance stops a student, and the teacher can let them go with the PIN', async ({ page }) => {
  await createClassWithRoster(page, 'Period 7');
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Pass Allowance' }).check();
  await page.getByLabel('Passes per student').selectOption('1');
  await page.getByLabel('Counted').selectOption('day');
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  // Jordan's one pass for today.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await expect(page.getByText('1 pass left today')).toBeVisible();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Used up: stopped, until the teacher enters the PIN. This computer is the kiosk, so there's no one to ask.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await expect(page.getByText("You've used all your passes today.")).toBeVisible();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Out of passes')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask my teacher' })).toBeHidden();
  await page.getByRole('button', { name: 'Teacher: let them go' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await expect(page.getByText('Jordan E.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // The roster shows who has run out; History shows the pass the teacher approved.
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
  await page.getByRole('link', { name: /^Period 7/ }).click();
  const row = page.getByRole('row', { name: /Jordan E\./ });
  await expect(row).toContainText('2 of 1');
  await expect(row).toContainText('Out of passes');
  await row.getByRole('link', { name: 'Passes' }).click();
  await expect(page).toHaveURL(/\/history/);
  await expect(page.locator('.chip', { hasText: 'Student is Jordan E.' })).toBeVisible();
  const approved = page.getByRole('row', { name: /Still out/ });
  await expect(approved).toContainText('Extra');
  await expect(approved).toContainText('Approved by PIN');
  await expect(page.getByRole('row', { name: /Came back/ })).not.toContainText('Approved');
});

test('a warn-only allowance, an exempt student and a destination that does not count', async ({ page }) => {
  await createClassWithRoster(page, 'Period 8');
  await markStudent(page, 'Maya Ca.', /Exempt from the Pass Allowance/);

  await page.getByRole('link', { name: 'Destinations' }).click();
  await page.getByRole('button', { name: 'Add destination' }).first().click();
  await page.getByLabel('Name').fill('Nurse');
  await page.getByLabel(/Counts toward the Pass Allowance/).uncheck();
  await page.getByRole('button', { name: 'Save' }).click();

  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Pass Allowance' }).check();
  await page.getByLabel('Passes per student').selectOption('1');
  await page.getByLabel('When a student has used them all').selectOption('warn');
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  // The Nurse doesn't use up Jordan's one pass.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: 'Nurse', exact: true }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await expect(page.getByText('1 pass left this week')).toBeVisible();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Used up, but only warned.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText(/You can still go, and your teacher will see it was an extra pass/)).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // An exempt student never hears about it.
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await expect(page.getByText(/passes left|used all your passes/)).toBeHidden();
});

test('a paired kiosk keeps counting passes the laptop already has', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();

  await createClassWithRoster(laptop, 'Period 9');
  await laptop.getByRole('link', { name: 'Pass Options' }).click();
  await laptop.getByRole('switch', { name: 'Pass Allowance' }).check();
  await laptop.getByLabel('Passes per student').selectOption('1');
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  const code = (await laptop.locator('.pair-code').textContent())!.trim();
  await tablet.goto(`/door?code=${code}`);
  await expect(tablet.getByRole('heading', { name: 'Tap your name' })).toBeVisible({ timeout: 30_000 });
  await expect(laptop.locator('.status-box')).toContainText('Kiosk online', { timeout: 30_000 });
  await laptop.getByRole('button', { name: 'Close' }).click();

  await tablet.getByRole('button', { name: /Maya Ca\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  await tablet.getByRole('button', { name: /Maya Ca\..*Out/ }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  // Wait until the laptop has the trip, so the tablet has let go of its own copy.
  await laptop.getByRole('link', { name: 'History', exact: true }).click();
  await expect(laptop.getByText('Came back')).toBeVisible({ timeout: 15_000 });

  await tablet.getByRole('button', { name: /Maya Ca\./ }).click();
  await expect(tablet.getByText("You've used all your passes this week.")).toBeVisible();
});

test('the teacher is reminded when a student is overdue', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T10:00:00') });
  await createClassWithRoster(page, 'Period 1');
  await setPin(page);
  await expect(page.getByText(/won't get overdue reminders/)).toBeVisible();
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
  await expect(page).toHaveURL(/\/$/);

  // Bathroom expects 5 minutes; nothing is said until the pass runs over.
  const reminder = page.locator('.overdue-reminder');
  await expect(reminder).toBeHidden();
  await page.clock.runFor('06:00');
  // Overdue Reminders appear in Needs you, the panel in the corner, which slides up for them.
  await expect(reminder).toContainText('Jordan E. at the Bathroom 1 for 6 min (expected 5)');
  await expect(page).toHaveTitle(/^\(1\) Overdue · /);

  // It follows the teacher to every page, and goes once the student is marked back.
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await expect(reminder).toBeVisible();
  await reminder.getByRole('button', { name: 'Mark back' }).click();
  await expect(reminder).toBeHidden();
  await expect(page).not.toHaveTitle(/Overdue/);
});

async function addDestination(page: Page, name: string, limit: string) {
  await page.getByRole('link', { name: 'Destinations' }).click();
  await page.getByRole('button', { name: 'Add destination' }).first().click();
  await page.getByLabel('Name').fill(name);
  await page.getByLabel('Students here at once').selectOption({ label: limit });
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'New destination' })).toBeHidden();
}

test('each destination has its own limit, and only limited ones have a line', async ({ page }) => {
  await createClassWithRoster(page, 'Period 2');
  await addDestination(page, 'Nurse', 'No limit');
  await addDestination(page, 'Water', '1 at a time');
  await expect(page.getByText(/No limit/)).toBeVisible();
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  // The Bathroom takes one at a time.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Maya Ch. lines up for it, and the kiosk shows it's full.
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await expect(page.getByRole('button', { name: /Bathroom.*Full/ })).toBeVisible();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Bathroom 1 is full.')).toBeVisible();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await expect(page.getByText("You're 1st in line for Bathroom")).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // The Nurse has no limit and no line: Maya Ca. goes straight there, and so could anyone else.
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: /^Nurse/ }).click();
  await expect(page.getByText('Maya Ca.: Nurse')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('2 out · 1 in line')).toBeVisible();

  // Maya Ch. can change her mind from the line and go to the Water, which is free.
  await page.getByRole('button', { name: /Maya Ch\..*1st in line/ }).click();
  await page.getByRole('button', { name: 'Go somewhere else' }).click();
  await page.getByRole('button', { name: /^Water/ }).click();
  await expect(page.getByText('Maya Ch.: Water')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('3 out', { exact: true })).toBeVisible();
});

/** Opens a destination's card on the Destinations page. */
async function editDestination(page: Page, name: string) {
  await page.getByLabel('Main').getByRole('link', { name: 'Destinations' }).click();
  await page.getByRole('button', { name: new RegExp(`^${name}`) }).click();
}

test('one limit for the whole class holds everyone in one line, except where it does not count', async ({ page }) => {
  await createClassWithRoster(page, 'Period 3');
  await addDestination(page, 'Water', '3 at a time');
  await addDestination(page, 'Nurse', '1 at a time');

  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await page.getByRole('radio', { name: /^One limit for the whole class/ }).check();
  await expect(page.getByLabel('Students out at once', { exact: true })).toHaveValue('1');

  // The Nurse never waits for the class limit.
  await editDestination(page, 'Nurse');
  await expect(page.getByLabel('Students here at once')).toBeHidden();
  await page.getByLabel(/Counts toward the class limit/).uncheck();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('You have one limit for the whole class: 1 student out at a time.')).toBeVisible();
  await expect(page.getByRole('button', { name: /^Nurse/ })).toContainText('Not limited');
  await expect(page.getByRole('button', { name: /^Water/ })).toContainText('Counts toward class limit');

  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Somewhere else entirely, but one student is already out: Maya Ch. joins the one line.
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await expect(page.getByRole('button', { name: /Water.*Full/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Nurse/ })).not.toContainText('Full');
  await page.getByRole('button', { name: /^Water/ }).click();
  await expect(page.getByText('1 student is already out.')).toBeVisible();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await expect(page.getByText("You're 1st in line", { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByLabel('The line', { exact: true })).toContainText('Maya Ch.');

  // The Nurse doesn't count: Maya Ca. goes straight there.
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: /^Nurse/ }).click();
  await expect(page.getByText('Maya Ca.: Nurse')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('2 out · 1 in line')).toBeVisible();

  // A trip to the Nurse ending frees nothing; Jordan coming back from the Bathroom frees the spot for Maya Ch.
  await page.getByRole('button', { name: /Maya Ca\..*Out/ }).click();
  await expect(page.getByText(/it's your turn/)).toBeHidden();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await expect(page.getByText("Maya Ch., it's your turn. Tap your name to go.")).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ch\..*Your turn/ }).click();
  await expect(page.getByText('Maya Ch.: Water')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // Switching back brings each destination's own limit back as it was.
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('radio', { name: /^Each destination has its own limit/ }).check();
  await expect(page.getByLabel('Students out at once', { exact: true })).toBeHidden();
  await page.getByLabel('Main').getByRole('link', { name: 'Destinations' }).click();
  await expect(page.getByRole('button', { name: /^Bathroom 1/ })).toContainText('1 at a time');
  await expect(page.getByRole('button', { name: /^Water/ })).toContainText('3 at a time');
  await expect(page.getByRole('button', { name: /^Nurse/ })).toContainText('1 at a time');

  // Maya Ch. is still at the Water, but the Bathroom has its own limit again.
  await page.getByRole('link', { name: 'Kiosk', exact: true }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Jordan E.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('2 out', { exact: true })).toBeVisible();

  // And going back to one limit finds the Nurse still left out of it.
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('radio', { name: /^One limit for the whole class/ }).check();
  await page.getByLabel('Main').getByRole('link', { name: 'Destinations' }).click();
  await expect(page.getByRole('button', { name: /^Nurse/ })).toContainText('Not limited');
});

test('a blocked student asks, and the teacher approves or denies on Home', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  await skipTips(laptop);

  await createClassWithRoster(laptop, 'Period 3');
  await laptop.getByRole('link', { name: 'Pass Options' }).click();
  await laptop.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  await tablet.goto(`/door?code=${(await laptop.locator('.pair-code').textContent())!.trim()}`);
  await expect(tablet.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
  await laptop.getByRole('button', { name: 'Close' }).click();

  // The Bathroom takes one at a time, so Maya Ch. is stopped, and asks.
  await tablet.getByRole('button', { name: /Jordan E\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  await tablet.getByRole('button', { name: /Maya Ch\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Ask my teacher' }).click();
  await expect(tablet.getByRole('status').getByText('Asked your teacher')).toBeVisible();
  await tablet.getByRole('button', { name: 'Done' }).click();
  await expect(tablet.getByRole('button', { name: /Maya Ch\..*Asked your teacher/ })).toBeVisible();

  // On Home the teacher sees what she wants and why she was stopped, and says yes. Her pass starts at once.
  await goHome(laptop);
  const request = laptop.locator('.requests li', { hasText: 'Maya Ch.' });
  await expect(request).toContainText('Bathroom 1 is full', { timeout: 15_000 });
  await expect(laptop).toHaveTitle(/\(1\) Request · /);
  await expect(laptop.locator('.status-box')).toContainText('1 request');
  await request.getByRole('button', { name: 'Approve' }).click();
  await expect(tablet.getByRole('button', { name: /Maya Ch\..*Out · Bathroom/ })).toBeVisible({ timeout: 15_000 });
  await expect(laptop.locator('.stat', { hasText: 'Out of class now' })).toContainText('2', { timeout: 15_000 });
  await expect(laptop).not.toHaveTitle(/Request/);

  // During a No-Pass Time the teacher started, Maya Ca. asks, and is told no.
  await noPassesNow(laptop);
  await expect(tablet.getByText('No passes right now.')).toBeVisible({ timeout: 15_000 });
  await tablet.getByRole('button', { name: /Maya Ca\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Ask my teacher' }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  const second = laptop.locator('.requests li', { hasText: 'Maya Ca.' });
  await expect(second).toContainText('No-pass time', { timeout: 15_000 });
  await second.getByRole('button', { name: 'Deny' }).click();
  await expect(tablet.getByRole('button', { name: /Maya Ca\..*Not right now/ })).toBeVisible({ timeout: 15_000 });
  // With none left, the drawer slides back down.
  await expect(laptop.locator('.drawer .count')).toHaveText('0');
  await expect(laptop.getByRole('button', { name: 'Deny' })).toHaveCount(0);

  // History keeps both answers.
  await laptop.getByRole('link', { name: 'History', exact: true }).click();
  const approved = laptop.getByRole('row', { name: /Maya Ch\./ });
  await expect(approved).toContainText('Skipped line');
  await expect(approved).toContainText('Approved');
  await expect(laptop.getByRole('row', { name: /Maya Ca\./ })).toContainText('Request denied');
});

test('a student in line can ask their teacher, or have the teacher let them go, without the kiosk crashing', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  await skipTips(laptop);
  await createClassWithRoster(laptop, 'Period 3');
  await laptop.getByRole('link', { name: 'Pass Options' }).click();
  await laptop.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  await tablet.goto(`/door?code=${(await laptop.locator('.pair-code').textContent())!.trim()}`);
  await expect(tablet.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
  await laptop.getByRole('button', { name: 'Close' }).click();

  // The Bathroom is full, so Maya Ch. and Maya Ca. line up.
  await tablet.getByRole('button', { name: /Jordan E\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  for (const name of [/Maya Ch\./, /Maya Ca\./]) {
    await tablet.getByRole('button', { name }).click();
    await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
    await tablet.getByRole('button', { name: 'Join the line' }).click();
    await tablet.getByRole('button', { name: 'Done' }).click();
  }

  // From the line, Maya Ch. asks her teacher.
  await tablet.getByRole('button', { name: /Maya Ch\..*in line/ }).click();
  await tablet.getByRole('button', { name: 'Ask my teacher' }).click();
  await expect(tablet.getByRole('status').getByText('Asked your teacher')).toBeVisible();
  await tablet.getByRole('button', { name: 'Done' }).click();
  await goHome(laptop);
  await expect(laptop.locator('.requests li', { hasText: 'Maya Ch.' })).toBeVisible({ timeout: 15_000 });

  // From the line, the teacher lets Maya Ca. go with their PIN.
  await tablet.getByRole('button', { name: /Maya Ca\..*in line/ }).click();
  await tablet.getByRole('button', { name: 'Teacher: let them go' }).click();
  await expect(tablet.getByRole('heading', { name: 'Teacher PIN' })).toBeVisible();
  await expect(tablet.getByText('Internal Error')).toHaveCount(0);
});

test("a returning teacher sees what's changed once; a new one never does", async ({ page }) => {
  // A brand-new teacher.
  await createClassWithRoster(page, 'Period 1');
  await expect(page.getByRole('heading', { name: 'Thank you for all your feedback' })).toBeHidden();

  // A teacher whose saved data is from before both updates: one limit for every
  // destination, and no-pass times set on the class.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('hallway.account.v2')!);
    delete saved.seenPopups;
    delete saved.schedules;
    delete saved.currentScheduleId;
    saved.classes[0].noPassTimes = [{ start: '09:00', end: '09:10' }];
    for (const destination of saved.destinations) delete destination.limit;
    saved.destinations.push({ id: 'nurse', label: 'Nurse', minutes: 15, color: 'pink', icon: 'stethoscope' });
    saved.passLimit = 2;
    localStorage.setItem('hallway.account.v2', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Thank you for all your feedback' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Each destination has its own limit' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'The kiosk can follow your schedule' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Everything for the day is on Home' })).toBeVisible();
  // The updates stack, each with its own button.
  await expect(page.getByRole('button', { name: 'Review destinations' })).toBeVisible();
  await page.getByRole('button', { name: 'Set up your schedule' }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'When each class is on the kiosk' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Thank you for all your feedback' })).toBeHidden();
  // The class's no-pass time moved to a schedule.
  await page.getByRole('link', { name: /My Schedule/ }).click();
  await expect(page.getByLabel('No passes from')).toHaveValue('09:00');
  await expect(page.getByLabel('No passes until')).toHaveValue('09:10');
  await page.getByRole('link', { name: 'Destinations' }).click();
  await expect(page.getByRole('button', { name: /Nurse.*2 at a time/ })).toBeVisible();

  // A teacher who had already seen the first two updates, on the version that remembered only the newest, sees just the latest.
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('hallway.account.v2')!);
    delete saved.seenPopups;
    saved.seenUpdate = '2026-10-schedule';
    localStorage.setItem('hallway.account.v2', JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Everything for the day is on Home' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Each destination has its own limit' })).toBeHidden();
  await page.getByRole('button', { name: 'Got it' }).click();

  // Help shows all of it again on request.
  await page.getByRole('button', { name: 'Help' }).click();
  await page.getByRole('link', { name: "See what's changed" }).click();
  await expect(page.getByRole('heading', { name: 'Each destination has its own limit' })).toBeVisible();
});

test("a kiosk that can't reach the teacher's computer lets students sign back in, and nothing else", async ({ page }) => {
  // A paired kiosk whose teacher's computer is closed, with Jordan out.
  await page.goto('/door');
  await page.evaluate(() => {
    const classId = 'period-1';
    const at = new Date().toISOString();
    const setup = {
      classes: [
        {
          id: classId,
          name: 'Period 1',
          students: [
            { id: 'jordan', name: 'Jordan E.' },
            { id: 'maya', name: 'Maya C.' },
          ],
        },
      ],
      destinations: [{ id: 'bathroom', label: 'Bathroom', minutes: 5, color: 'blue', icon: 'toilet', limit: 1 }],
      lineEnabled: false,
      passAllowance: { enabled: false, passes: 3, per: 'week', whenUsedUp: 'stop', since: at },
      countedPasses: [],
      activeClass: { id: classId, changedAt: at },
      pin: '2468',
      passes: [
        { id: 'p1', classId, studentId: 'jordan', studentName: 'Jordan E.', destination: 'Bathroom', minutes: 5, outAt: at, updatedAt: at },
      ],
    };
    localStorage.setItem('hallway.door', JSON.stringify({ laptopPeerId: 'closed-laptop', kioskId: 'k', secret: 's', setup, returns: [] }));
  });
  await page.reload();

  // Maya can't start a pass: only the teacher's computer decides who may leave.
  await page.getByRole('button', { name: /Maya C\./ }).click();
  await page.getByRole('button', { name: /^Bathroom/ }).click();
  await expect(page.getByText("Waiting for your teacher's computer").last()).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // Jordan coming back is a fact, so the kiosk records it and keeps it for later.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await expect(page.getByText('Welcome back, Jordan E.')).toBeVisible();
  await expect(page.getByText(/1 tap saved here/)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.door.v2')!).returns);
  expect(saved).toHaveLength(1);
});

test('on schedule, the kiosk changes class by itself until the teacher switches by hand', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-10-05T09:40:00') });
  await createClassWithRoster(page, 'Period 1');
  await createClassWithRoster(page, 'Period 2');
  await newSchedule(page);
  await addPeriod(page, 'Period 1', '09:00', '09:50');
  await addPeriod(page, 'Period 2', '09:55', '10:45');
  await useScheduleOnHome(page);
  await expect(page.locator('.status-box')).toContainText('Period 1');
  await expect(page.getByText('Ends in 10 min')).toBeVisible();
  await page.getByRole('link', { name: /^Schedule/ }).click();
  // The card marks the period the clock is in, in the same red as the line on its day.
  await expect(page.locator('.schedule-card li', { hasText: 'Period 1' })).toHaveClass(/now-period/);
  await expect(page.locator('.schedule-card li', { hasText: 'Period 2' })).not.toHaveClass(/now-period/);

  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await expect(page.locator('.door-eyebrow').first()).toHaveText('Period 1');
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Between periods there is no class, and the kiosk says what's next.
  await page.clock.runFor('11:00');
  await expect(page.getByRole('heading', { name: 'No class right now' })).toBeVisible();
  await expect(page.getByText('Next: Period 2 at 9:55 AM')).toBeVisible();

  // Then the next period's class comes on.
  await page.clock.runFor('05:00');
  await expect(page.locator('.door-eyebrow').first()).toHaveText('Period 2');

  // Switching by hand asks first, then takes the kiosk off schedule.
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Period 1', exact: true }).click();
  await page.getByRole('button', { name: /Tap again/ }).click();
  await expect(page.locator('.door-eyebrow').first()).toHaveText('Period 1');
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
  await expect(page.locator('.status-box')).toContainText('Off schedule');

  // Jordan's pass ended when Period 1 left the kiosk.
  await page.getByRole('link', { name: 'History', exact: true }).click();
  await expect(page.getByRole('row', { name: /Jordan E\./ })).toContainText('Class changed');

  // Home puts the kiosk back on the schedule, at whatever period the clock is in.
  await goHome(page);
  await choose(page, 'Schedule', 'Schedule 1');
  await expect(page.locator('.status-box')).toContainText('Schedule 1');
  await expect(page.locator('.status-box')).toContainText('Period 2');

  // Switching by hand from Home asks first; saying no leaves everything as it was.
  await choose(page, 'Class on the kiosk', 'Period 1');
  await expect(page.getByRole('heading', { name: "You're on Schedule 1. Switch to Period 1 by hand?" })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('button', { name: 'Class on the kiosk: Period 2' })).toBeVisible();
  await expect(page.locator('.status-box')).toContainText('Schedule 1');
});

test('dragging on the calendar adds a no-pass time, and the teacher can stop passes by hand', async ({ page }) => {
  await createClassWithRoster(page, 'Period 1');
  await newSchedule(page);
  await page.getByRole('radio', { name: 'No-pass' }).click();
  await dragOnCalendar(page, 180, 225);
  await expect(page.getByLabel('No passes from')).toHaveValue('09:00');
  await expect(page.getByLabel('No passes until')).toHaveValue('09:30');

  // Off schedule, the teacher stops passes from Home.
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await goHome(page);
  await noPassesNow(page);
  await expect(page.getByText('Passes stay closed until you open them')).toBeVisible();
  await expect(page.locator('.status-box').getByRole('img', { name: 'No passes' })).toBeVisible();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await expect(page.getByText('Your teacher will open passes again.')).toBeVisible();
});

test('when the network blocks pairing, both screens offer details for support, and the next try starts fresh', async ({
  browser,
}) => {
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  // Stand in for a school network that blocks every route between the two devices.
  await tablet.addInitScript(() => {
    const Real = RTCPeerConnection;
    window.RTCPeerConnection = class extends Real {
      constructor(config?: RTCConfiguration) {
        super({ ...config, iceServers: [], iceTransportPolicy: 'relay' });
      }
    } as typeof RTCPeerConnection;
  });

  await createClassWithRoster(laptop, 'Period 3');
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  const code = (await laptop.locator('.pair-code').textContent())!.trim();
  await tablet.goto(`/door?code=${code}`);

  await expect(laptop.getByRole('heading', { name: "This network won't let the devices connect" })).toBeVisible({
    timeout: 40_000,
  });
  await laptop.getByText(/Details for support/).click();
  await expect(laptop.locator('.support pre')).toContainText('Routes the other device sent: none');
  await expect(tablet.getByText('Details for support · RELAY-BLOCKED')).toBeVisible({ timeout: 20_000 });

  // Closing and reopening tries again, instead of showing the old failure.
  await laptop.getByRole('button', { name: 'Close', exact: true }).click();
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
});

test('a teacher with no schedules draws one: a period appears as they drag, and moves as a whole', async ({ page }) => {
  await createClassWithRoster(page, 'Period 1');
  await page.getByRole('link', { name: /^Schedule/ }).click();
  await expect(page.getByText('You have no schedules right now. Click here to create one.')).toBeVisible();
  await newSchedule(page);

  // Dragging with the Period tool adds the period straight away and opens its card.
  await dragOnCalendar(page, 180, 270);
  const row = page.locator('.time-row').first();
  await expect(row.getByLabel('Starts')).toHaveValue('09:00');
  await expect(row.getByLabel('Ends')).toHaveValue('10:00');
  await expect(row.getByLabel('Class', { exact: true })).toHaveValue(/.+/);
  await page.getByLabel('No passes, last').fill('10');
  await page.getByLabel('No passes, last').press('Tab');
  await expect(page.locator('.grid .band')).toHaveCount(1);
  await page.getByRole('dialog', { name: 'Period' }).getByRole('button', { name: 'Done' }).click();

  // Dragging the period moves it whole, keeping its length.
  await dragOnCalendar(page, 200, 245);
  await expect(row.getByLabel('Starts')).toHaveValue('09:30');
  await expect(row.getByLabel('Ends')).toHaveValue('10:30');

  // It shows on the schedule's card, ready to use.
  await page.getByRole('link', { name: 'All schedules' }).click();
  await expect(page.locator('.schedule-card')).toContainText('9:30');
  await useScheduleOnHome(page);
  await choose(page, 'Schedule', 'Off schedule');
  await expect(page.locator('.status-box')).toContainText('Off schedule');
});

test("a schedule's old first and last minutes rules move onto its periods", async ({ page }) => {
  await createClassWithRoster(page, 'Period 1');
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem('hallway.account.v2')!);
    const classId = saved.classes[0].id;
    saved.schedules = [
      {
        id: 'old',
        name: 'A Day',
        periods: [{ id: 'p1', classId, start: '09:00', end: '10:00' }],
        rules: [
          { id: 'r1', edge: 'first', minutes: 10, classId: null },
          { id: 'r2', edge: 'last', minutes: 5, classId },
        ],
        noPassTimes: [],
      },
    ];
    saved.currentScheduleId = 'old';
    localStorage.setItem('hallway.account.v2', JSON.stringify(saved));
  });
  await page.goto('/schedule/old');
  await page.locator('.grid .period .block-body').click();
  await expect(page.getByLabel('No passes, first')).toHaveValue('10');
  await expect(page.getByLabel('No passes, last')).toHaveValue('5');
  await expect(page.locator('.grid .band')).toHaveCount(2);
});

test('an offline kiosk reconnects with a code, the same way it paired, handing over the returns it saved', async ({ browser }) => {
  const laptopContext = await browser.newContext();
  const laptop = await laptopContext.newPage();
  const tablet = await (await browser.newContext()).newPage();
  await skipTips(laptop);

  await createClassWithRoster(laptop, 'Period 4');
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  await tablet.goto(`/door?code=${(await laptop.locator('.pair-code').textContent())!.trim()}`);
  await expect(tablet.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
  await tablet.getByRole('button', { name: /Jordan E\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  await expect(tablet.getByRole('button', { name: /Jordan E\..*Out/ })).toBeVisible();

  // The laptop goes away. The kiosk says so and offers to reconnect; Jordan can still sign back in.
  await laptop.close();
  await expect(tablet.getByRole('button', { name: 'Reconnect' })).toBeVisible({ timeout: 30_000 });
  await tablet.getByRole('button', { name: /Jordan E\./ }).click();
  await expect(tablet.getByText(/1 tap saved here/)).toBeVisible();

  // Back on the laptop, Reconnect shows a code, and the tablet's own Reconnect takes it, the same way pairing does.
  // (The two may also find each other by themselves first; either way the kiosk ends up connected.)
  const again = await laptopContext.newPage();
  await skipTips(again);
  await again.goto('/');
  await again.locator('.devices-card').getByRole('button', { name: 'Reconnect' }).click();
  await expect(again.getByRole('heading', { name: 'On the kiosk, tap Reconnect, then type this code' })).toBeVisible();
  await expect(again.getByText(/Waiting for the device|Connected!/)).toBeVisible({ timeout: 20_000 });
  const code = (await again.locator('.pair-code').textContent().catch(() => ''))?.trim() ?? '';
  if (await tablet.getByRole('button', { name: 'Reconnect' }).isVisible()) {
    // If the two find each other meanwhile, the code screen steps aside; that's fine too.
    const steppedAside = () => undefined;
    await tablet.getByRole('button', { name: 'Reconnect' }).click({ timeout: 5_000 }).catch(steppedAside);
    await tablet.getByLabel('Pairing code').fill(code, { timeout: 5_000 }).catch(steppedAside);
    await tablet.getByRole('button', { name: 'Connect', exact: true }).click({ timeout: 5_000 }).catch(steppedAside);
  }
  await expect(tablet.getByText('Connected', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(tablet.getByRole('button', { name: /Jordan E\..*In class/ })).toBeVisible();

  // The return made while offline reached the laptop.
  await expect(again.getByRole('dialog')).toBeHidden({ timeout: 10_000 });
  await again.getByRole('link', { name: 'History', exact: true }).click();
  await expect(again.getByRole('row', { name: /Jordan E\./ })).not.toContainText('Still out', { timeout: 15_000 });
});

/** The class names in the sidebar, top to bottom. */
function sidebarClasses(page: Page) {
  return page.locator('.sidebar .class-row .nav-link');
}

/** Three classes, made in the "wrong" order: the 4th block first. */
async function createBlocks(page: Page) {
  for (const name of ['4th block', '1st block', '2nd block']) await createClassWithRoster(page, name);
  await expect(sidebarClasses(page)).toHaveText(['4th block', '1st block', '2nd block']);
}

test('a teacher drags a class to a new place in the sidebar, and it stays there everywhere', async ({ page }) => {
  await createBlocks(page);
  await goHome(page);
  const first = sidebarClasses(page).first();
  const from = (await sidebarClasses(page).nth(0).boundingBox())!;
  const to = (await sidebarClasses(page).nth(2).boundingBox())!;

  // A drag that ends back where it began changes nothing, and doesn't open the class either.
  await page.mouse.move(from.x + 30, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, from.y + from.height + 12, { steps: 4 });
  await page.mouse.move(from.x + 30, from.y + from.height / 2, { steps: 4 });
  await page.mouse.up();
  await expect(sidebarClasses(page)).toHaveText(['4th block', '1st block', '2nd block']);
  await expect(page).toHaveURL(/\/$/);

  // Press the 4th block and drag it below the 2nd block.
  await page.mouse.move(from.x + 30, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 30, to.y + to.height - 2, { steps: 8 });
  await expect(page.locator('.class-row.drop-after')).toHaveCount(1);
  await page.mouse.up();
  await expect(sidebarClasses(page)).toHaveText(['1st block', '2nd block', '4th block']);
  // Letting go of a drag doesn't open the class under the mouse.
  await expect(page).toHaveURL(/\/$/);

  await page.reload();
  await expect(sidebarClasses(page)).toHaveText(['1st block', '2nd block', '4th block']);
  // Other lists of classes follow the same order.
  await goHome(page);
  await page.getByRole('button', { name: /^Class on the kiosk:/ }).click();
  await expect(page.getByRole('menuitemradio').filter({ hasText: /block/ })).toHaveText([
    /1st block/,
    /2nd block/,
    /4th block/,
  ]);
  await page.keyboard.press('Escape');

  // A plain click still opens a class.
  await first.click();
  await expect(page.getByRole('heading', { name: '1st block' })).toBeVisible();
});

test('a teacher reorders classes with the keyboard', async ({ page }) => {
  await createBlocks(page);
  const grip = page.getByRole('button', { name: 'Move 4th block' });
  await grip.focus();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('ArrowDown');
  await expect(sidebarClasses(page)).toHaveText(['1st block', '2nd block', '4th block']);
  await expect(grip).toBeFocused();
  await expect(page.locator('.sidebar [aria-live]')).toHaveText('4th block moved to position 3 of 3.');
  await page.keyboard.press('ArrowDown');
  await expect(sidebarClasses(page)).toHaveText(['1st block', '2nd block', '4th block']);

  await page.getByRole('button', { name: 'Move 2nd block' }).focus();
  await page.keyboard.press('ArrowUp');
  await expect(sidebarClasses(page)).toHaveText(['2nd block', '1st block', '4th block']);

  await page.reload();
  await expect(sidebarClasses(page)).toHaveText(['2nd block', '1st block', '4th block']);
});

test('on a touch screen, a class is dragged by its grip', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true });
  const page = await context.newPage();
  await skipTips(page);
  await createBlocks(page);

  // A finger presses the 2nd block's grip and drags it to the top.
  const grip = (await page.getByRole('button', { name: 'Move 2nd block' }).boundingBox())!;
  const top = (await sidebarClasses(page).first().boundingBox())!;
  const x = grip.x + grip.width / 2;
  const touch = await context.newCDPSession(page);
  const finger = (type: string, y: number) =>
    touch.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
  await finger('touchStart', grip.y + grip.height / 2);
  for (let y = grip.y + grip.height / 2; y > top.y + 2; y -= 8) await finger('touchMove', y);
  await finger('touchMove', top.y + 2);
  await finger('touchEnd', top.y + 2);

  await expect(sidebarClasses(page)).toHaveText(['2nd block', '4th block', '1st block']);
  await page.reload();
  await expect(sidebarClasses(page)).toHaveText(['2nd block', '4th block', '1st block']);
  await context.close();
});

/** Ticks one of the boxes on a student's edit dialog, from the class's Students page. */
/** A student is edited on the Roster: clicking their name on the class page opens them there; then back to the class. */
async function markStudent(page: Page, student: string, box: RegExp) {
  const classPage = new URL(page.url()).pathname;
  await page.getByRole('link', { name: student, exact: true }).click();
  await page.getByLabel(box).check();
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.goto(classPage);
}

/** Leaves the kiosk screen for the teacher's pages, with the PIN. */
async function exitKiosk(page: Page) {
  await page.getByRole('button', { name: 'Teacher' }).click();
  await page.getByLabel('PIN').fill('2468');
  await page.getByRole('button', { name: 'Unlock' }).click();
  await page.getByRole('button', { name: 'Exit kiosk' }).click();
}

test('a student who can always go passes the class limit and the Pass Allowance, but an exempt one still waits', async ({
  page,
}) => {
  await createClassWithRoster(page, 'Period 5');
  await markStudent(page, 'Maya Ca.', /Can always go/);
  await markStudent(page, 'Maya Ch.', /Exempt from the Pass Allowance/);
  await expect(page.getByRole('row', { name: /Maya Ca\./ })).toContainText('Can always go');
  await expect(page.getByRole('row', { name: /Maya Ch\./ })).toContainText('Exempt');
  await expect(page.getByRole('row', { name: /Maya Ch\./ })).not.toContainText('Can always go');

  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await page.getByRole('radio', { name: /^One limit for the whole class/ }).check();
  await page.getByRole('switch', { name: 'Pass Allowance' }).check();
  await page.getByLabel('Passes per student').selectOption('1');
  await page.getByLabel('Counted').selectOption('day');
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Exempt from the allowance only: Maya Ch. still waits for the class limit.
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('1 student is already out.')).toBeVisible();
  await page.getByRole('button', { name: 'Join the line' }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // Maya Ca. can always go: straight out, past the full class limit and the line, and never told about passes.
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await expect(page.getByText(/passes left|used all your passes/)).toBeHidden();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Maya Ca.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('2 out · 1 in line')).toBeVisible();

  // Her trip takes no spot: once Jordan is back, Maya Ch. goes while Maya Ca. is still out.
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await expect(page.getByText("Maya Ch., it's your turn. Tap your name to go.")).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ch\..*Your turn/ }).click();
  await expect(page.getByText('Maya Ch.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // A second trip today, though the allowance is one a day.
  await page.getByRole('button', { name: /Maya Ca\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Maya Ca.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // History marks each of her passes, and only hers.
  await exitKiosk(page);
  await page.getByRole('link', { name: 'History', exact: true }).click();
  const hers = page.getByRole('row', { name: /Maya Ca\./ });
  await expect(hers).toHaveCount(2);
  for (const row of await hers.all()) await expect(row).toContainText('Can always go');
  await expect(page.getByRole('row', { name: /Maya Ch\./ })).not.toContainText('Can always go');
  await expect(page.getByRole('row', { name: /Jordan E\./ })).not.toContainText('Can always go');
});

test('a student who can always go passes a full destination and No-Pass Time without joining a line', async ({ page }) => {
  await createClassWithRoster(page, 'Period 6');
  await markStudent(page, 'Maya Ca.', /Can always go/);
  await page.getByRole('link', { name: 'Pass Options' }).click();
  await page.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  // The Bathroom takes one at a time and Jordan has it; Maya Ca. goes anyway, and joins no line.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Maya Ca.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByText('2 out', { exact: true })).toBeVisible();

  // Her trip takes no spot: once Jordan is back, Maya Ch. may go.
  await page.getByRole('button', { name: /Jordan E\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ch\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Maya Ch.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ch\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();
  await page.getByRole('button', { name: /Maya Ca\..*Out/ }).click();
  await page.getByRole('button', { name: 'Done' }).click();

  // During No-Pass Time, everyone else is held back, but Maya Ca. still goes.
  await exitKiosk(page);
  await goHome(page);
  await noPassesNow(page);
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await expect(page.getByText('No passes right now.')).toBeVisible();
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText(/Join the line to go as soon as they do/)).toBeVisible();
  await page.getByRole('button', { name: 'Not now' }).click();
  await page.getByRole('button', { name: /Maya Ca\./ }).click();
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Maya Ca.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Maya Ca\..*Out/ })).toBeVisible();
});

/** Opens the Student link from its tab, and returns its address. */
async function openStudentLink(page: Page) {
  await page.getByRole('link', { name: 'Student devices', exact: true }).click();
  await page.getByRole('button', { name: 'Turn on student devices' }).click();
  const url = await page.getByRole('textbox', { name: 'Join link' }).inputValue();
  // Each class period is a Room, joined at /join/ with its six-digit code (docs/adr/0019).
  expect(url).toMatch(/\/join\/\d{6}$/);
  return url;
}

test('students watch who is out and the line, live, from the student link', async ({ browser }) => {
  const laptop = await (await browser.newContext()).newPage();
  const tablet = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await skipTips(laptop);

  await createClassWithRoster(laptop, 'Period 6');
  await laptop.getByRole('link', { name: 'Pass Options' }).click();
  await laptop.getByRole('switch', { name: 'Let students line up' }).check();
  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Pair a device' }).click();
  await expect(laptop.getByText(/Waiting for the device/)).toBeVisible({ timeout: 20_000 });
  await tablet.goto(`/door?code=${(await laptop.locator('.pair-code').textContent())!.trim()}`);
  await expect(laptop.locator('.status-box')).toContainText('Kiosk online', { timeout: 30_000 });
  await laptop.getByRole('button', { name: 'Close' }).click();

  // Closed until the teacher opens it; Home offers to.
  await goHome(laptop);
  await expect(laptop.getByRole('link', { name: 'Turn on student devices' })).toBeVisible();
  const url = await openStudentLink(laptop);
  await expect(laptop.getByText('Nobody is viewing right now')).toBeVisible({ timeout: 20_000 });

  await student.goto(url);
  await expect(student.getByRole('heading', { name: 'Period 6' })).toBeVisible({ timeout: 30_000 });
  await expect(student.getByText('Passes open')).toBeVisible();
  await expect(student.getByText("Everyone's in class.")).toBeVisible();
  await expect(laptop.getByRole('status').filter({ hasText: '0 set up · 1 watching' })).toBeVisible({ timeout: 10_000 });

  // A pass at the kiosk reaches the laptop, and from there the student's page.
  await tablet.getByRole('button', { name: /Maya Ca\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  // Students see who is out and where, as the kiosk shows, unless the class turns names off (docs/adr/0022).
  const out = student.getByRole('region', { name: /^Out of class/ });
  await expect(out).toContainText('Bathroom 1', { timeout: 15_000 });
  await expect(out).toContainText('Maya');

  await tablet.getByRole('button', { name: /Jordan E\./ }).click();
  await tablet.getByRole('button', { name: /^Bathroom 1/ }).click();
  await tablet.getByRole('button', { name: 'Join the line' }).click();
  await tablet.getByRole('button', { name: 'Done' }).click();
  const line = student.getByRole('region', { name: 'Waiting in line' });
  await expect(line).toContainText('Bathroom 1', { timeout: 15_000 });
  await expect(line).toContainText('Jordan');

  // Maya Ca. comes back: nobody is out any more.
  await tablet.getByRole('button', { name: /Maya Ca\..*Out/ }).click();
  await expect(student.getByText("Everyone's in class.")).toBeVisible({ timeout: 15_000 });

  // Home shows the link, and who's watching.
  await goHome(laptop);
  await expect(laptop.locator('.devices-card').getByLabel(`Class code ${url.split('/').pop()}`)).toBeVisible();
  await expect(laptop.locator('.devices-card').getByText('0 set up · 1 watching')).toBeVisible();

  // Closing it tells the student; opening it again brings the page back by itself.
  await laptop.getByRole('link', { name: 'Student devices', exact: true }).click();
  await laptop.getByRole('button', { name: 'Turn off student devices' }).click();
  await expect(student.getByRole('heading', { name: "This class isn't open right now" })).toBeVisible({ timeout: 10_000 });
  await laptop.getByRole('button', { name: 'Turn on student devices' }).click();
  await expect(student.getByRole('heading', { name: 'Period 6' })).toBeVisible({ timeout: 40_000 });

  // A new code: the old one stops working, and the new one works.
  await laptop.getByRole('button', { name: 'New code' }).click();
  await laptop.getByRole('dialog').getByRole('button', { name: 'New code' }).click();
  await expect(student.getByRole('heading', { name: 'This code has ended' })).toBeVisible({ timeout: 10_000 });
  const newUrl = await laptop.getByRole('textbox', { name: 'Join link' }).inputValue();
  expect(newUrl).not.toBe(url);
  await expect(laptop.getByText('Nobody is viewing right now')).toBeVisible({ timeout: 20_000 });
  await student.goto(newUrl);
  await expect(student.getByRole('region', { name: 'Waiting in line' })).toContainText('Bathroom 1', { timeout: 30_000 });
  await expect(laptop.getByRole('status').filter({ hasText: '0 set up · 1 watching' })).toBeVisible({ timeout: 10_000 });
  await student.goto(url);
  await expect(student.getByRole('heading', { name: "Can't reach this class" })).toBeVisible({
    timeout: 40_000,
  });
});

test("the teacher's own computer as the kiosk keeps the student link going, with one Class Line", async ({
  browser,
}) => {
  const laptop = await (await browser.newContext()).newPage();
  const student = await (await browser.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  await skipTips(laptop);

  await createClassWithRoster(laptop, 'Period 7');
  await laptop.getByRole('link', { name: 'Pass Options' }).click();
  await laptop.getByRole('switch', { name: 'Let students line up' }).check();
  await laptop.getByRole('radio', { name: /^One limit for the whole class/ }).check();
  const url = await openStudentLink(laptop);
  await student.goto(url);
  await expect(student.getByRole('heading', { name: 'Period 7' })).toBeVisible({ timeout: 30_000 });

  await setPin(laptop);
  await laptop.getByRole('button', { name: 'Use this computer' }).click();
  await laptop.getByRole('button', { name: 'Open kiosk screen' }).click();
  await laptop.getByRole('button', { name: /Jordan E\./ }).click();
  await laptop.getByRole('button', { name: /^Bathroom 1/ }).click();
  await laptop.getByRole('button', { name: 'Done' }).click();
  await laptop.getByRole('button', { name: /Maya Ch\./ }).click();
  await laptop.getByRole('button', { name: /^Bathroom 1/ }).click();
  await laptop.getByRole('button', { name: 'Join the line' }).click();
  await laptop.getByRole('button', { name: 'Done' }).click();

  // Under a Class Limit there's one line; students see who waits in it, as the kiosk shows (docs/adr/0022).
  await expect(student.getByRole('region', { name: 'Waiting in line' })).toContainText('The line', { timeout: 15_000 });
  await expect(student.getByRole('region', { name: 'Waiting in line' })).toContainText('Maya');

  // A No-Pass Time shows too. Nothing about how a student's passes are treated is ever sent.
  await laptop.getByRole('button', { name: 'Teacher' }).click();
  await laptop.getByLabel('PIN').fill('2468');
  await laptop.getByRole('button', { name: 'Unlock' }).click();
  await laptop.getByRole('button', { name: 'Exit kiosk' }).click();
  await noPassesNow(laptop);
  await expect(student.getByText('No passes', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(student.getByText('Your teacher will open passes again.')).toBeVisible();
  await expect(student.locator('body')).not.toContainText('2468');
});

test('with two tabs open, one answers the student link, and the other takes over when it closes', async ({
  browser,
}) => {
  const laptop = await browser.newContext();
  const firstTab = await laptop.newPage();
  const student = await (await browser.newContext()).newPage();
  await skipTips(firstTab);

  await createClassWithRoster(firstTab, 'Period 8');
  const url = await openStudentLink(firstTab);
  await expect(firstTab.getByText('Nobody is viewing right now')).toBeVisible({ timeout: 20_000 });

  const secondTab = await laptop.newPage();
  await skipTips(secondTab);
  await secondTab.goto('/student-link');
  await expect(secondTab.getByText(/Another Happy Hallways tab on this computer is sharing the link/)).toBeVisible({
    timeout: 20_000,
  });

  await student.goto(url);
  await expect(student.getByRole('heading', { name: 'Period 8' })).toBeVisible({ timeout: 30_000 });
  await expect(secondTab.getByRole('status').filter({ hasText: '0 set up · 1 watching' })).toBeVisible({ timeout: 10_000 });

  // The tab answering closes; the student's page says so, then finds the other tab.
  await firstTab.close();
  await expect(student.getByRole('heading', { name: "Can't reach this class" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(student.getByRole('heading', { name: 'Period 8' })).toBeVisible({ timeout: 60_000 });
  await expect(secondTab.getByRole('status').filter({ hasText: '0 set up · 1 watching' })).toBeVisible({ timeout: 10_000 });
});

/** Taps a PIN on the kiosk's keypad, then Go. */
async function tapPin(page: Page, pin: string) {
  const pad = page.getByRole('dialog').filter({ hasText: 'Type your PIN' });
  for (const digit of pin) await pad.getByRole('button', { name: digit, exact: true }).click();
  await pad.getByRole('button', { name: 'Go' }).click();
}

test('with PINs on, students type their own PIN at the kiosk, and the teacher PIN lets a forgetful one through', async ({ page }) => {
  await createClassWithRoster(page, 'Period 8');
  // PINs are one switch for every class, on the Roster.
  await page.getByRole('link', { name: 'Roster', exact: true }).click();
  await page.getByRole('switch', { name: 'Students use PINs' }).check();
  await page.locator('.sidebar .class-row .nav-link', { hasText: 'Period 8' }).click();

  // A PIN at the end of a line is that student's; one already taken in the class is refused.
  await page.getByRole('button', { name: 'Add students' }).click();
  await page.getByLabel('One student per line').fill('Sam Lee, 1357\nAva Diaz 1357');
  await page.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  await expect(page.getByRole('alert')).toContainText('Another student on your Roster has that PIN');
  await page.getByLabel('One student per line').fill('Sam Lee, 1357');
  await page.getByRole('dialog').getByRole('button', { name: 'Add students' }).click();
  await expect(page.getByText(/4 students/)).toBeVisible();

  // PINs are hidden on the Roster until the teacher asks to see them.
  await page.getByRole('link', { name: 'Roster', exact: true }).click();
  const sam = page.getByRole('row', { name: /Sam Lee/ });
  await expect(sam).not.toContainText('1357');
  await page.getByRole('button', { name: 'Show PINs' }).click();
  await expect(sam).toContainText('1357');
  await expect(page.getByRole('row', { name: /Jordan Ellis/ })).toContainText(/\d{4}/);
  await page.getByRole('link', { name: 'PIN cards: Period 8' }).click();
  await expect(page.getByLabel('PIN cards')).toContainText('Sam L.');
  await expect(page.getByLabel('PIN cards')).toContainText('1357');

  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();

  // A wrong PIN goes nowhere; Cancel goes back to the names.
  await page.getByRole('button', { name: /Sam L\./ }).click();
  await tapPin(page, '9999');
  await expect(page.getByText("That PIN isn't right. Try again.")).toBeVisible();
  await expect(page.getByText('Where are you going?')).toBeHidden();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByText('Type your PIN')).toBeHidden();

  // The right PIN goes on to the destinations. A keyboard works too.
  await page.getByRole('button', { name: /Sam L\./ }).click();
  await page.keyboard.type('1357');
  await page.keyboard.press('Enter');
  await page.getByRole('button', { name: /^Bathroom 1/ }).click();
  await expect(page.getByText('Sam L.: Bathroom')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();
  // The kiosk never shows anyone's PIN.
  await expect(page.locator('.door')).not.toContainText('1357');

  // Coming back needs the PIN too.
  await page.getByRole('button', { name: /Sam L\..*Out/ }).click();
  await tapPin(page, '1357');
  await expect(page.getByText('Welcome back, Sam L.')).toBeVisible();
  await page.getByRole('button', { name: 'Done' }).click();

  // A student who forgot their PIN: the teacher types theirs instead.
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await tapPin(page, '2468');
  await expect(page.getByText('Where are you going?')).toBeVisible();
});

test('with PINs off, tapping a name goes straight to the destinations', async ({ page }) => {
  await createClassWithRoster(page, 'Period 9');
  await setPin(page);
  await page.getByRole('button', { name: 'Use this computer' }).click();
  await page.getByRole('button', { name: 'Open kiosk screen' }).click();
  await page.getByRole('button', { name: /Jordan E\./ }).click();
  await expect(page.getByText('Type your PIN')).toBeHidden();
  await expect(page.getByText('Where are you going?')).toBeVisible();
});
