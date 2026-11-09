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
  }, extra);
}

test('the kiosk lists students A to Z by the name it shows', async ({ page }) => {
  await setUp(page);
  await page.goto('/door');
  await expect(page.locator('.name .name-text')).toHaveText(['Ana B.', 'Max C.', 'Zoe A.']);
});
