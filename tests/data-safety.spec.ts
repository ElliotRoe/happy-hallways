import { expect, test, type Page } from '@playwright/test';

/**
 * Teachers' existing data must survive every upgrade, every kiosk hand-over
 * and every merge. These run the app's own code in the page (the dev server
 * serves it) against saved accounts shaped like real ones.
 */

const at = '2026-11-02T15:00:00.000Z';
const later = '2026-11-02T15:30:00.000Z';

/** An account as the version before this one saved it, under the old key. */
function oldAccount(extra: object = {}) {
  return {
    version: 1,
    laptopPeerId: 'hallway-old',
    roster: [
      { id: 'maya', firstName: 'Maya', lastName: 'Chen', pin: '1111' },
      { id: 'sam', firstName: 'Sam', pin: '2222' },
    ],
    rosterMergeSeen: true,
    classes: [
      {
        id: 'p1',
        name: 'Period 1',
        createdAt: at,
        members: [
          { studentId: 'maya', lastPrefix: 'C', status: 'current' },
          { studentId: 'sam', lastPrefix: 'S', status: 'current' },
        ],
      },
    ],
    passes: [],
    // Every update seen already, so "What's new" never covers what a test clicks.
    seenPopups: Object.fromEntries(
      ['2026-10-destination-limits', '2026-10-schedule', '2026-10-home', '2026-10-13-class-limit-pins-student-link', '2026-11-whats-new'].map((id) => [id, at]),
    ),
    ...extra,
  };
}

const pass = (id: string, studentId: string, extra: object = {}) => ({
  id,
  classId: 'p1',
  studentId,
  studentName: studentId,
  destination: 'Restroom',
  minutes: 5,
  outAt: at,
  updatedAt: at,
  ...extra,
});

async function seed(page: Page, key: string, value: unknown) {
  await page.goto('/privacy');
  await page.evaluate(
    ({ key, value }) => {
      localStorage.clear();
      localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
    },
    { key, value },
  );
  await page.goto('/settings');
}


/** Attendance is saved compactly (class → day → student → [status, arrived, tardy, flags, name]); spread back into marks. */
type Log = Record<string, Record<string, Record<string, [string, number | null, number | null, number, string]>>>;
function withMarks(account: { attendance?: object[]; attendanceLog?: Log }) {
  const codes: Record<string, string> = { p: 'present', t: 'tardy', a: 'absent' };
  const marks = Object.entries(account.attendanceLog ?? {}).flatMap(([classId, days]) =>
    Object.entries(days).flatMap(([day, students]) =>
      Object.entries(students).map(([studentId, [status, , tardy, flags]]) => ({
        classId,
        day,
        studentId,
        status: codes[status],
        ...(typeof tardy === 'number' ? { tardyMinutes: tardy } : {}),
        ...(flags & 4 ? { corrected: true } : {}),
      })),
    ),
  );
  return { ...account, attendance: [...(account.attendance ?? []), ...marks] };
}

const saved = async (page: Page) => withMarks(await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.account.v2')!)));

test('1. data that cannot be read is kept, never saved over, and the teacher can download it', async ({ page }) => {
  const broken = '{"version":1,"classes":[{"id":"p1"';
  await seed(page, 'hallway.account', broken);
  await expect(page.getByRole('heading', { name: "We couldn't read your Happy Hallways data" })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Download my data' })).toBeVisible();
  const storage = await page.evaluate(() => ({ ...localStorage }));
  expect(storage['hallway.account']).toBe(broken);
  expect(storage['hallway.account.v2']).toBeUndefined();
  const copies = Object.entries(storage).filter(([key]) => key.startsWith('hallway.account.unreadable.'));
  expect(copies.map(([, value]) => value)).toEqual([broken]);
});

test('2. this version saves under its own key and leaves the older one as it was', async ({ page }) => {
  const original = JSON.stringify(oldAccount());
  await seed(page, 'hallway.account', original);
  await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    m.setPin('9753');
  });
  const storage = await page.evaluate(() => ({ ...localStorage }));
  expect(storage['hallway.account']).toBe(original);
  const v2 = JSON.parse(storage['hallway.account.v2']);
  expect(v2.version).toBe(2);
  expect(v2.pin).toBe('9753');
  expect(v2.roster).toHaveLength(2);
});

test('3. a kiosk hand-over never un-cancels a pass, changes a corrected one, or overrides a mark the teacher set', async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({
      version: 2,
      passes: [
        pass('cancelled', 'maya', { inAt: later, endedBy: 'cancelled', cancelledBy: 'teacher', endedBeforeCancel: 'student', corrected: true }),
        pass('fixed', 'sam', { inAt: later, endedBy: 'teacher', corrected: true }),
      ],
      attendanceRules: { graceMinutes: 5, absentAfterMinutes: 20 },
      attendance: [{ id: 'm1', classId: 'p1', studentId: 'maya', studentName: 'Maya C.', day: '2026-11-02', status: 'absent', corrected: true, updatedAt: at }],
    }),
  );
  await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    m.receiveReturns([
      { passId: 'cancelled', inAt: '2026-11-02T15:05:00.000Z' },
      { passId: 'fixed', inAt: '2026-11-02T15:06:00.000Z' },
    ]);
    m.receiveArrivals([{ classId: 'p1', studentId: 'maya', at: '2026-11-02T15:01:00.000Z' }]);
  });
  const account = await saved(page);
  const byId = Object.fromEntries(account.passes.map((each: { id: string }) => [each.id, each]));
  expect(byId.cancelled).toMatchObject({ endedBy: 'cancelled', cancelledBy: 'teacher', inAt: later });
  expect(byId.fixed).toMatchObject({ endedBy: 'teacher', inAt: later });
  expect(account.attendance).toHaveLength(1);
  expect(account.attendance[0].status).toBe('absent');
});

test("4. a newer kiosk copy of a pass keeps the teacher's note, cancel and merged student", async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({
      version: 2,
      passes: [pass('p', 'maya', { inAt: later, endedBy: 'cancelled', cancelledBy: 'teacher', endedBeforeCancel: 'student', corrected: true, note: 'Mis-tap' })],
      mergedIds: { 'old-maya': 'maya' },
    }),
  );
  await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    m.receivePasses([
      { id: 'p', classId: 'p1', studentId: 'old-maya', studentName: 'Maya C.', destination: 'Restroom', minutes: 5, outAt: '2026-11-02T15:00:00.000Z', inAt: '2026-11-02T15:10:00.000Z', endedBy: 'student', updatedAt: '2026-11-02T16:00:00.000Z' },
      { id: 'new', classId: 'p1', studentId: 'old-maya', studentName: 'Maya C.', destination: 'Restroom', minutes: 5, outAt: '2026-11-02T16:00:00.000Z', updatedAt: '2026-11-02T16:00:00.000Z' },
    ]);
  });
  const account = await saved(page);
  const byId = Object.fromEntries(account.passes.map((each: { id: string }) => [each.id, each]));
  expect(byId.p).toMatchObject({ note: 'Mis-tap', cancelledBy: 'teacher', endedBy: 'cancelled', studentId: 'maya', inAt: later });
  // A pass the kiosk started for the merged-away student belongs to the kept one.
  expect(byId.new.studentId).toBe('maya');
});

test('5. merging moves attendance and devices, remembers the merged id, keeps the chosen PIN, and can be undone', async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({
      version: 2,
      roster: [
        { id: 'maya', firstName: 'Maya', pin: '1111' },
        { id: 'maya2', firstName: 'Maya', pin: '3333', alwaysGo: true },
      ],
      classes: [
        { id: 'p1', name: 'Period 1', createdAt: at, members: [{ studentId: 'maya', lastPrefix: 'C', status: 'current' }] },
        { id: 'p2', name: 'Period 2', createdAt: at, members: [{ studentId: 'maya2', lastPrefix: 'C', status: 'current' }] },
      ],
      passes: [pass('a', 'maya2', { classId: 'p2' })],
      attendance: [
        { id: 'm1', classId: 'p2', studentId: 'maya2', studentName: 'Maya C.', day: '2026-11-02', status: 'present', updatedAt: at },
      ],
      claims: [{ token: 't', studentId: 'maya2', claimedAt: at }],
    }),
  );
  await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    m.mergeStudents('maya', 'maya2', 'maya2');
  });
  let account = await saved(page);
  expect(account.roster.map((each: { id: string }) => each.id)).toEqual(['maya']);
  expect(account.roster[0]).toMatchObject({ pin: '3333', alwaysGo: true });
  expect(account.passes[0].studentId).toBe('maya');
  expect(account.passes[0].updatedAt > at).toBe(true);
  expect(account.attendance[0].studentId).toBe('maya');
  expect(account.claims).toEqual([]);
  expect(account.mergedIds).toEqual({ maya2: 'maya' });
  expect(account.classes[1].members[0].studentId).toBe('maya');

  await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    m.undoMerge(m.account.merges![0].id);
  });
  account = await saved(page);
  expect(account.roster.map((each: { id: string }) => each.id).sort()).toEqual(['maya', 'maya2']);
  expect(account.roster.find((each: { id: string }) => each.id === 'maya').pin).toBe('1111');
  expect(account.passes[0].studentId).toBe('maya2');
  expect(account.attendance[0].studentId).toBe('maya2');
  expect(account.classes[1].members[0].studentId).toBe('maya2');
  expect(account.mergedIds).toEqual({});
});

test('6. the merge screen asks first, shows both students, and remembers each pair the teacher says are different', async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({
      version: 2,
      rosterMergeSeen: false,
      roster: [
        { id: 'a1', firstName: 'Maya', pin: '1111' },
        { id: 'a2', firstName: 'Maya', pin: '2222' },
        { id: 'b1', firstName: 'Sam' },
        { id: 'b2', firstName: 'Sam' },
      ],
      classes: [
        { id: 'p1', name: 'Period 1', createdAt: at, members: [{ studentId: 'a1', lastPrefix: 'C', status: 'current' }, { studentId: 'b1', lastPrefix: 'S', status: 'current' }] },
        { id: 'p2', name: 'Period 2', createdAt: at, members: [{ studentId: 'a2', lastPrefix: 'C', status: 'current' }, { studentId: 'b2', lastPrefix: 'S', status: 'current' }] },
      ],
    }),
  );
  await page.goto('/roster');
  const offers = page.getByRole('region', { name: 'These may be the same student in two classes' });
  await expect(offers.getByRole('listitem')).toHaveCount(2);

  // "Different students" forgets only that pair.
  await offers.getByRole('listitem').filter({ hasText: 'Sam S.' }).getByRole('button', { name: 'Different students' }).click();
  await expect(offers.getByRole('listitem')).toHaveCount(1);

  // "Same student" asks first, with both PINs to choose from.
  await offers.getByRole('button', { name: 'Same student…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Are these the same student?' });
  await expect(dialog).toContainText('PIN 1111');
  await expect(dialog).toContainText('PIN 2222');
  await dialog.getByRole('radio', { name: /2222/ }).check();
  await dialog.getByRole('button', { name: 'Merge them' }).click();
  await expect(page.getByRole('region', { name: 'Merged students' })).toBeVisible();
  let account = await saved(page);
  expect(account.roster.find((each: { id: string }) => each.id === 'a1').pin).toBe('2222');
  expect(account.dismissedMerges).toEqual(['b1|b2']);

  await page.getByRole('region', { name: 'Merged students' }).getByRole('button', { name: 'Undo' }).click();
  account = await saved(page);
  expect(account.roster).toHaveLength(4);
});

test("7. pasting a class list never gives two rows one student, or changes a PIN the teacher didn't confirm", async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({
      version: 2,
      studentPins: true,
      roster: [{ id: 'maya', firstName: 'Maya', pin: '1111' }],
      classes: [
        { id: 'p1', name: 'Period 1', createdAt: at, members: [{ studentId: 'maya', lastPrefix: 'C', status: 'current' }] },
        { id: 'p2', name: 'Period 2', createdAt: at, members: [] },
      ],
    }),
  );
  const result = await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    const r = await import('/src/lib/roster.ts');
    const p2 = m.findClass('p2')!;
    // Both could be the Maya C. from Period 1: neither is taken as her.
    const plan = r.planImport('Maya Chen\nMaya Carter', m.classStudents(p2), m.account.pin, m.rosterCandidates('p2'));
    const doubled = plan.added.filter((entry) => entry.rosterMatch).length;
    // One clear match with a different PIN: listed, not applied.
    const single = r.planImport('Maya Chen, 4321', m.classStudents(p2), m.account.pin, m.rosterCandidates('p2'));
    m.applyImport('p2', single, []);
    return { doubled, pinChanges: single.pinChanges, pin: m.findStudent('maya')!.pin, members: m.findClass('p2')!.members.length };
  });
  expect(result.doubled).toBe(0);
  expect(result.pinChanges).toEqual([{ studentId: 'maya', name: 'Maya Chen', from: '1111', to: '4321' }]);
  expect(result.pin).toBe('1111');
  expect(result.members).toBe(1);
});

test('8. passes an older kiosk saved count as waiting, and a student out on one can come back', async ({ page }) => {
  await page.goto('/privacy');
  await page.evaluate(
    ({ at, passOut }) => {
      localStorage.clear();
      const setup = {
        classes: [{ id: 'p1', name: 'Period 1', students: [{ id: 'maya', name: 'Maya C.' }] }],
        destinations: [{ id: 'd', label: 'Restroom', color: 'blue', icon: 'toilet', minutes: 5, limit: 1 }],
        lineEnabled: false,
        passAllowance: { enabled: false, count: 3, period: 'week' },
        countedPasses: [],
        activeClass: { id: 'p1', changedAt: at },
        pin: '2468',
      };
      localStorage.setItem('hallway.door', JSON.stringify({ laptopPeerId: 'closed-laptop', kioskId: 'k', secret: 's', setup, passes: [passOut], outbox: [passOut.id] }));
    },
    { at, passOut: pass('legacy', 'maya') },
  );
  await page.goto('/door');
  const state = await page.evaluate(async () => {
    const d = await import('/src/lib/door.svelte.ts');
    return { waiting: d.waitingCount(), open: d.openPassFor('maya')?.id };
  });
  expect(state).toEqual({ waiting: 1, open: 'legacy' });
});

test("9. the teacher's computer says what it understands, and a kiosk tells an outdated one to reload", async ({ page }) => {
  await seed(page, 'hallway.account.v2', oldAccount({ version: 2 }));
  const protocol = await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).doorSetup().protocol);
  expect(protocol).toBe(2);

  await page.goto('/privacy');
  await page.evaluate((at) => {
    localStorage.clear();
    const setup = { classes: [{ id: 'p1', name: 'Period 1', students: [] }], destinations: [], lineEnabled: false, passAllowance: { enabled: false, count: 3, period: 'week' }, countedPasses: [], activeClass: { id: 'p1', changedAt: at }, pin: '2468', passes: [] };
    localStorage.setItem('hallway.door.v2', JSON.stringify({ laptopPeerId: 'closed-laptop', kioskId: 'k', secret: 's', setup, returns: [] }));
  }, at);
  await page.goto('/door');
  const state = await page.evaluate(async () => {
    const d = await import('/src/lib/door.svelte.ts');
    d.door.status = 'live';
    const setup = JSON.parse(JSON.stringify(d.door.device!.setup));
    // An older laptop's setup has no protocol: the kiosk can't ask it, so it only records returns.
    d.receive({ type: 'setup', setup: { ...setup, protocol: undefined } });
    const outdated = { outdated: d.door.laptopOutdated, reaches: d.reachesTeacher(), canAsk: d.canAsk() };
    d.receive({ type: 'setup', setup: { ...setup, protocol: 2 } });
    return { ...outdated, after: d.reachesTeacher() };
  });
  expect(state).toEqual({ outdated: true, reaches: false, canAsk: false, after: true });
});

test('10. a student with only attendance is kept as a former student, not erased', async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({
      version: 2,
      attendance: [{ id: 'm1', classId: 'p1', studentId: 'sam', studentName: 'Sam S.', day: '2026-11-02', status: 'present', updatedAt: at }],
    }),
  );
  await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).removeStudent('p1', 'sam'));
  const account = await saved(page);
  expect(account.roster.map((each: { id: string }) => each.id)).toContain('sam');
  expect(account.classes[0].members.find((each: { studentId: string }) => each.studentId === 'sam').status).toBe('former');
});

test("11. restoring someone else's backup doesn't take over their kiosk, address, Room or devices", async ({ page }) => {
  const theirs = JSON.stringify({
    app: 'hallway',
    ...oldAccount({ version: 2, kiosk: { kind: 'device', kioskId: 'k', secret: 's' }, studentLink: { open: true, room: { code: '123456', classId: 'p1' } }, claims: [{ token: 't', studentId: 'maya', claimedAt: at }] }),
  });
  await seed(page, 'hallway.account.v2', oldAccount({ version: 2 }));
  await page.evaluate(async (text) => (await import('/src/lib/account.svelte.ts')).importAccount(text, false), theirs);
  const account = await saved(page);
  expect(account.laptopPeerId).not.toBe('hallway-old');
  expect(account.kiosk).toBeNull();
  expect(account.claims).toEqual([]);
  expect(account.studentLink).toEqual({ open: false, room: null });
  expect(account.classes[0].name).toBe('Period 1');
});

test('12. adding students gives PINs only to new students, never to students who had none', async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({ version: 2, studentPins: true, roster: [{ id: 'sam', firstName: 'Sam' }], classes: [{ id: 'p1', name: 'Period 1', createdAt: at, members: [{ studentId: 'sam', lastPrefix: 'S', status: 'current' }] }] }),
  );
  const result = await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    const r = await import('/src/lib/roster.ts');
    const p1 = m.findClass('p1')!;
    m.applyImport('p1', r.planImport('Sam Stone\nJordan Ellis', m.classStudents(p1), m.account.pin, m.rosterCandidates('p1')), []);
    return m.account.roster.map((each) => ({ name: each.firstName, pin: !!each.pin }));
  });
  expect(result).toEqual([
    { name: 'Sam', pin: false },
    { name: 'Jordan', pin: true },
  ]);
});

test('13. a backup says which version made it, and one from a newer version is refused, not half-read', async ({ page }) => {
  await seed(page, 'hallway.account.v2', oldAccount({ version: 2 }));
  const result = await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    const exported = JSON.parse(m.exportAccount());
    let refused = '';
    try {
      m.importAccount(JSON.stringify({ ...exported, version: 99 }));
    } catch (error) {
      refused = (error as Error).message;
    }
    return { version: exported.version, refused };
  });
  expect(result.version).toBe(2);
  expect(result.refused).toContain('newer version');
});

test('A. a tab still on the older version keeps recording after the switch-over, and nothing is lost', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const original = oldAccount({ passes: [pass('old-1', 'maya')] });
  await seed(page, 'hallway.account', original);
  // This version saves (under its own key).
  await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).setPin('9753'));

  // The older tab records a pass and a return, writing only the older key.
  const olderTab = await context.newPage();
  await olderTab.goto('/privacy');
  await olderTab.evaluate(
    ({ older }) => localStorage.setItem('hallway.account', JSON.stringify(older)),
    {
      older: {
        ...original,
        passes: [
          { ...pass('old-1', 'maya'), inAt: later, endedBy: 'student', updatedAt: later },
          pass('old-2', 'sam', { outAt: later, updatedAt: later }),
        ],
      },
    },
  );
  await expect
    .poll(async () => (await saved(page)).passes.map((each: { id: string }) => each.id).sort())
    .toEqual(['old-1', 'old-2']);
  let account = await saved(page);
  expect(account.pin).toBe('9753');
  expect(account.passes.find((each: { id: string }) => each.id === 'old-1').inAt).toBe(later);

  // Changed again while no new tab was open: taken in at the next load.
  await page.close();
  await olderTab.evaluate(
    ({ older }) => localStorage.setItem('hallway.account', JSON.stringify(older)),
    { older: { ...original, passes: [pass('old-3', 'maya', { outAt: later, updatedAt: later })] } },
  );
  const next = await context.newPage();
  await next.goto('/settings');
  await expect.poll(async () => (await saved(next)).passes.map((each: { id: string }) => each.id).sort()).toEqual(['old-1', 'old-2', 'old-3']);
  account = await saved(next);
  expect(account.pin).toBe('9753');
  await context.close();
});

test('B. an open pass the teacher corrected still takes the student coming back at the kiosk', async ({ page }) => {
  await seed(page, 'hallway.account.v2', oldAccount({ version: 2, passes: [pass('open', 'maya', { corrected: true })] }));
  await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).receiveReturns([{ passId: 'open', inAt: '2026-11-02T15:07:00.000Z' }]));
  const account = await saved(page);
  expect(account.passes[0]).toMatchObject({ inAt: '2026-11-02T15:07:00.000Z', endedBy: 'student' });
});

test('C. when the browser is full, the older copy makes room; a year of attendance stays small', async ({ page }) => {
  await page.goto('/privacy');
  // How much fits in this browser, roughly.
  const room = await page.evaluate(() => {
    localStorage.clear();
    let low = 0;
    let high = 20_000_000;
    while (high - low > 50_000) {
      const size = Math.floor((low + high) / 2);
      try {
        localStorage.setItem('probe', 'x'.repeat(size));
        low = size;
      } catch {
        high = size;
      }
      localStorage.removeItem('probe');
    }
    return low;
  });
  // N1. The first save, with no room for a second copy: the older copy is the only one, so it stays,
  // nothing is lost, and the teacher is told.
  const big = { ...oldAccount(), pad: 'x'.repeat(Math.floor(room * 0.6)) };
  await seed(page, 'hallway.account', big);
  const first = await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    m.setPin('9753');
    return { full: m.storage.full, legacy: localStorage.getItem('hallway.account') !== null, v2: localStorage.getItem('hallway.account.v2') };
  });
  expect(first).toEqual({ full: true, legacy: true, v2: null });
  await page.reload();
  expect(await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).account.classes[0]?.name)).toBe('Period 1');

  // Once this version's own copy is saved, the older copy can make room for it.
  await page.evaluate(
    ({ older, own }) => {
      localStorage.clear();
      localStorage.setItem('hallway.account', JSON.stringify(older));
      localStorage.setItem('hallway.account.v2', JSON.stringify(own));
    },
    { older: big, own: oldAccount({ version: 2 }) },
  );
  await page.goto('/settings');
  const later = await page.evaluate(async (padding) => {
    const m = await import('/src/lib/account.svelte.ts');
    (m.account as unknown as { pad: string }).pad = 'y'.repeat(padding);
    m.setPin('9753');
    return { full: m.storage.full, legacy: localStorage.getItem('hallway.account'), pin: JSON.parse(localStorage.getItem('hallway.account.v2')!).pin };
  }, Math.floor(room * 0.5));
  expect(later).toEqual({ full: false, legacy: null, pin: '9753' });

  // 150 students, 180 school days: saved compactly, well under what a browser holds.
  await seed(page, 'hallway.account.v2', oldAccount({ version: 2, roster: [], classes: [] }));
  const size = await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    const marks = [];
    for (let day = 0; day < 180; day++) {
      const date = new Date(2026, 8, 1 + day).toISOString().slice(0, 10);
      for (let student = 0; student < 150; student++) {
        marks.push({
          id: '',
          classId: `class-${student % 6}`,
          studentId: `00000000-0000-4000-8000-${String(student).padStart(12, '0')}`,
          studentName: 'Maya C.',
          day: date,
          status: 'present' as const,
          arrivedAt: new Date(2026, 8, 1 + day, 9, 3).toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
    }
    m.account.attendance = marks;
    m.setPin('9753');
    return localStorage.getItem('hallway.account.v2')!.length;
  });
  expect(size).toBeLessThan(2_500_000);
});

test('E. a kiosk whose saved data is broken says so, keeps one copy, and never deletes it', async ({ page }) => {
  await page.goto('/privacy');
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('hallway.door.v2', '{"laptopPeerId":');
  });
  await page.goto('/door');
  await expect(page.getByText("This kiosk couldn't read what it had saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("This kiosk couldn't read what it had saved.")).toBeVisible();
  const storage = await page.evaluate(() => ({ ...localStorage }));
  expect(storage['hallway.door.v2']).toBe('{"laptopPeerId":');
  expect(Object.keys(storage).filter((key) => key.startsWith('hallway.door.unreadable.'))).toHaveLength(1);
});

test('F. reloading unreadable data keeps one copy of it, not one per reload', async ({ page }) => {
  await seed(page, 'hallway.account', '{"broken":');
  const screen = page.getByRole('heading', { name: "We couldn't read your Happy Hallways data" });
  await expect(screen).toBeVisible();
  await page.reload();
  await expect(screen).toBeVisible();
  await page.reload();
  await expect(screen).toBeVisible();
  const copies = await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('hallway.account.unreadable.')).length);
  expect(copies).toBe(1);
});

test("an empty save under this version's key falls back to the older one, not to a blank account", async ({ page }) => {
  await page.goto('/privacy');
  await page.evaluate((older) => {
    localStorage.clear();
    localStorage.setItem('hallway.account', JSON.stringify(older));
    localStorage.setItem('hallway.account.v2', '{}');
  }, oldAccount());
  await page.goto('/settings');
  const name = await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).account.classes[0]?.name);
  expect(name).toBe('Period 1');
});

test("N2. restoring a backup never takes in this computer's older copy", async ({ page }) => {
  const mine = oldAccount({ passes: [pass('mine-1', 'maya'), pass('mine-2', 'sam')], requests: [{ id: 'r-mine', classId: 'p1', studentId: 'maya', studentName: 'Maya C.', destination: 'Restroom', askedAt: at }] });
  await seed(page, 'hallway.account', mine);
  await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).setPin('9753'));
  const theirs = JSON.stringify({ app: 'hallway', ...oldAccount({ version: 2, laptopPeerId: 'hallway-theirs', passes: [pass('theirs-1', 'maya')], legacySeen: 'from-their-computer' }) });
  await page.evaluate(async (text) => (await import('/src/lib/account.svelte.ts')).importAccount(text, false), theirs);
  await page.reload();
  await page.waitForTimeout(500);
  const account = await saved(page);
  expect(account.passes.map((each: { id: string }) => each.id)).toEqual(['theirs-1']);
  expect(account.requests ?? []).toEqual([]);
});

test('N3. an older tab never brings back a Request answered here, or passes of a class removed here', async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  const request = { id: 'r1', classId: 'p1', studentId: 'maya', studentName: 'Maya C.', destination: 'Restroom', askedAt: at };
  const original = oldAccount({
    classes: [...oldAccount().classes, { id: 'p9', name: 'Period 9', createdAt: at, members: [] }],
    passes: [pass('gone', 'sam', { classId: 'p9' })],
    requests: [request],
  });
  await seed(page, 'hallway.account', original);
  await page.evaluate(async () => {
    const m = await import('/src/lib/account.svelte.ts');
    m.answered(m.account.requests[0], false);
    m.deleteClass('p9');
  });

  // The older tab saves again: same waiting Request, same pass, and one new pass.
  const olderTab = await context.newPage();
  await olderTab.goto('/privacy');
  await olderTab.evaluate(
    ({ older }) => localStorage.setItem('hallway.account', JSON.stringify(older)),
    { older: { ...original, passes: [...original.passes, pass('new', 'maya', { outAt: later, updatedAt: later })] } },
  );
  await expect.poll(async () => (await saved(page)).passes.map((each: { id: string }) => each.id)).toEqual(['new']);
  const account = await saved(page);
  expect(account.requests).toEqual([]);
  expect(account.deniedRequests.map((each: { id: string }) => each.id)).toEqual(['r1']);
  await context.close();
});

test('N5. a broken attendance mark is set aside, not allowed to make everything unreadable', async ({ page }) => {
  await seed(
    page,
    'hallway.account.v2',
    oldAccount({
      version: 2,
      attendance: [],
      attendanceLog: { p1: { '2026-11-02': { maya: ['p', 540, null, 0, 'Maya C.'] }, nope: { sam: ['a'] } } },
    }),
  );
  await expect(page.getByRole('heading', { name: "We couldn't read your Happy Hallways data" })).toBeHidden();
  await page.evaluate(async () => (await import('/src/lib/account.svelte.ts')).setPin('9753'));
  const account = await saved(page);
  expect(account.attendance.map((each: { studentId: string }) => each.studentId)).toEqual(['maya']);
  expect(account.unreadableAttendance).toEqual([{ classId: 'p1', day: 'nope', students: { sam: ['a'] } }]);
});

test('an update during class, with student devices on, starts that class Room straight away', async ({ page }) => {
  // The older version kept one lasting Student link; the update leaves no Room until something starts one.
  await seed(page, 'hallway.account', oldAccount({ activeClass: { id: 'p1', changedAt: at }, studentLink: { id: 'old-link', open: true } }));
  await page.goto('/');
  const card = page.locator('.device', { hasText: 'Student devices' });
  await expect(card).not.toContainText('appears when a class is on');
  await expect(card).toContainText(/\d{3} \d{3}/);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('hallway.account.v2') ?? '{}'));
  expect(saved.studentLink.room.classId).toBe('p1');
});
