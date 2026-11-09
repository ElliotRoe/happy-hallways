<script lang="ts">
  import { account, markPopupsSeen, moveDestination } from '#lib/account.svelte.ts';
  import { tick } from 'svelte';
  import DestinationDialog from '#lib/DestinationDialog.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import { classLimitText, limitText } from '#lib/limits.ts';
  import Icon from '#lib/Icon.svelte';
  import { updateOnboarding } from '#lib/onboarding.svelte.ts';
  import type { Destination } from '#lib/types.ts';

  /** undefined: closed. null: adding a new one. */
  let editing = $state<Destination | null | undefined>(undefined);

  /**
   * The order here is the order on the kiosk. Drag a card to move it, or use the
   * grip's arrow keys.
   */
  let dragging = $state<string | null>(null);
  /** Where the dragged card would land: the gap before card `index` (or after the last), and the line drawn there. */
  let gap = $state<{ index: number; left: number; top: number; height: number } | null>(null);
  let grid: HTMLDivElement;

  /** Finds the gap nearest the pointer, anywhere over the cards or between them. */
  function findGap(event: DragEvent) {
    const slots = [...grid.querySelectorAll<HTMLElement>('.card-slot')];
    if (!slots.length) return;
    const box = grid.getBoundingClientRect();
    const rects = slots.map((slot) => slot.getBoundingClientRect());
    // The nearest card: rows first, then across.
    let nearest = 0;
    let best = Infinity;
    rects.forEach((rect, index) => {
      const dy = event.clientY < rect.top ? rect.top - event.clientY : event.clientY > rect.bottom ? event.clientY - rect.bottom : 0;
      const dx = Math.abs(event.clientX - (rect.left + rect.width / 2));
      const score = dy * 10_000 + dx;
      if (score < best) {
        best = score;
        nearest = index;
      }
    });
    const rect = rects[nearest];
    const after = event.clientX > rect.left + rect.width / 2;
    const index = nearest + (after ? 1 : 0);
    const columnGap = parseFloat(getComputedStyle(grid).columnGap) || 12;
    const x = after ? rect.right + columnGap / 2 : rect.left - columnGap / 2;
    gap = { index, left: x - box.left, top: rect.top - box.top, height: rect.height };
  }

  function drop() {
    if (dragging && gap) {
      const from = account.destinations.findIndex((each) => each.id === dragging);
      moveDestination(dragging, gap.index > from ? gap.index - 1 : gap.index);
    }
    dragging = null;
    gap = null;
  }

  async function moveWithKeys(event: KeyboardEvent, id: string) {
    const step = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : ['ArrowDown', 'ArrowRight'].includes(event.key) ? 1 : 0;
    if (!step) return;
    event.preventDefault();
    moveDestination(id, account.destinations.findIndex((each) => each.id === id) + step);
    await tick();
    document.querySelector<HTMLElement>(`[data-grip="${id}"]`)?.focus();
  }

  /** The tip about separate bathroom lines, until the teacher closes it. It stays closed (it's saved with their data). */
  const bathroomTip = 'destinations-bathroom-lines';
  const showBathroomTip = $derived(!account.seenPopups[bathroomTip]);

  // Looking over the destinations ticks them off the getting-started checklist.
  updateOnboarding({ visitedDestinations: true });
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Destinations</p>
      <h1>Where students can go</h1>
      <p class="muted">The kiosk shows them in this order. Drag to reorder.</p>
    </div>
    <button class="btn btn-primary" onclick={() => (editing = null)}><Icon name="plus" size={16} />Add destination</button>
  </header>

  {#if showBathroomTip}
    <aside class="tip-box" aria-label="Tip">
      <p>
        Looking to create separate lines for different bathrooms? Check out the guide.
      </p>
      <a class="btn btn-small" href="/guides/separate-bathroom-lines">Open guide</a>
      <button class="btn btn-small btn-quiet close" aria-label="Close this tip" onclick={() => markPopupsSeen([bathroomTip])}>
        <Icon name="x" size={16} />
      </button>
    </aside>
  {/if}

  <div
    class="destination-cards"
    class:dragging={!!dragging}
    bind:this={grid}
  >
    {#if dragging && gap}
      <div class="drop-line" aria-hidden="true" style:left="{gap.left}px" style:top="{gap.top}px" style:height="{gap.height}px"></div>
    {/if}
    {#each account.destinations as destination (destination.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="card-slot"
        class:lifted={dragging === destination.id}
        draggable="true"
        ondragstart={(event) => {
          dragging = destination.id;
          if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', destination.id);
          }
        }}
        ondragend={() => ((dragging = null), (gap = null))}
      >
        <button class="destination-card" onclick={() => (editing = destination)}>
          <DestinationIcon label={destination.label} size={44} />
          <div>
            <strong>{destination.label}</strong>
            <p class="muted small">
              {destination.minutes ? `${destination.minutes} minutes` : 'No time limit'} · {limitText(account, destination)}
            </p>
          </div>
        </button>
        {#if account.destinations.length > 1}
          <button
            type="button"
            class="grip"
            data-grip={destination.id}
            aria-label="Move {destination.label}"
            aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
            title="Drag to change the order"
            onkeydown={(event) => moveWithKeys(event, destination.id)}
          ><Icon name="grip" size={16} /></button>
        {/if}
      </div>
    {/each}
    <button class="destination-card add" onclick={() => (editing = null)}>
      <Icon name="plus" size={22} />Add destination
    </button>
  </div>

  {#if account.limitMode === 'class'}
    <p class="muted small">
      You have one limit for the whole class: {classLimitText(account.classLimit)}. Change it in
      <a href="/pass-options">Pass Options</a>.
    </p>
  {/if}

  {#if !account.destinations.length}
    <div class="notice-bar"><Icon name="alert-triangle" />Students can't take a pass until there's at least one destination.</div>
  {/if}
</div>

<!-- A dragged card can be dropped anywhere on the page; it lands in the gap nearest the pointer. -->
<svelte:window
  ondragover={(event) => {
    if (!dragging) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    findGap(event);
  }}
  ondrop={(event) => {
    if (!dragging) return;
    event.preventDefault();
    drop();
  }}
/>

{#if editing !== undefined}
  <DestinationDialog destination={editing} onClose={() => (editing = undefined)} />
{/if}

<style>
  /* Each card sits in a slot that can be dragged; the grip in its corner moves it by keyboard. */
  .card-slot {
    position: relative;
    display: grid;
  }

  .card-slot .destination-card {
    height: 100%;
  }

  .card-slot.lifted {
    opacity: 0.5;
  }

  .destination-cards {
    position: relative;
  }

  /* While dragging, the other cards ignore the pointer, so nothing on them flickers. */
  .destination-cards.dragging .card-slot:not(.lifted) {
    pointer-events: none;
  }

  /* Where the card will land: a line in the gap between two cards. */
  .drop-line {
    position: absolute;
    z-index: 2;
    width: 4px;
    margin-left: -2px;
    border-radius: 2px;
    background: var(--accent);
    pointer-events: none;
  }

  .drop-line::before,
  .drop-line::after {
    content: '';
    position: absolute;
    left: -3px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--accent);
  }

  .drop-line::before {
    top: -5px;
  }

  .drop-line::after {
    bottom: -5px;
  }

  /* Always visible, so it's clear each card can be dragged. */
  .grip {
    position: absolute;
    top: 8px;
    right: 8px;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border: 0;
    border-radius: 6px;
    background: none;
    color: var(--muted);
    cursor: grab;
  }

  .tip-box {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding: 12px 12px 12px 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .tip-box p {
    flex: 1;
    margin: 0;
    font-size: 14px;
  }

  .tip-box .close {
    padding-inline: 6px;
  }

  .grip:hover,
  .grip:focus-visible {
    background: var(--surface-sunk);
    color: var(--muted);
  }
</style>
