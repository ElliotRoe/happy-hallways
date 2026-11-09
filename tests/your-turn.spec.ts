import { expect, test } from '@playwright/test';

/** A student's own device says "your turn" once per turn, and the tab title flashes while it lasts. */
test("a student's device alerts once per turn, not on a reconnect, and flashes the title while it's their turn", async ({ page }) => {
  await page.goto('/privacy');
  const result = await page.evaluate(async () => {
    const t = await import('/src/lib/yourTurn.ts');
    const me = (upNext: boolean) => ({ studentId: 's', name: 'Maya C.', canAct: true, line: { destination: 'Restroom', position: 1, upNext } });
    const steps: boolean[] = [];
    let alerted = false;
    for (const view of [me(false), me(true), me(true), null, me(true), me(false), me(true)]) {
      const next = t.nextAlert(alerted, view);
      alerted = next.alerted;
      steps.push(next.alert);
    }
    return {
      steps,
      watching: t.isUpNext(null),
      out: t.isUpNext({ ...me(true), out: { destination: 'Restroom', secondsOut: 5, minutes: 5 } }),
      titles: [0, 1, 2].map((tick) => t.turnTitle('Period 1 · Happy Hallways', true, tick)),
      notUp: t.turnTitle('Period 1 · Happy Hallways', false, 0),
    };
  });
  // Up Next, still Up Next, a reconnect (nothing heard), Up Next again: one alert. Out of line and back: a new turn.
  expect(result.steps).toEqual([false, true, false, false, false, false, true]);
  expect(result.watching).toBe(false);
  expect(result.out).toBe(false);
  expect(result.titles).toEqual(['Your turn! · Happy Hallways', 'Period 1 · Happy Hallways', 'Your turn! · Happy Hallways']);
  expect(result.notUp).toBe('Period 1 · Happy Hallways');
});
