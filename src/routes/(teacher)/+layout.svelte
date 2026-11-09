<script lang="ts">
  import { afterNavigate, goto } from '$app/navigation';
  import { page, updated } from '$app/state';
  import { onMount } from 'svelte';
  import { account, dismissRosterMerge, exportAccount, keepAttendance, keepToSchedule, openPasses, storage, waitingRequests } from '#lib/account.svelte.ts';
  import { download } from '#lib/csv.ts';
  import { isPairedDevice, settleRequests } from '#lib/door.svelte.ts';
  import GettingStarted from '#lib/GettingStarted.svelte';
  import { askBeforeLeaving, leaveTo } from '#lib/leaving.ts';
  import { refreshLink } from '#lib/link.svelte.ts';
  import { onboarding } from '#lib/onboarding.svelte.ts';
  import Sidebar from '#lib/Sidebar.svelte';
  import { serveStudentLink } from '#lib/studentLink.svelte.ts';
  import Toast from '#lib/Toast.svelte';
  import Popups from '#lib/Popups.svelte';
  import ControlDrawer from '#lib/ControlDrawer.svelte';
  import { keepAwake } from '#lib/wakeLock.ts';
  import { mergeSuggestions } from '#lib/merge.ts';

  let { children } = $props();

  /**
   * About and Privacy are built in advance so search engines can read them
   * (see their +page.ts). A built page can't know what's in this browser, so
   * it shows an empty sidebar until it's running here, then fills it in.
   */
  const builtInAdvance = $derived(['/(teacher)/about', '/(teacher)/privacy'].includes(page.route.id ?? ''));
  let running = $state(false);
  onMount(() => (running = true));
  const ready = $derived(running || !builtInAdvance);

  /**
   * The teacher's pages are for the teacher's laptop. A paired kiosk device, or
   * this computer while it is locked as the kiosk, goes back to the door screen.
   */
  const belongsAtDoor = $derived(
    ready && (isPairedDevice() || (account.kiosk?.kind === 'this-computer' && account.kiosk.locked)),
  );

  $effect(() => {
    if (belongsAtDoor) goto('/door', { replace: true });
  });

  $effect(() => {
    if (ready && !belongsAtDoor) refreshLink();
  });

  // Students watching the Student link are answered by this computer, from whichever page is open.
  $effect(() => {
    if (ready && !isPairedDevice()) serveStudentLink();
  });

  /**
   * This computer decides everything at the door (docs/adr/0014): it keeps the
   * door to the schedule as each period starts, ends Requests nothing stops
   * any more, and marks Absent students who never arrived (docs/adr/0020).
   */
  $effect(() => {
    if (!ready || belongsAtDoor) return;
    const tick = () => {
      keepToSchedule();
      settleRequests();
      keepAttendance();
    };
    tick();
    const timer = setInterval(tick, 15_000);
    return () => clearInterval(timer);
  });

  /** Whether a kiosk or students' devices depend on this computer right now. */
  const doorDependsOnThis = $derived(
    !belongsAtDoor && (account.kiosk?.kind === 'device' || !!account.studentLink?.open),
  );

  // The door stops while this computer sleeps, so keep the screen awake while a class is on it.
  $effect(() => {
    keepAwake(doorDependsOnThis && !!account.activeClass?.id);
    return () => keepAwake(false);
  });

  /**
   * After an update, the teacher's page refreshes itself while it's in the
   * background, so it never stays on an older version than the kiosk. While
   * the teacher is looking at it, a bar offers the refresh instead, so nothing
   * they are typing is lost.
   */
  function refreshWhenHidden() {
    if (updated.current && document.visibilityState === 'hidden') leaveTo(location.href);
  }

  $effect(() => {
    if (updated.current) refreshWhenHidden();
  });

  // Waiting Requests show at the front of the tab's title, so a teacher in another tab sees them.
  const titlePrefix = /\(\d+\) Requests? · /;
  let navigated = $state(0);
  afterNavigate(() => navigated++);
  $effect(() => {
    void navigated;
    const count = belongsAtDoor ? 0 : waitingRequests().length;
    const base = document.title.replace(titlePrefix, '');
    document.title = count ? `(${count}) ${count === 1 ? 'Request' : 'Requests'} · ${base}` : base;
  });
</script>

<!-- The kiosk and the Student link stop when this page closes, so it asks first: always with a paired kiosk, and while students are out. -->
<svelte:window
  onbeforeunload={(event) =>
    askBeforeLeaving(
      event,
      doorDependsOnThis && (account.kiosk?.kind === 'device' || openPasses(account.activeClass?.id ?? undefined).length > 0),
    )}
/>
<svelte:document onvisibilitychange={refreshWhenHidden} />

{#if !belongsAtDoor}
  <div class="shell">
    {#if ready}<Sidebar />{:else}<aside class="sidebar"></aside>{/if}
    <main class="main" class:has-drawer={account.classes.length > 0 && page.url.pathname !== '/'}>
      {@render children()}
    </main>
  </div>
  <!-- Messages for every page float in this corner, so the page never shifts. -->
  {#if ready}
    <div class="corner" class:with-drawer={account.classes.length > 0}>
      <!-- The browser has no room left to save: nothing is lost while this page stays open, but a backup keeps it safe. -->
      {#if storage.full}
        <Toast icon="alert-triangle">
          <div class="update">
            <span>This browser is out of room to save Happy Hallways. Download a backup now so nothing is lost.</span>
            <button class="btn btn-small btn-primary" onclick={() => download(`happy-hallways-${new Date().toISOString().slice(0, 10)}.json`, exportAccount(), 'application/json')}>Download backup</button>
          </div>
        </Toast>
      {/if}
      {#if updated.current}
        <Toast icon="sparkles">
          <div class="update">
            <span>Happy Hallways has been updated. Refresh to get the newest version.</span>
            <button class="btn btn-small" onclick={() => leaveTo(location.href)}>Refresh</button>
          </div>
        </Toast>
      {/if}
      <!-- Once, after the Roster arrived: students who may be one child kept twice. See docs/adr/0015. -->
      {#if !account.rosterMergeSeen && page.url.pathname !== '/roster' && mergeSuggestions(account).length}
        <Toast icon="users">
          <div class="update">
            <span>Some students may be the same student in two of your classes.</span>
            <a class="btn btn-small" href="/roster">Review</a>
            <button class="btn btn-small btn-quiet" onclick={dismissRosterMerge}>Not now</button>
          </div>
        </Toast>
      {/if}
      <!-- Needs you: Requests, Overdue Reminders and No passes, on every page, at the very bottom of the corner. -->
      {#if account.classes.length}<ControlDrawer />{/if}
    </div>
    <!-- The checklist sits in the bottom-left of the page, by the sidebar, apart from Needs you. -->
    {#if onboarding.showChecklist}<div class="checklist-spot"><GettingStarted /></div>{/if}
    <Popups />
  {/if}
{/if}

<style>
  /* The control drawer sits flush with the bottom edge; without it, the corner keeps a margin. */
  /* Lined up with the page's own right margin. */
  .corner {
    position: fixed;
    right: clamp(18px, 5vw, 64px);
    bottom: 20px;
    z-index: 45;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 10px;
    /* Wide enough for Requests to read on two lines. */
    width: min(420px, calc(100vw - 40px));
    pointer-events: none;
  }

  .corner.with-drawer {
    bottom: 0;
  }

  .checklist-spot {
    position: fixed;
    left: calc(252px + clamp(18px, 5vw, 64px));
    bottom: 20px;
    z-index: 45;
  }

  /* Where the sidebar moves to the top. */
  @media (max-width: 760px) {
    .checklist-spot {
      left: 18px;
    }
  }

  .update {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  /* Room under the last thing on the page, so it can scroll clear of the closed Needs you drawer. Home fits the screen, so it has none. */
  .main.has-drawer {
    padding-bottom: 56px;
  }
</style>
