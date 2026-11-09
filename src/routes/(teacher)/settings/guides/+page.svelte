<script lang="ts">
  import { guides } from '#lib/guides.ts';
  import SettingsTabs from '#lib/SettingsTabs.svelte';
</script>

<svelte:head>
  <title>Guides · Happy Hallways</title>
</svelte:head>

<div class="page">
  <SettingsTabs />
  <header class="page-head">
    <div>
      <p class="eyebrow">Guides</p>
      <h1>How to set things up</h1>
    </div>
  </header>
  <div class="guide-list">
    {#each guides as guide (guide.slug)}
      <a class="card guide" href="/guides/{guide.slug}">
        <strong>{guide.title}</strong>
        <span class="muted small">{guide.description}</span>
      </a>
    {/each}
  </div>
</div>

<style>
  .guide-list {
    display: grid;
    gap: 12px;
  }

  .guide {
    color: inherit;
    text-decoration: none;
  }

  .guide:hover strong {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
