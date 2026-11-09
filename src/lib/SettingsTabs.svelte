<script lang="ts">
  import PageTabs from './PageTabs.svelte';

  /** Settings' tabs: the teacher's own data, then the guides, about and privacy. */
  const tabs = [
    { href: '/settings', label: 'Your data' },
    { href: '/settings/guides', label: 'Guides' },
    { href: '/about', label: 'About' },
    { href: '/privacy', label: 'Privacy' },
  ];
</script>

<PageTabs {tabs} label="Settings" />
