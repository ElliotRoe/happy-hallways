<script lang="ts">
  import { account, endNoPassTime, startNoPassTime, waitingRequests } from './account.svelte';
  import { clock } from './clock.svelte';
  import DestinationIcon from './DestinationIcon.svelte';
  import { answerRequest } from './door.svelte';
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import { slide } from 'svelte/transition';
  import type { Block, PassRequest } from './types';

  /**
   * The control drawer in the bottom-right corner of every teacher page, like a
   * minimised email draft: a tab saying how many Requests are waiting, which
   * slides up to answer them and to stop or open passes. It starts open, and
   * this browser remembers whether the teacher left it open or closed. It slides
   * up by itself when a Request comes in, and back down when the last is answered.
   */
  const requests = $derived(waitingRequests());
  const openKey = 'hallway.drawer-open';
  let open = $state(readOpen());
  // The count this drawer last saw. Starting from the count on load means arriving at a page doesn't count as news.
  // svelte-ignore state_referenced_locally
  let lastCount = requests.length;

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
    const count = requests.length;
    if (count > lastCount) setOpen(true);
    if (count === 0 && lastCount > 0) setOpen(false);
    lastCount = count;
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

<section class="drawer" class:open aria-labelledby="drawer-title" data-tip="tip-requests">
  <button class="tab" aria-expanded={open} onclick={() => setOpen(!open)}>
    <span class="tab-title" id="drawer-title"><Icon name="hand" size={17} />Requests</span>
    <span class="count" class:none={!requests.length}>{requests.length}</span>
    {#if account.manualNoPass}<span class="no-pass-chip">No passes</span>{/if}
    <span class="chevron"><Icon name={open ? 'chevron-down' : 'chevron-up'} size={16} /></span>
  </button>

  {#if open}
    <!-- Slides up and down; instantly for anyone who has asked their computer for less motion. -->
    <div class="body" transition:slide={{ duration: reducedMotion ? 0 : 140 }}>
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
      {:else}
        <p class="empty">
          {canAsk
            ? 'No requests right now.'
            : 'Students can ask you from a paired kiosk or their own device. When this computer is the kiosk, let them go with your PIN there.'}
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
