<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import {
    account,
    endNoPassTime,
    markReturned,
    openPasses,
    passStatus,
    passStatusText,
    startNoPassTime,
    waitingRequests,
  } from './account.svelte';
  import { clock } from './clock.svelte';
  import DestinationIcon from './DestinationIcon.svelte';
  import { answerRequest } from './door.svelte';
  import Icon from './Icon.svelte';
  import { kioskOnline } from './link.svelte';
  import { duration, isOverdue } from './passes';
  import { overdueChime } from './sound';
  import Modal from './Modal.svelte';
  import { slide } from 'svelte/transition';
  import type { Block, PassRequest } from './types';

  /**
   * Needs you: the drawer in the bottom-right corner of every teacher page, like
   * a minimised email draft. Its tab counts what is waiting on the teacher, the
   * Requests to answer and the students who are Overdue, and it slides up to
   * show them, with how the class stands right now and the switch to stop or
   * open passes. It starts open, and this browser remembers whether the teacher
   * left it open or closed. It slides up by itself when something new needs the
   * teacher, and back down when nothing does. The kiosk never shows it.
   */
  const requests = $derived(waitingRequests());
  const overdue = $derived(
    openPasses()
      .filter((pass) => isOverdue(pass, clock.now))
      .sort((a, b) => a.outAt.localeCompare(b.outAt)),
  );
  const waiting = $derived(requests.length + overdue.length);
  const openKey = 'hallway.drawer-open';
  let open = $state(readOpen());
  // What this drawer last saw. Starting from what's there on load means arriving at a page doesn't count as news.
  // svelte-ignore state_referenced_locally
  let lastCount = waiting;

  function readOpen() {
    try {
      return localStorage.getItem(openKey) !== 'false';
    } catch {
      return true;
    }
  }

  function setOpen(next: boolean) {
    open = next;
    try {
      localStorage.setItem(openKey, String(next));
    } catch {
      // Storage blocked: it just won't remember.
    }
  }

  $effect(() => {
    const count = waiting;
    if (count > lastCount) setOpen(true);
    if (count === 0 && lastCount > 0) setOpen(false);
    lastCount = count;
  });

  // The chime, if the teacher turned it on, when another student becomes Overdue.
  // svelte-ignore state_referenced_locally
  let overdueBefore = overdue.length;
  $effect(() => {
    if (overdue.length > overdueBefore && account.overdueChime) overdueChime();
    overdueBefore = overdue.length;
  });

  /** A paired kiosk that can't reach this tab may already have signed overdue students back in. */
  const mayBeOutOfDate = $derived(account.kiosk?.kind === 'device' && !kioskOnline());

  /** How the class on the door stands right now, in one line. */
  const status = $derived(passStatus(clock.now));
  const outNow = $derived(account.activeClass?.id ? openPasses(account.activeClass.id).length : 0);
  const inLine = $derived(account.line.filter((spot) => spot.classId === account.activeClass?.id).length);

  // Overdue students also show at the front of the tab's title, so a teacher in another tab still sees them.
  const titlePrefix = /\(\d+\) Overdue · /;
  let navigated = $state(0);
  afterNavigate(() => navigated++);
  $effect(() => {
    void navigated;
    const base = document.title.replace(titlePrefix, '');
    document.title = overdue.length ? `(${overdue.length}) Overdue · ${base}` : base;
  });
  $effect(() => () => {
    document.title = document.title.replace(titlePrefix, '');
  });

  const canAsk = $derived(account.kiosk?.kind === 'device' || !!account.studentLink?.open);

  const blockText: Record<Block, (request: PassRequest) => string> = {
    allowance: () => 'Out of passes',
    'no-pass': () => 'No-pass time',
    full: (request) => (account.limitMode === 'class' ? 'Class limit reached' : `${request.destination} is full`),
  };

  const reducedMotion = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** The Request open in the details window, if any. */
  let looking = $state<PassRequest | null>(null);

  function answer(request: PassRequest, approve: boolean) {
    answerRequest(request, approve);
    looking = null;
  }

  const blockDetail: Record<Block, string> = {
    allowance: 'They have used every pass they get for now.',
    'no-pass': "It's a no-pass time.",
    full: 'As many students as you allow are already out there, or others are ahead of them in line.',
  };

  function ago(when: string) {
    const minutes = Math.floor((clock.now - new Date(when).getTime()) / 60_000);
    return minutes < 1 ? 'just now' : `${minutes} min ago`;
  }
</script>

<section class="drawer" class:open aria-labelledby="drawer-title">
  <button class="tab" aria-expanded={open} onclick={() => setOpen(!open)}>
    <span class="tab-title" id="drawer-title">Needs you</span>
    <span class="count" class:none={!requests.length} title="Requests"><Icon name="hand" size={13} />{requests.length}</span>
    {#if overdue.length}<span class="count overdue" title="Overdue"><Icon name="clock" size={13} />{overdue.length}</span>{/if}
    {#if account.manualNoPass}<span class="no-pass-chip">No passes</span>{/if}
    <span class="chevron"><Icon name={open ? 'chevron-down' : 'chevron-up'} size={16} /></span>
  </button>

  {#if open}
    <!-- Slides up and down; instantly for anyone who has asked their computer for less motion. -->
    <div class="body" transition:slide={{ duration: reducedMotion ? 0 : 140 }}>
      <p class="right-now">
        <strong>{passStatusText[status]}</strong>
        {#if account.activeClass?.id}<span class="muted"> · {outNow} out · {inLine} in line</span>{/if}
      </p>

      {#if overdue.length}
        <!-- Overdue Reminders: they stay until the student is back; there's no dismissing them. -->
        <ul class="overdue-reminder">
          {#each overdue as pass (pass.id)}
            <li>
              <span class="overdue-text">
                <Icon name="clock" size={15} /><strong>{pass.studentName}</strong> at the {pass.destination} for {duration(pass, clock.now)} min
                <span class="muted">(expected {pass.minutes})</span>
              </span>
              <button class="btn btn-small" onclick={() => markReturned(pass.id)}><Icon name="check" size={14} />Mark back</button>
            </li>
          {/each}
        </ul>
        {#if mayBeOutOfDate}
          <p class="muted small">The kiosk is offline, so this may be out of date. Check the door before marking anyone back.</p>
        {/if}
      {/if}

      {#if requests.length}
        <ul class="requests">
          {#each requests as request (request.id)}
            <!-- Two lines: who and where, then why and the answer. Click the top line for the full details. -->
            <li>
              <button class="request-main" onclick={() => (looking = request)} aria-label="Details for {request.studentName}'s request">
                <strong>{request.studentName}</strong>
                <span class="destination-chip"><DestinationIcon label={request.destination} size={18} />{request.destination}</span>
                <span class="muted small when">{ago(request.askedAt)}</span>
              </button>
              <div class="request-line">
                <span class="why">{request.blocks.map((block) => blockText[block](request)).join(' · ')}</span>
                <button class="btn btn-small" onclick={() => answer(request, false)}>Deny</button>
                <button class="btn btn-small btn-primary" onclick={() => answer(request, true)}>Approve</button>
              </div>
            </li>
          {/each}
        </ul>
      {:else if !overdue.length}
        <p class="empty">
          {canAsk
            ? 'Nothing needs you right now.'
            : 'Nothing needs you right now. Students can ask you from a paired kiosk or their own device.'}
        </p>
      {/if}

      <!-- Always the last thing in the drawer. -->
      {#if account.manualNoPass}
        <button class="btn btn-primary passes" onclick={endNoPassTime}><Icon name="check" size={16} />Open passes</button>
      {:else}
        <button class="btn passes" onclick={startNoPassTime} title="Stop students starting passes until you open them again">
          <Icon name="ban" size={16} />No passes now
        </button>
      {/if}
    </div>
  {/if}
</section>

{#if looking}
  {@const request = looking}
  <Modal onClose={() => (looking = null)} labelledby="request-title">
    <div class="dialog">
      <div class="dialog-head">
        <div>
          <p class="eyebrow">Request · {ago(request.askedAt)}</p>
          <h2 id="request-title">{request.studentName} wants to go to {request.destination}</h2>
        </div>
      </div>
      <p class="muted">What's stopping them:</p>
      <ul class="reasons">
        {#each request.blocks as block (block)}
          <li>
            <strong>{blockText[block](request)}</strong>
            <span class="muted small">{blockDetail[block]}</span>
          </li>
        {/each}
      </ul>
      <p class="muted small">If you approve, their pass starts now and shows in History that you let them go.</p>
      <div class="dialog-actions">
        <button class="btn" onclick={() => answer(request, false)}>Deny</button>
        <button class="btn btn-primary" onclick={() => answer(request, true)}><Icon name="check" size={16} />Approve</button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  /* As wide as the corner (and Home's Devices card), lifted off the page by its shadow. */
  .drawer {
    width: 100%;
    border: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 12px 12px 0 0;
    background: var(--surface);
    box-shadow:
      0 -2px 6px rgba(40, 30, 10, 0.08),
      0 -12px 32px rgba(40, 30, 10, 0.16);
    pointer-events: auto;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }

  .tab-title {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 800;
  }

  .count {
    display: grid;
    place-items: center;
    min-width: 24px;
    height: 24px;
    padding: 0 7px;
    border-radius: 999px;
    background: #6a4cbb;
    color: #fff;
    font-size: 12.5px;
    font-weight: 800;
  }

  .count {
    display: inline-flex;
    gap: 3px;
  }

  .count.overdue {
    background: var(--warn-wash);
    color: var(--warn);
    border: 1px solid #ecd3ac;
  }

  .count.none {
    background: var(--surface-sunk);
    color: var(--muted);
    border: 1px solid var(--border);
  }

  .no-pass-chip {
    padding: 2px 8px;
    border-radius: 999px;
    background: var(--warn-wash);
    color: var(--warn);
    font-size: 12px;
    font-weight: 800;
  }

  .chevron {
    margin-left: auto;
    color: var(--muted);
  }

  .body {
    display: grid;
    gap: 10px;
    max-height: min(60vh, 520px);
    padding: 0 16px 16px;
    overflow-y: auto;
  }

  .requests {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .requests li {
    display: grid;
    gap: 4px;
    padding: 8px 10px;
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .request-main {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }

  .request-main:hover strong {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .destination-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    color: var(--muted);
    font-size: 13.5px;
    font-weight: 700;
    white-space: nowrap;
  }

  .when {
    margin-left: auto;
    white-space: nowrap;
  }

  .request-line {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .why {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    color: var(--muted);
    font-size: 12.5px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .right-now {
    margin: 0;
    font-size: 13.5px;
  }

  .overdue-reminder {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .overdue-reminder li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border: 1px solid #ecd3ac;
    border-radius: 10px;
    background: var(--warn-wash);
  }

  .overdue-text {
    flex: 1;
    display: inline-flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
    font-size: 13.5px;
  }

  .overdue-text :global(.ui-icon) {
    color: var(--warn);
  }

  .empty {
    margin: 0;
    padding: 14px;
    border: 1.5px dashed var(--border-strong, var(--border));
    border-radius: 10px;
    color: var(--muted);
    font-size: 13.5px;
    text-align: center;
  }

  .passes {
    justify-content: center;
  }

  .reasons {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .reasons li {
    display: grid;
    gap: 2px;
  }
</style>
