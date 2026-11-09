<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    account,
    isStudentPin,
    removeKiosk,
    setDoorLocked,
    setNetworkBlocked,
    setPin,
    useThisComputer,
  } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import KioskArt from '#lib/KioskArt.svelte';
  import { cancelPairing, kioskOnline, kioskState, refreshLink } from '#lib/link.svelte.ts';
  import PairingDialog from '#lib/PairingDialog.svelte';
  import { time } from '#lib/passes.ts';

  /**
   * The Kiosk: set a teacher PIN, pair the screen by the door, then see whether
   * it's connected. Settings on the left, a picture of the kiosk on the right.
   */
  let newPin = $state('');
  let pinError = $state('');
  let changingPin = $state(false);
  let confirmForget = $state(false);
  let pairing = $state(false);
  let reconnecting = $state(false);

  const kiosk = $derived(account.kiosk);
  const status = $derived(kioskState());
  const setUp = $derived(!!account.pin && !!kiosk);

  function savePin(event: SubmitEvent) {
    event.preventDefault();
    if (!/^\d{4,8}$/.test(newPin)) {
      pinError = 'Use 4 to 8 digits.';
      return;
    }
    // A student's own PIN must never open the teacher menu at the kiosk.
    if (isStudentPin(newPin)) {
      pinError = 'A student has that PIN. Choose a different one.';
      return;
    }
    setPin(newPin);
    newPin = '';
    pinError = '';
    changingPin = false;
  }

  function pair(again = false) {
    reconnecting = again;
    pairing = true;
  }

  function thisComputer() {
    pairing = false;
    cancelPairing();
    useThisComputer();
    refreshLink();
  }

  function openDoor() {
    setDoorLocked(true);
    goto('/door');
  }

  function forget() {
    cancelPairing();
    removeKiosk();
    refreshLink();
    confirmForget = false;
  }
</script>

<svelte:head>
  <title>Kiosk · Happy Hallways</title>
</svelte:head>

{#snippet pinForm()}
  <form class="stack" style="gap:10px" onsubmit={savePin}>
    <div class="pin-row">
      <label class="field">
        PIN (4 to 8 digits)
        <input type="password" inputmode="numeric" autocomplete="off" bind:value={newPin} />
      </label>
      <p class="pin-note" role="note">
        <Icon name="alert-triangle" size={16} />Write it down. It's hard to recover.
      </p>
    </div>
    {#if pinError}<p class="form-error" role="alert">{pinError}</p>{/if}
    <div class="row">
      <button class="btn btn-primary">Save PIN</button>
      {#if changingPin}<button type="button" class="btn btn-quiet" onclick={() => (changingPin = false)}>Cancel</button>{/if}
    </div>
  </form>
{/snippet}

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Kiosk</p>
      <h1>The screen by your door</h1>
      <p class="muted">Students tap their name to take a pass, and again when they're back. Use a spare tablet or Chromebook, or this computer.</p>
    </div>
  </header>

  <div class="device-layout">
    <div class="settings">
      {#if !setUp}
        <ol class="steps card">
          <li class={account.pin ? 'done' : 'now'}>
            <span class="step-num">{#if account.pin}<Icon name="check" size={16} />{:else}1{/if}</span>
            <div class="step-body">
              <h2>Set a teacher PIN</h2>
              {#if !account.pin || changingPin}
                <p class="muted small">
                  You'll type it at the kiosk to let a student go, switch class, or stop using the kiosk. Students
                  shouldn't know it.
                </p>
                {@render pinForm()}
              {:else}
                <p class="muted small">Saved. <button class="link-button" onclick={() => (changingPin = true)}>Change it</button></p>
              {/if}
            </div>
          </li>
          <li class={account.pin ? 'now' : 'later'}>
            <span class="step-num">2</span>
            <div class="step-body">
              <h2>Pair a device</h2>
              {#if account.pin}
                <p class="muted small">
                  A tablet or Chromebook by the door talks straight to this laptop. Or make this computer the kiosk:
                  it locks until you type your PIN, and you won't get overdue reminders while it's the kiosk.
                </p>
                <div class="row">
                  <button class="btn btn-primary" onclick={() => pair()} disabled={account.networkBlocked}>
                    <Icon name="kiosk" size={16} />Pair a device
                  </button>
                  <button class="btn" onclick={thisComputer}><Icon name="monitor" size={16} />Use this computer</button>
                </div>
                {#if account.networkBlocked}
                  <div class="notice-bar" role="status">
                    <Icon name="alert-triangle" />
                    <div class="stack" style="gap:6px">
                      <span>
                        The last pairing attempt showed that this network won't let two devices connect directly, so
                        only this computer can be the kiosk here.
                      </span>
                      <div><button class="btn btn-small" onclick={() => setNetworkBlocked(false)}>Try pairing again</button></div>
                    </div>
                  </div>
                {/if}
              {/if}
            </div>
          </li>
          <li class="later">
            <span class="step-num">3</span>
            <div class="step-body">
              <h2>Check it's connected</h2>
            </div>
          </li>
        </ol>
      {:else if kiosk}
        <section class="card" aria-labelledby="status-title">
          <p class="eyebrow" id="status-title">Status</p>
          <p class="status-line"><span class="status-dot {status.dot}" aria-hidden="true"></span>{status.text}</p>
          {#if kiosk.kind === 'this-computer'}
            <p class="muted small">Open the kiosk screen when class starts. Leaving it needs your PIN.</p>
            <div>
              <button class="btn btn-primary" onclick={openDoor} disabled={!account.activeClass}>
                <Icon name="lock" size={16} />Open kiosk screen
              </button>
            </div>
          {:else if kioskOnline()}
            <p class="muted small">
              The kiosk asks this laptop before anyone leaves. Keep Happy Hallways open and awake here all day, with the
              lid open.
            </p>
          {:else}
            <p class="muted small">
              {kiosk.lastSeenAt ? `Last connected at ${time(kiosk.lastSeenAt)}. ` : ''}Until it reconnects, students can
              only come back in there; those returns arrive when it does. Keep Happy Hallways open and awake on this laptop.
            </p>
            <div><button class="btn btn-primary" onclick={() => pair(true)}>Reconnect</button></div>
          {/if}
        </section>

        <section class="card" aria-labelledby="settings-title">
          <p class="eyebrow" id="settings-title">Settings</p>
          <div class="setting-row">
            <div>
              <h3>Teacher PIN</h3>
              <p class="muted small">To let a student go, switch class, or stop being a kiosk.</p>
            </div>
            {#if !changingPin}<button class="btn" onclick={() => (changingPin = true)}>Change PIN</button>{/if}
          </div>
          {#if changingPin}{@render pinForm()}{/if}
          <div class="setting-row">
            <div>
              <h3>{kiosk.kind === 'device' ? 'A paired device' : 'This computer'}</h3>
              <p class="muted small">You can have one kiosk at a time.</p>
            </div>
            <div class="row">
              {#if kiosk.kind === 'device'}
                <button class="btn" onclick={() => pair()}>Pair a different device</button>
                <button class="btn" onclick={thisComputer}>Use this computer instead</button>
              {:else}
                <button class="btn" onclick={() => pair()}>Pair a device instead</button>
              {/if}
              <button class="btn btn-quiet" onclick={() => (confirmForget = true)}>
                {kiosk.kind === 'device' ? 'Forget this device' : 'Stop using it'}
              </button>
            </div>
          </div>
        </section>
      {/if}
    </div>

    <aside class="picture" aria-label="What the kiosk looks like">
      <KioskArt />
      <ul class="sees">
        <li><Icon name="check" size={16} />Each student's first name and a few letters, to tap</li>
        <li><Icon name="check" size={16} />Where they can go, and who's waiting in line</li>
        <li class="never"><Icon name="x" size={16} />Never full names, history, or anything you've noted</li>
      </ul>
    </aside>
  </div>
</div>

{#if pairing}
  <PairingDialog
    {reconnecting}
    onClose={() => {
      pairing = false;
      reconnecting = false;
    }}
    onUseThisComputer={thisComputer}
  />
{/if}

{#if confirmForget}
  <ConfirmDialog
    title={kiosk?.kind === 'device' ? 'Forget this device?' : 'Stop using this computer as the kiosk?'}
    message={kiosk?.kind === 'device'
      ? "It won't be your kiosk any more. If students came back in there while it was offline, those returns still arrive the next time it connects."
      : 'This computer will no longer be the kiosk.'}
    confirmLabel={kiosk?.kind === 'device' ? 'Forget it' : 'Stop using it'}
    onConfirm={forget}
    onCancel={() => (confirmForget = false)}
  />
{/if}

<style>
  .pin-row {
    display: flex;
    flex-wrap: nowrap;
    align-items: flex-end;
    gap: 10px 16px;
  }

  .pin-row .field {
    flex: none;
    width: 180px;
  }

  /* Beside the box, level with it, in a box of its own. */
  .pin-note {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 9px 12px;
    border-radius: 8px;
    background: var(--warn-wash);
    color: var(--warn);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }

  .pin-note :global(.ui-icon) {
    flex: none;
  }

  /* A phone has no room beside the box. */
  @media (max-width: 560px) {
    .pin-row {
      flex-wrap: wrap;
    }
  }
</style>
