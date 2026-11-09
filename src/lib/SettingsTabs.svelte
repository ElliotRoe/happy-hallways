<script lang="ts">
  import PageTabs from './PageTabs.svelte';

  /** Settings' tabs: the teacher's own data, then the guides, what's changed, about and privacy. */
  const tabs = [
    { href: '/settings', label: 'Your data' },
    { href: '/settings/guides', label: 'Guides' },
    { href: '/settings/changes', label: "What's changed" },
    { href: '/about', label: 'About' },
    { href: '/privacy', label: 'Privacy' },
  ];
</script>

<PageTabs {tabs} label="Settings" />
