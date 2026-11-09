<script lang="ts">
  import { news } from '#lib/popups.ts';
  import SettingsTabs from '#lib/SettingsTabs.svelte';

  /**
   * Every change, newest first: each piece of news in full, with the details
   * the popup leaves out to stay short.
   */
  const entries = $derived(
    [...news].reverse().map((entry) => ({
      ...entry,
      all: [...entry.items, ...(entry.more ?? [])] as { title: string; text: string; link?: { label: string; href: string } }[],
    })),
  );

  /** "2026-10-13-…" is October 13, 2026; "2026-11-…" is November 2026. */
  function dateOf(id: string) {
    const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(id);
    if (!match) return '';
    const [, year, month, day] = match;
    const date = new Date(Number(year), Number(month) - 1, Number(day ?? 1));
    return date.toLocaleDateString(undefined, day ? { month: 'long', day: 'numeric', year: 'numeric' } : { month: 'long', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>What's changed · Happy Hallways</title>
</svelte:head>

<div class="page">
  <SettingsTabs />
  <header class="page-head">
    <div>
      <p class="eyebrow">What's changed</p>
      <h1>Every change, newest first</h1>
    </div>
  </header>

  {#each entries as entry (entry.id)}
    <section class="card" aria-labelledby="change-{entry.id}">
      <div>
        <p class="eyebrow">{dateOf(entry.id)}</p>
        <h2 id="change-{entry.id}">{entry.title}</h2>
      </div>
      <ul class="changes">
        {#each entry.all as item (item.title)}
          <li>
            <strong>{item.title}</strong>
            <span class="muted">
              {item.text}
              {#if item.link}<a href={item.link.href}>{item.link.label} →</a>{/if}
            </span>
          </li>
        {/each}
      </ul>
      {#if entry.also}<p class="muted small"><strong>Also:</strong> {entry.also}</p>{/if}
    </section>
  {/each}
</div>

<style>
  .changes {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .changes li {
    display: grid;
    gap: 2px;
    font-size: 14.5px;
  }
</style>
