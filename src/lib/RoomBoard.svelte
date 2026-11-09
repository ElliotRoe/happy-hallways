<script lang="ts">
  import { account, findClass } from './account.svelte';
  import BrandMark from './BrandMark.svelte';
  import Icon from './Icon.svelte';
  import QrCode from './QrCode.svelte';
  import { currentRoom, spacedCode } from './studentLink.svelte';

  /**
   * The Room code for the board: the QR code and the digits, for the class on
   * now, following along as the class (and so the code) changes. Shown in the
   * pop-out window and full screen. See docs/adr/0019.
   *
   * Whatever size it's shown at, the QR code and the digits always fit: they are
   * sized from the screen's own width and height, and the brand and the hint are
   * the first things to go when it gets short. A wide screen puts them side by side.
   */
  let { onFullScreen }: { onFullScreen?: () => void } = $props();
  const room = $derived(currentRoom());
  const className = $derived(findClass(account.activeClass?.id)?.name ?? '');
  const url = $derived(room ? `${location.origin}/join/${room.code}` : '');
</script>

<main class="board">
  {#if onFullScreen}
    <button class="full" onclick={onFullScreen} aria-label="Full screen"><Icon name="maximize" size={18} /></button>
  {/if}
  {#if room}
    <header class="brand"><BrandMark size={28} /><span>Happy Hallways</span></header>
    <div class="qr-box"><QrCode text={url} label="QR code to join this class" /></div>
    <div class="words">
      <h1>Join {className}</h1>
      <p class="hint">Scan the code, or go to <strong>{location.host}/join</strong> and type:</p>
      <strong class="code" aria-label="Class code {room.code}">{spacedCode(room.code)}</strong>
    </div>
  {:else}
    <div class="words">
      <h1>No class is open</h1>
      <p class="hint">The code shows here when a class is on and student devices are turned on.</p>
    </div>
  {/if}
</main>

<style>
  /* One screen, never scrolling: everything is sized from the window. */
  .board {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: min(3vh, 3vw);
    height: 100vh;
    overflow: hidden;
    position: relative;
    padding: min(4vh, 4vw);
    background: var(--bg);
    text-align: center;
  }

  .full {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    color: var(--muted);
    cursor: pointer;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-weight: 800;
  }

  /* The QR code takes what's left after the digits: about half the height when stacked. */
  .qr-box {
    flex: none;
    width: min(80vw, 48vh);
  }

  .qr-box :global(.qr) {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    padding: 4%;
  }

  .words {
    display: grid;
    justify-items: center;
    gap: min(1.5vh, 1.5vw);
  }

  h1 {
    font-size: clamp(18px, min(6vw, 5vh), 56px);
    line-height: 1.1;
  }

  .hint {
    color: var(--muted);
    font-size: clamp(13px, min(2.6vw, 2.4vh), 24px);
  }

  .code {
    font: 800 clamp(28px, min(15vw, 13vh), 140px) / 1 ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.06em;
    white-space: nowrap;
  }

  /* A wide window: QR code on the left, words on the right, both using the full height. */
  @media (min-aspect-ratio: 4/3) {
    .board {
      flex-direction: row;
      gap: 5vw;
    }

    .brand {
      position: absolute;
      top: min(3vh, 3vw);
      left: min(3vh, 3vw);
    }

    .qr-box {
      width: min(42vw, 78vh);
    }

    .words {
      justify-items: start;
      text-align: left;
    }

    .code {
      font-size: clamp(28px, min(9vw, 16vh), 160px);
    }
  }

  /* Short windows lose the extras first, so the QR code and digits stay big. */
  @media (max-height: 560px) {
    .brand {
      display: none;
    }
  }

  @media (max-height: 420px) {
    .hint {
      display: none;
    }
  }

  @media (max-height: 300px) {
    h1 {
      display: none;
    }
  }
</style>
