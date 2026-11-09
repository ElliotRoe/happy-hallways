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
  import { cancelPairing, refreshLink } from '#lib/link.svelte.ts';
  import PairingDialog from '#lib/PairingDialog.svelte';

  let newPin = $state('');
  let pinError = $state('');
  let changingPin = $state(false);
  let confirmRemove = $state(false);

  let pairing = $state(false);

  const kiosk = $derived(account.kiosk);

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

  function pair() {
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

  function remove() {
    cancelPairing();
    removeKiosk();
    refreshLink();
    confirmRemove = false;
  }
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Kiosk</p>
      <h1>The screen by your door</h1>
      <p class="muted">
        Students tap their name to sign out and back in. Use a spare tablet or Chromebook, or this computer. You can
        have one kiosk at a time.
      </p>
    </div>
  </header>

  {#if kiosk}
    <div class="notice-bar" role="note">
      <Icon name="alert-triangle" />
      {#if kiosk.kind === 'device'}
        Keep Happy Hallways open and awake on this laptop all day, with the lid open. The kiosk asks this laptop
        before anyone leaves, so while the laptop is closed or asleep, students can only sign back in.
      {:else}
        Keep the kiosk screen open all day. While it's closed, students can't sign out.
      {/if}
    </div>
  {/if}

  {#if !account.pin || changingPin}
    <form class="card" onsubmit={savePin}>
      <div>
        <p class="eyebrow">{account.pin ? 'Change PIN' : 'Step 1'}</p>
        <h2>{account.pin ? 'Choose a new teacher PIN' : 'Choose a teacher PIN'}</h2>
        <p class="muted small">
          You'll need it at the kiosk to let a student go, to switch class, or to stop using the device as a kiosk.
          Students shouldn't know it.
        </p>
      </div>
      <label class="field" style="max-width:220px">
        PIN (4 to 8 digits)
        <input type="password" inputmode="numeric" autocomplete="off" bind:value={newPin} />
      </label>
      {#if pinError}<p class="form-error" role="alert">{pinError}</p>{/if}
      <div class="row">
        <button class="btn btn-primary">Save PIN</button>
        {#if changingPin}<button type="button" class="btn btn-quiet" onclick={() => (changingPin = false)}>Cancel</button>{/if}
      </div>
    </form>
  {:else}
    {#if kiosk}
      <section class="card">
        <div class="card-head">
          <div>
            <p class="eyebrow">Current kiosk</p>
            {#if kiosk.kind === 'this-computer'}
              <h2>This computer</h2>
              <p class="muted small">Open the kiosk screen when class starts. Leaving it needs your PIN.</p>
            {:else}
              <h2>A paired device</h2>
              <p class="muted small">
                This laptop decides who may leave; the kiosk asks it every time. If they lose touch, students can still
                sign back in there, and those returns arrive when it reconnects. Whether it's online right now is on Home.
              </p>
            {/if}
          </div>
          {#if kiosk.kind === 'this-computer'}
            <button class="btn btn-primary" onclick={openDoor} disabled={!account.activeClass}>
              <Icon name="lock" size={16} />Open kiosk screen
            </button>
          {/if}
        </div>

        <div class="row">
          {#if kiosk.kind === 'device'}
            <button class="btn" onclick={pair}>
              <Icon name="kiosk" size={16} />Pair a different device
            </button>
            <button class="btn" onclick={thisComputer}><Icon name="monitor" size={16} />Use this computer instead</button>
          {:else}
            <button class="btn" onclick={pair}>
              <Icon name="kiosk" size={16} />Pair a device instead
            </button>
          {/if}
          <button class="btn btn-quiet" onclick={() => (confirmRemove = true)}>Stop using a kiosk</button>
        </div>
      </section>
    {:else}
      <div class="choice-cards">
        <section class="choice-card" class:disabled={account.networkBlocked}>
          <span class="icon-tile"><Icon name="kiosk" /></span>
          <h2>Pair a device</h2>
          <p class="muted small">
            A tablet or Chromebook by the door. It talks straight to this laptop, so keep this laptop open and awake
            while class is on.
          </p>
          <div><button class="btn btn-primary" onclick={pair}>Pair a device</button></div>
        </section>
        <section class="choice-card">
          <span class="icon-tile"><Icon name="monitor" /></span>
          <h2>Use this computer</h2>
          <p class="muted small">No second device needed. This screen locks into kiosk mode until you enter your PIN.</p>
          <p class="muted small">
            You won't get overdue reminders while this screen is the kiosk. You can still see overdue passes in
            History.
          </p>
          <div><button class="btn" onclick={thisComputer}>Use this computer</button></div>
        </section>
      </div>
    {/if}

    {#if account.networkBlocked}
      <div class="notice-bar" role="status">
        <Icon name="alert-triangle" />
        <div class="stack" style="gap:6px">
          <span>
            The last pairing attempt showed that this network won't let two devices connect directly, so only this
            computer can be the kiosk here.
          </span>
          <div><button class="btn btn-small" onclick={() => setNetworkBlocked(false)}>Try pairing again</button></div>
        </div>
      </div>
    {/if}

    <section class="card">
      <div class="card-head">
        <div>
          <p class="eyebrow">Teacher PIN</p>
          <h2>Set</h2>
          <p class="muted small">Needed at the kiosk to let a student go, switch class, or stop being a kiosk.</p>
        </div>
        <button class="btn" onclick={() => (changingPin = true)}>Change PIN</button>
      </div>
    </section>
  {/if}
</div>

{#if pairing}
  <PairingDialog onClose={() => (pairing = false)} onUseThisComputer={thisComputer} />
{/if}

{#if confirmRemove}
  <ConfirmDialog
    title="Stop using a kiosk?"
    message={kiosk?.kind === 'device'
      ? "The paired device will be disconnected. If students signed back in there while it was offline, those returns will still arrive the next time it connects."
      : 'This computer will no longer be the kiosk.'}
    confirmLabel="Stop using it"
    onConfirm={remove}
    onCancel={() => (confirmRemove = false)}
  />
{/if}
