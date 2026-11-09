<script lang="ts">
  import { page } from '$app/state';
  import { account, classStudents, findClass } from '#lib/account.svelte.ts';
  import Icon from '#lib/Icon.svelte';
  import { displayName } from '#lib/roster.ts';

  /**
   * A sheet of PIN cards to print and cut out, one for each student, so each
   * child can be handed only their own. Printing hides everything else.
   */
  const cls = $derived(findClass(page.params.id ?? '')!);
  const cards = $derived(
    classStudents(cls)
      .filter((student) => student.status === 'current' && student.pin)
      .map((student) => ({ id: student.id, name: displayName(student), pin: student.pin }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
</script>

<svelte:head>
  <title>PIN cards · {cls.name}</title>
</svelte:head>

<section class="card no-print">
  <div>
    <p class="eyebrow">Kiosk PINs</p>
    <h2>Print PIN cards</h2>
  </div>
  {#if !account.studentPins}
    <p class="muted">PINs are off. Turn them on on the <a href="/roster">Roster</a> first.</p>
  {:else}
    <p class="muted small">
      One card per student. Cut them apart and hand each student only their own. A student who forgets theirs can still
      go: you type your teacher PIN instead.
    </p>
    <div class="row">
      <button class="btn btn-primary" onclick={() => window.print()} disabled={!cards.length}>
        <Icon name="printer" size={16} />Print
      </button>
    </div>
  {/if}
</section>

{#if account.studentPins}
  <div class="pin-cards" aria-label="PIN cards">
    {#each cards as card (card.id)}
      <div class="pin-card">
        <span class="card-class">{cls.name}</span>
        <strong class="card-name">{card.name}</strong>
        <span class="card-label">Your kiosk PIN</span>
        <span class="card-pin">{card.pin}</span>
      </div>
    {/each}
  </div>
{/if}

<style>
  .pin-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 0;
  }

  /* Dashed edges are where the scissors go. */
  .pin-card {
    display: grid;
    gap: 2px;
    justify-items: center;
    padding: 18px 12px;
    border: 1px dashed var(--border-strong);
    background: #fff;
    text-align: center;
    break-inside: avoid;
  }

  .card-class {
    color: var(--muted);
    font-size: 12px;
  }

  .card-name {
    font-size: 20px;
  }

  .card-label {
    margin-top: 6px;
    color: var(--muted);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .card-pin {
    font: 800 30px/1.1 ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.18em;
  }

  /* On paper: just the cards, with the app around them left off. */
  @media print {
    :global(.sidebar, .corner, .checklist-spot, .site-footer, .class-head, .page-tabs, .no-print) {
      display: none !important;
    }

    :global(.shell) {
      display: block !important;
    }

    :global(.main) {
      padding: 0 !important;
    }

    :global(html, body) {
      background: #fff !important;
    }

    .pin-cards {
      grid-template-columns: repeat(3, 1fr);
    }

    .pin-card {
      border-color: #999;
    }
  }
</style>
