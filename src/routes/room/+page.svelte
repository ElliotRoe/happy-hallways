<script lang="ts">
  import { account, findClass } from '#lib/account.svelte.ts';
  import RoomBoard from '#lib/RoomBoard.svelte';
  import { currentRoom } from '#lib/studentLink.svelte.ts';

  /** The pop-out window for the board: the Room code, with a button to go full screen. See docs/adr/0019. */
  const room = $derived(currentRoom());
  const className = $derived(findClass(account.activeClass?.id)?.name ?? '');
</script>

<svelte:head>
  <title>{room ? `Join ${className}` : 'Join your class'} · Happy Hallways</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<RoomBoard onFullScreen={() => document.documentElement.requestFullscreen?.()} />
