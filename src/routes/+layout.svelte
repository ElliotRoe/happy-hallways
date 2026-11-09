<script lang="ts">
  import { onMount } from 'svelte';
  import '../app.css';
  import { unreadable } from '#lib/account.svelte.ts';
  import { startAnalytics } from '#lib/analytics.ts';
  import UnreadableData from '#lib/UnreadableData.svelte';

  let { children } = $props();

  onMount(startAnalytics);
</script>

<!-- Saved data that couldn't be read: nothing else runs, so nothing can save over it. -->
{#if unreadable.raw !== null}
  <UnreadableData />
{:else}
  {@render children()}
{/if}
