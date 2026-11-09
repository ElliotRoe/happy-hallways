<script lang="ts">
  import { onMount } from 'svelte';
  import { account } from './account.svelte';
  import Icon from './Icon.svelte';
  import { beginPairing, cancelPairing, kioskOnline, link, reconnectNow } from './link.svelte';
  import Modal from './Modal.svelte';
  import QrCode from './QrCode.svelte';
  import SupportDetails from './SupportDetails.svelte';

  /**
   * Pairing takes over the screen: show the code, follow the device as it
   * connects, then step aside once it has. `onUseThisComputer` is offered when
   * the network turns out to block device-to-device connections.
   * `reconnecting` is the same pairing, for a kiosk that went offline: the
   * same device takes the new code and keeps what it saved meanwhile.
   */
  let {
    onClose,
    onUseThisComputer,
    reconnecting = false,
  }: { onClose: () => void; onUseThisComputer: () => void; reconnecting?: boolean } = $props();

  // A successful pairing replaces the kiosk; remember which one we started with.
  const before = account.kiosk?.kind === 'device' ? account.kiosk.kioskId : '';
  // Reconnecting, the kiosk may also find its way back by itself while the code is up.
  const connected = $derived(
    account.kiosk?.kind === 'device' && (account.kiosk.kioskId !== before || (reconnecting && kioskOnline())),
  );
  // svelte-ignore state_referenced_locally
  if (reconnecting) reconnectNow();

  let clock = $state(Date.now());
  onMount(() => {
    beginPairing();
    const timer = setInterval(() => (clock = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  // Once the device is connected, show it for a moment, then close.
  $effect(() => {
    if (!connected) return;
    const timer = setTimeout(onClose, 1800);
    return () => clearTimeout(timer);
  });

  const pairUrl = $derived(link.pairing ? `${location.origin}/door?code=${link.pairing.code}` : '');
  const secondsLeft = $derived(link.pairing ? Math.max(0, Math.round((link.pairing.expiresAt - clock) / 1000)) : 0);

  function close() {
    if (!connected) cancelPairing();
    onClose();
  }
</script>

<Modal onClose={close} labelledby="pairing-title">
  <div class="pairing-screen">
    <button class="btn btn-quiet close" onclick={close} aria-label="Close"><Icon name="x" size={20} /></button>

    {#if connected}
      <span class="big-tile done"><Icon name="check" size={40} stroke={2.5} /></span>
      <h1 id="pairing-title">Connected!</h1>
      <p class="muted">{reconnecting ? 'The kiosk is connected again.' : 'The device by your door is now your kiosk.'}</p>
    {:else if account.networkBlocked}
      <span class="big-tile warn"><Icon name="alert-triangle" size={36} /></span>
      <h1 id="pairing-title">This network won't let the devices connect</h1>
      <p class="muted">
        The device found the code, but the school network blocked a direct connection. This computer can be the kiosk
        instead.
      </p>
      <div class="row" style="justify-content:center">
        <button class="btn btn-primary" onclick={onUseThisComputer}><Icon name="monitor" size={16} />Use this computer</button>
        <button class="btn" onclick={beginPairing}>Try pairing again</button>
      </div>
      {#if link.problem}<SupportDetails {...link.problem} />{/if}
    {:else if link.pairing?.state === 'failed'}
      <span class="big-tile warn"><Icon name="alert-triangle" size={36} /></span>
      <h1 id="pairing-title">Couldn't get a pairing code</h1>
      <p class="muted">Check this computer's internet connection, then try again.</p>
      <div class="row" style="justify-content:center">
        <button class="btn btn-primary" onclick={beginPairing}>Try again</button>
        <button class="btn" onclick={close}>Cancel</button>
      </div>
      {#if link.problem}<SupportDetails {...link.problem} />{/if}
    {:else}
      {#if reconnecting}
        <p class="eyebrow">Reconnect the kiosk</p>
        <h1 id="pairing-title">On the kiosk, tap Reconnect, then type this code</h1>
        <p class="muted">
          Or scan the QR code with the kiosk's camera. Students who came back in at the kiosk while it was offline are kept. Each code
          works once.
        </p>
      {:else}
        <p class="eyebrow">Pair a device</p>
        <h1 id="pairing-title">On the door device, scan this or type the code</h1>
        <p class="muted">
          Scan with the device's camera, or open <strong>{location.host}/door</strong> on it and type the code. Each code
          works once.
        </p>
      {/if}

      <div class="code-block">
        {#if link.pairing && link.pairing.state !== 'starting'}
          <QrCode text={pairUrl} label="QR code for pairing" />
          <span class="pair-code">{link.pairing.code}</span>
        {:else}
          <div class="qr placeholder" aria-hidden="true"></div>
          <span class="pair-code muted">······</span>
        {/if}
      </div>

      <p class="status" role="status">
        {#if !link.pairing || link.pairing.state === 'starting'}
          Getting a code ready…
        {:else if link.pairing.state === 'connecting'}
          <span class="status-dot live"></span>Device found. Connecting…
        {:else}
          <span class="status-dot"></span>Waiting for the device · expires in
          {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
        {/if}
      </p>
    {/if}
  </div>
</Modal>

<style>
  .pairing-screen {
    position: relative;
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 14px;
    width: min(1000px, 100%);
    height: min(720px, calc(100vh - 32px));
    padding: 40px 24px;
    overflow-y: auto;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 16px;
    box-shadow: 0 16px 48px rgb(42 34 22 / 22%);
    text-align: center;
  }

  .pairing-screen h1 {
    max-width: 22ch;
    font-size: clamp(24px, 3.4vw, 34px);
  }

  .pairing-screen > p {
    max-width: 52ch;
  }

  .close {
    position: absolute;
    top: 14px;
    right: 14px;
  }

  .code-block {
    display: flex;
    align-items: center;
    gap: 32px;
    margin: 12px 0 4px;
  }

  .code-block :global(.qr) {
    width: 220px;
    height: 220px;
  }

  .placeholder {
    background: var(--surface-sunk);
  }

  .code-block .pair-code {
    font-size: clamp(40px, 6vw, 64px);
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-weight: 700;
  }

  .big-tile {
    display: grid;
    place-items: center;
    width: 84px;
    height: 84px;
    border-radius: 50%;
  }

  .big-tile.done {
    background: var(--accent);
    color: #fff;
  }

  .big-tile.warn {
    background: var(--warn-wash);
    color: var(--warn);
  }

  @media (max-width: 640px) {
    .code-block {
      flex-direction: column;
      gap: 16px;
    }
  }
</style>
