<script lang="ts">
  import {
    account,
    classStudents,
    endAllClaims,
    endClaim,
    setClaimsEndWithClass,
    setStudentLink,
  } from '#lib/account.svelte.ts';
  import { displayName } from '#lib/roster.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import { maxViewers, studentLink } from '#lib/studentLink.svelte.ts';
  import StudentLinkCopy from '#lib/StudentLinkCopy.svelte';

  /**
   * The Student link: students watch the line from their own device, and a
   * student who Claims it with their PIN can sign out and back in from it.
   * See docs/adr/0012 and 0016.
   */
  const open = $derived(!!account.studentLink?.open);
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
        Post a link in Google Classroom. On their own Chromebook or phone, students see who's out, who's waiting in line,
        and whether passes are open. A student who sets up their device with their PIN, once, can then sign out, come
        back, join a line or ask you from it, during their class. With the link, you don't need a kiosk at all.
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
        <h2>{open ? 'Students can view the line' : 'The student link is closed'}</h2>
        <p class="muted small">
          {open
            ? 'Anyone with the link can see whether passes are open and how many students are out or waiting, never who.'
            : 'Nobody can view the line until you open it.'}
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

    {#if open}
      <StudentLinkCopy />
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
          <Icon name="history" size={16} />Get a new link
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
          A student types their first name and PIN on the link, once. Their device then acts as them until you, or they,
          stop it. Each student can use one device; setting up another stops the first.
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
    <label class="check">
      <input
        type="checkbox"
        checked={!!account.claimsEndWithClass}
        onchange={(event) => setClaimsEndWithClass(event.currentTarget.checked)}
      />
      <span>
        Students share devices (like a Chromebook cart)
        <span class="muted small">Every device stops acting as its student when the class on the kiosk changes.</span>
      </span>
    </label>
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
    title="Get a new student link?"
    message="The old link stops working straight away. Post the new one wherever students found the old one."
    confirmLabel="Get a new link"
    onConfirm={() => {
      setStudentLink(true, true);
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
