<script lang="ts">
  import {
    account,
    classStudents,
    endAllClaims,
    endClaim,
    findClass,
    newRoom,
    setStudentLink,
  } from '#lib/account.svelte.ts';
  import { displayName } from '#lib/roster.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import { popOutRoom } from '#lib/popOut.ts';
  import RoomCode from '#lib/RoomCode.svelte';
  import { currentRoom, maxViewers, studentLink } from '#lib/studentLink.svelte.ts';
  import StudentLinkCopy from '#lib/StudentLinkCopy.svelte';

  /**
   * The Student link: students join each class's Room with its code or QR
   * code, see how things stand, and, once they've set up their device with
   * their PIN, sign out and back in from it. See docs/adr/0012, 0016 and 0019.
   */
  const open = $derived(!!account.studentLink?.open);
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
  const anyPins = $derived(!!account.studentPins);
  let confirmNewLink = $state(false);

  const viewing = $derived(
    studentLink.viewers === 0
      ? 'Nobody is viewing right now'
      : `${studentLink.viewers} ${studentLink.viewers === 1 ? 'student' : 'students'} viewing right now`,
  );
</script>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Student link</p>
      <h1>Let students sign out from their seats</h1>
      <p class="muted">
        Each class gets its own code, new every time the class on the kiosk changes. Students type it at
        <strong>/join</strong> or scan its QR code on their Chromebook or phone, and see whether passes are open and how
        many are out or waiting. A student who sets up their device with their first name and PIN can sign out, come
        back, join a line or ask you from it, until the class ends. With the link, you don't need a kiosk at all.
      </p>
    </div>
  </header>

  <div class="notice-bar" role="note">
    <Icon name="alert-triangle" />
    The link works only while Happy Hallways is open on this computer. If you close it, or this computer sleeps,
    students see that they can't reach you, and nobody can sign out from it.
  </div>

  <section class="card">
    <div class="card-head">
      <div>
        <p class="eyebrow">{open ? 'Open' : 'Closed'}</p>
        <h2>{!open ? 'The student link is closed' : room ? `${roomClass}'s code` : 'Waiting for a class'}</h2>
        <p class="muted small">
          {!open
            ? 'Nobody can join until you open it.'
            : room
              ? 'Show it on the board, or on the kiosk where it already appears. Anyone with the code sees how many students are out or waiting, never who.'
              : 'A code appears when a class is on the kiosk.'}
        </p>
      </div>
      {#if open}
        <button class="btn" onclick={() => setStudentLink(false)}><Icon name="lock" size={16} />Close student link</button>
      {:else}
        <button class="btn btn-primary" onclick={() => setStudentLink(true)}>
          <Icon name="link" size={16} />Open student link
        </button>
      {/if}
    </div>

    {#if room}
      <RoomCode code={room.code} />
      <StudentLinkCopy />
      <div class="row">
        <button class="btn btn-small" onclick={popOutRoom}><Icon name="monitor" size={14} />Pop out for the board</button>
      </div>
      <p class="viewers" role="status">
        <span class="status-dot" class:live={studentLink.viewers > 0} aria-hidden="true"></span>
        {#if studentLink.status === 'connecting'}
          Connecting…
        {:else}
          {viewing}
        {/if}
        <span class="muted small">(up to {maxViewers} at once)</span>
      </p>
      {#if studentLink.status === 'taken'}
        <p class="muted small">Another Happy Hallways tab on this computer is sharing the link. Keep it open.</p>
      {/if}
      <div class="row">
        <button class="btn btn-quiet" onclick={() => (confirmNewLink = true)}>
          <Icon name="history" size={16} />New code
        </button>
      </div>
    {/if}
  </section>

  <section class="card" aria-labelledby="claims-title">
    <div class="card-head">
      <div>
        <p class="eyebrow">Students' devices</p>
        <h2 id="claims-title">Who can sign out from their own device</h2>
        <p class="muted small">
          A student types their first name and PIN after joining. Their device then acts as them until the class ends,
          or until you, or they, stop it. Students set up again in each class. Each student can use one device; setting
          up another stops the first.
          {#if !anyPins}Students need a PIN for this: turn on PINs on the <a href="/roster">Roster</a>. Until then the link only shows how things stand.{/if}
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
      <p class="muted small">No student has set up a device yet.</p>
    {/if}
  </section>

  <section class="card">
    <h2>What students see</h2>
    <ul class="sees">
      <li><Icon name="check" size={16} />The class on the kiosk, and whether passes are open or it's a no-pass time</li>
      <li><Icon name="check" size={16} />How many students are out at each place, and how many are waiting in each line</li>
      <li><Icon name="check" size={16} />On their own set-up device: their passes left, their place in line, and how long their own pass has run</li>
      <li class="never">
        <Icon name="x" size={16} />Never another student's name, how long anyone else has been out, your PIN, or anything you've set for a student
      </li>
    </ul>
  </section>
</div>

{#if confirmNewLink}
  <ConfirmDialog
    title="Get a new code?"
    message="The old code stops working straight away, and every student has to join again with the new one and set up their device again."
    confirmLabel="New code"
    onConfirm={() => {
      newRoom();
      confirmNewLink = false;
    }}
    onCancel={() => (confirmNewLink = false)}
  />
{/if}

<style>
  .viewers {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
  }

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

  .sees {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
    font-size: 14.5px;
  }

  .sees li {
    display: flex;
    align-items: flex-start;
    gap: 10px;
  }

  .sees :global(.ui-icon) {
    margin-top: 3px;
    color: var(--accent);
  }

  .sees .never :global(.ui-icon) {
    color: var(--danger);
  }
</style>
