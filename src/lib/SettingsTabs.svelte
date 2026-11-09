<script lang="ts">
  import { page } from '$app/state';

  /** Settings' tabs: the teacher's own data, then the guides, about and privacy. */
  const tabs = [
    { href: '/settings', label: 'Your data' },
    { href: '/settings/guides', label: 'Guides' },
    { href: '/about', label: 'About' },
    { href: '/privacy', label: 'Privacy' },
  ];
</script>

<nav class="settings-tabs" aria-label="Settings">
  {#each tabs as tab (tab.href)}
    <a href={tab.href} class:active={page.url.pathname === tab.href} aria-current={page.url.pathname === tab.href ? 'page' : undefined}
      >{tab.label}</a
    >
  {/each}
</nav>

<style>
  .settings-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 20px;
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
