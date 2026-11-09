import { redirect } from '@sveltejs/kit';
import { account, unreadable } from '#lib/account.svelte.ts';
import { isPairedDevice } from '#lib/door.svelte.ts';
import { onboarding } from '#lib/onboarding.svelte.ts';

/** A first visit lands on the welcome page; anyone with a class here goes straight to the app. */
export function load() {
  if (unreadable.raw !== null) return;
  if (!onboarding.welcomed && !account.classes.length && !isPairedDevice()) redirect(307, '/welcome');
}
