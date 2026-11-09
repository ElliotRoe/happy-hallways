<script lang="ts">
  import {
    account,
    classStudents,
    endAllClaims,
    endClaim,
    findClass,
    newRoom,
    setStudentLink,
    setStudentPins,
  } from '#lib/account.svelte.ts';
  import { displayName } from '#lib/roster.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import StudentDeviceArt from '#lib/StudentDeviceArt.svelte';
  import { currentRoom, maxViewers, studentLink } from '#lib/studentLink.svelte.ts';
  import StudentLinkCopy from '#lib/StudentLinkCopy.svelte';

  /**
   * Student devices: students join each class's Room with its code, see how
   * things stand, and, once they've set up their device with their first name
   * and PIN, take a pass and come back from it. The code itself is on Home. See
   * docs/adr/0012, 0016 and 0019.
   */
  const open = $derived(!!account.studentLink?.open);
  const pins = $derived(!!account.studentPins);
  const room = $derived(currentRoom());
  const roomClass = $derived(findClass(room?.classId)?.name ?? '');
  const claims = $derived(
    account.claims
      .map((claim) => {
        const student = account.classes.map((cls) => classStudents(cls).find((each) => each.id === claim.studentId)).find(Boolean);
        return { ...claim, name: student ? displayName(student) : 'A former student' };
      })
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  let confirmNewCode = $state(false);

  /** Devices in the Room: set up (holding a Claim) and Watching. */
  const viewing = $derived(
    studentLink.viewers === 0
      ? 'Nobody is viewing right now'
      : `${studentLink.setUp} set up · ${studentLink.viewers - studentLink.setUp} watching`,
  );
</script>

<svelte:head>
  <title>Student devices · Happy Hallways</title>
</svelte:head>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Student devices</p>
      <h1>Hall passes from their seats</h1>
      <p class="muted">
        Students join each class on their own Chromebook or phone with a code, and take a hall pass from it, then mark themselves back. With
        student devices, you don't need a kiosk at all.
      </p>
    </div>
  </header>

  <div class="device-layout">
    <div class="settings">
      {#if !open}
        <ol class="steps card">
          <li class={pins ? 'done' : 'now'}>
            <span class="step-num">{#if pins}<Icon name="check" size={16} />{:else}1{/if}</span>
            <div class="step-body">
              <h2>Turn on student PINs</h2>
              {#if pins}
                <p class="muted small">On. Print each class's PIN cards from the <a href="/roster">Roster</a>.</p>
              {:else}
                <p class="muted small">
                  A student sets up their device with their first name and PIN, so nobody takes a pass as someone else.
                  Happy Hallways makes the PINs up; you can print them as cards from the Roster.
                </p>
                <div><button class="btn btn-primary" onclick={() => setStudentPins(true)}><Icon name="key" size={16} />Turn on student PINs</button></div>
              {/if}
            </div>
          </li>
          <li class={pins ? 'now' : 'later'}>
            <span class="step-num">2</span>
            <div class="step-body">
              <h2>Turn on student devices</h2>
              <p class="muted small">
                {pins
                  ? 'Each class gets its own code. It works while Happy Hallways is open on this computer.'
                  : 'You can turn them on without PINs, but then students can only see who’s out, not take a pass.'}
              </p>
              <div>
                <button class="btn" class:btn-primary={pins} onclick={() => setStudentLink(true)}>
                  <Icon name="smartphone" size={16} />Turn on student devices
                </button>
              </div>
            </div>
          </li>
          <li class="later">
            <span class="step-num">3</span>
            <div class="step-body">
              <h2>Show students the code</h2>
              <p class="muted small">It's on Home, in Devices, and on the kiosk. Students type it at <strong>/join</strong> or scan it.</p>
            </div>
          </li>
        </ol>
      {:else}
        <section class="card" aria-labelledby="status-title">
          <p class="eyebrow" id="status-title">Status</p>
          <p class="status-line" role="status">
            <span class="status-dot" class:live={studentLink.viewers > 0} aria-hidden="true"></span>
            {studentLink.status === 'connecting' ? 'Connecting…' : viewing}
          </p>
          <p class="muted small">
            {room ? `${roomClass} is open to join, up to ${maxViewers} at once.` : 'A code appears when a class is on.'}
            Keep Happy Hallways open and awake on this computer; while it's closed, students can't reach you.
          </p>
          {#if studentLink.status === 'taken'}
            <p class="muted small">Another Happy Hallways tab on this computer is sharing the link. Keep it open.</p>
          {/if}
          {#if room}
            <StudentLinkCopy />
            <p class="muted small">The code, full screen and pop-out are on <a href="/">Home</a>.</p>
          {/if}
          {#if !pins}
            <div class="notice-bar" role="note">
              <Icon name="alert-triangle" />
              <div class="stack" style="gap:6px">
                <span>Student PINs are off, so students can only watch, not take a pass.</span>
                <div><button class="btn btn-small" onclick={() => setStudentPins(true)}>Turn on student PINs</button></div>
              </div>
            </div>
          {/if}
        </section>

        <section class="card" aria-labelledby="claims-title">
          <div class="card-head">
            <div>
              <h2 id="claims-title">Set-up devices</h2>
              <p class="muted small">
                Each acts as its student until the class ends, or until you, or they, stop it. One device per student.
                {#if studentLink.viewers > studentLink.setUp}{studentLink.viewers - studentLink.setUp} more watching, not set up.{/if}
              </p>
            </div>
            {#if claims.length}
              <button class="btn" onclick={endAllClaims}>Stop all ({claims.length})</button>
            {/if}
          </div>
          {#if claims.length}
            <ul class="claims">
              {#each claims as claim (claim.token)}
                <li>
                  <strong>{claim.name}</strong>
                  <button class="btn btn-small btn-quiet" onclick={() => endClaim(claim.token)}>Stop</button>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty-box muted small">No student has set up a device yet.</p>
          {/if}
        </section>

        <section class="card" aria-labelledby="settings-title">
          <p class="eyebrow" id="settings-title">Settings</p>
          <div class="setting-row">
            <div>
              <h3>Student devices</h3>
              <p class="muted small">On. Turning them off stops every device.</p>
            </div>
            <button class="btn" onclick={() => setStudentLink(false)}><Icon name="lock" size={16} />Turn off student devices</button>
          </div>
          {#if room}
            <div class="setting-row">
              <div>
                <h3>Class code</h3>
                <p class="muted small">New every time the class changes. Get a new one if the code got out.</p>
              </div>
              <button class="btn" onclick={() => (confirmNewCode = true)}><Icon name="history" size={16} />New code</button>
            </div>
          {/if}
          <div class="setting-row">
            <div>
              <h3>Student PINs</h3>
              <p class="muted small">{pins ? 'On.' : 'Off.'} Change them, or print PIN cards, on the Roster.</p>
            </div>
            <a class="btn" href="/roster">Roster</a>
          </div>
        </section>
      {/if}
    </div>

    <aside class="picture" aria-label="What students see">
      <StudentDeviceArt />
      <ul class="sees">
        <li><Icon name="check" size={16} />Whether passes are open, and how many are out or waiting</li>
        <li><Icon name="check" size={16} />On their own device: their passes left, their place in line, their own pass</li>
        <li class="never"><Icon name="x" size={16} />Never another student's name, your PIN, or anything you've noted</li>
      </ul>
    </aside>
  </div>
</div>

{#if confirmNewCode}
  <ConfirmDialog
    title="Get a new code?"
    message="The old code stops working straight away, and every student has to join again with the new one and set up their device again."
    confirmLabel="New code"
    onConfirm={() => {
      newRoom();
      confirmNewCode = false;
    }}
    onCancel={() => (confirmNewCode = false)}
  />
{/if}

<style>
  .claims {
    display: grid;
    gap: 6px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .claims li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .empty-box {
    padding: 14px;
    border: 1.5px dashed var(--border-strong);
    border-radius: var(--radius);
    text-align: center;
  }
</style>
