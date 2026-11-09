<script lang="ts">
  import QrCode from './QrCode.svelte';
  import { spacedCode } from './studentLink.svelte';

  /**
   * The Room code students join with: big digits to type, a QR code to scan,
   * and the address to type it at. Shown on the teacher's pages, the kiosk and
   * the pop-out for the board. See docs/adr/0019.
   */
  let { code, size = 'medium' }: { code: string; size?: 'small' | 'medium' | 'large' } = $props();
  const url = $derived(typeof location === 'undefined' ? `/join/${code}` : `${location.origin}/join/${code}`);
  const host = $derived(typeof location === 'undefined' ? '' : `${location.host}/join`);
</script>

<div class="room {size}">
  <div class="qr-box"><QrCode text={url} label="QR code to join this class" /></div>
  <div class="words">
    <span class="label">Join at {host}</span>
    <strong class="code" aria-label="Class code {code}">{spacedCode(code)}</strong>
  </div>
</div>

<style>
  .room {
    display: flex;
    align-items: center;
    gap: 14px;
  }

  .qr-box {
    flex: none;
  }

  /* The shared QR style is a fixed 180px square for pairing; here it fills its box at each size. */
  .qr-box :global(.qr) {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
    padding: 6px;
  }

  .words {
    display: grid;
    gap: 2px;
  }

  .label {
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .code {
    font: 800 28px/1.1 ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.08em;
  }

  .small .qr-box {
    width: 64px;
  }

  .small .code {
    font-size: 22px;
  }

  .medium .qr-box {
    width: 96px;
  }

  .large {
    flex-direction: column;
    gap: 24px;
    text-align: center;
  }

  .large .qr-box {
    width: min(60vw, 340px);
  }

  .large .qr-box :global(.qr) {
    padding: 14px;
  }

  .large .label {
    font-size: 22px;
  }

  .large .code {
    font-size: clamp(56px, 12vw, 110px);
  }
</style>
