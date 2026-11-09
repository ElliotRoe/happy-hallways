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
  let over = $state<string | null>(null);

  function drop(targetId: string) {
    if (dragging && dragging !== targetId) moveDestination(dragging, account.destinations.findIndex((each) => each.id === targetId));
    dragging = null;
    over = null;
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
        Looking to create separate lines for different bathrooms, like a girls' line and a boys' line? Check out the
        guide.
      </p>
      <a class="btn btn-small" href="/guides/separate-bathroom-lines">Open guide</a>
      <button class="btn btn-small btn-quiet close" aria-label="Close this tip" onclick={() => markPopupsSeen([bathroomTip])}>
        <Icon name="x" size={16} />
      </button>
    </aside>
  {/if}

  <div class="destination-cards">
    {#each account.destinations as destination (destination.id)}
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="card-slot"
        class:over={over === destination.id && dragging !== destination.id}
        class:lifted={dragging === destination.id}
        draggable="true"
        ondragstart={(event) => {
          dragging = destination.id;
          event.dataTransfer?.setData('text/plain', destination.id);
        }}
        ondragover={(event) => {
          event.preventDefault();
          over = destination.id;
        }}
        ondragleave={() => over === destination.id && (over = null)}
        ondrop={(event) => {
          event.preventDefault();
          drop(destination.id);
        }}
        ondragend={() => ((dragging = null), (over = null))}
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
    <div class="notice-bar"><Icon name="alert-triangle" />Students can't sign out until there's at least one destination.</div>
  {/if}
</div>

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

  .card-slot.over .destination-card {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-wash);
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
