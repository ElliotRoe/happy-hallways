<script lang="ts">
  import { page } from '$app/state';

  /** A row of tabs under a page's header, one link per page. */
  let { tabs, label }: { tabs: { href: string; label: string }[]; label: string } = $props();
</script>

<nav class="page-tabs" aria-label={label}>
  {#each tabs as tab (tab.href)}
    <a href={tab.href} class:active={page.url.pathname === tab.href} aria-current={page.url.pathname === tab.href ? 'page' : undefined}
      >{tab.label}</a
    >
  {/each}
</nav>

<style>
  .page-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    border-bottom: 1px solid var(--border);
  }

  a {
    margin-bottom: -1px;
    padding: 8px 14px;
    border-bottom: 2px solid transparent;
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
    text-decoration: none;
  }

  a:hover {
    color: var(--text);
  }

  a.active {
    border-bottom-color: var(--accent);
    color: var(--text);
  }
</style>
