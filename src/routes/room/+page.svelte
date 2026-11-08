<script lang="ts">
  import { account, findClass } from '#lib/account.svelte.ts';
  import BrandMark from '#lib/BrandMark.svelte';
  import RoomCode from '#lib/RoomCode.svelte';
  import { currentRoom } from '#lib/studentLink.svelte.ts';

  /**
   * The pop-out for the board: the Room code and its QR code, big, for the
   * class on now. It opens in its own small window from the teacher's pages and
   * follows along as the class (and so the code) changes. See docs/adr/0019.
   */
  const room = $derived(currentRoom());
  const className = $derived(findClass(account.activeClass?.id)?.name ?? '');
</script>

<svelte:head>
  <title>{room ? `Join ${className}` : 'Join your class'} · Happy Hallways</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="board">
  <header><BrandMark size={34} /><span>Happy Hallways</span></header>
  {#if room}
    <h1>Join {className}</h1>
    <p class="hint">On your Chromebook or phone, scan the code or type it in.</p>
    <RoomCode code={room.code} size="large" />
  {:else}
    <h1>No class is open</h1>
    <p class="hint">The code shows here when a class is on and the student link is open.</p>
  {/if}
</main>

<style>
  .board {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 18px;
    min-height: 100vh;
    padding: 24px;
    background: var(--bg);
    text-align: center;
  }

  header {
    display: flex;
    align-items: center;
    gap: 10px;
    color: var(--muted);
    font-weight: 800;
  }

  h1 {
    font-size: clamp(30px, 6vw, 56px);
  }

  .hint {
    color: var(--muted);
    font-size: clamp(16px, 2.6vw, 24px);
  }
</style>
