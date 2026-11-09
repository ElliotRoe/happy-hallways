<script lang="ts">
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { account, classesOf, dismissMerge, dismissRosterMerge, findStudent, mergeStudents, setStudentPins, undoMerge } from '#lib/account.svelte.ts';
  import Modal from '#lib/Modal.svelte';
  import type { MergeSuggestion } from '#lib/merge.ts';
  import { shortDate } from '#lib/passes.ts';
  import EditStudentDialog from '#lib/EditStudentDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import { mergeSuggestions } from '#lib/merge.ts';
  import { minutesOut, startOfWeek } from '#lib/stats.ts';
  import type { Student } from '#lib/types.ts';

  /**
   * The Roster: every student the teacher teaches, each once, with the classes
   * they're in, their PIN and how often they've gone this week across every
   * class. Full names stay on this computer. See docs/adr/0015 and 0017.
   */
  const suggestions = $derived(mergeSuggestions(account));
  /** The pair the teacher is checking before merging, and whose PIN to keep if they differ. */
  let confirming = $state<MergeSuggestion | null>(null);
  let pinFrom = $state('');
  const passCount = (studentId: string) => account.passes.filter((pass) => pass.studentId === studentId).length;
  const fullName = (student: { firstName: string; lastName?: string }) => (student.lastName ? `${student.firstName} ${student.lastName}` : null);
  const recentMerges = $derived([...(account.merges ?? [])].reverse().slice(0, 3));

  function confirmMerge(suggestion: MergeSuggestion) {
    confirming = suggestion;
    pinFrom = suggestion.keep.id;
  }

  function differentStudents() {
    for (const suggestion of suggestions) dismissMerge(suggestion.keep.id, suggestion.drop.id);
    dismissRosterMerge();
  }
  let showPins = $state(false);
  /** A class page links here with ?student=, to edit that student. */
  let editing = $state<Student | null>(findStudent(page.url.searchParams.get('student') ?? undefined) ?? null);

  function closeEditor() {
    editing = null;
    if (page.url.searchParams.has('student')) replaceState('/roster', {});
  }

  const shownPrefix = (studentId: string) =>
    account.classes.flatMap((cls) => cls.members).find((member) => member.studentId === studentId)?.lastPrefix ?? '';
  const nameOf = (student: { id: string; firstName: string; lastName?: string }) =>
    student.lastName ? `${student.firstName} ${student.lastName}` : `${student.firstName} ${shownPrefix(student.id)}${shownPrefix(student.id) ? '.' : ''}`;

  const rows = $derived.by(() => {
    const weekStart = startOfWeek().toISOString();
    const thisWeek = account.passes.filter((pass) => pass.outAt >= weekStart && pass.endedBy !== 'cancelled');
    return account.roster
      .map((student) => {
        const mine = thisWeek.filter((pass) => pass.studentId === student.id);
        return { student, name: nameOf(student), classes: classesOf(student.id), week: mine.length, minutesWeek: minutesOut(mine) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  });
  const totals = $derived({
    week: rows.reduce((sum, row) => sum + row.week, 0),
    minutesWeek: rows.reduce((sum, row) => sum + row.minutesWeek, 0),
  });
</script>

<svelte:head>
  <title>Roster · Happy Hallways</title>
</svelte:head>

<div class="page">
  <header class="page-head">
    <div>
      <p class="eyebrow">Roster</p>
      <h1>Your students</h1>
      <p class="muted">
        Every student you teach, once, whichever classes they're in. A student in two of your classes shares one PIN, one
        Pass Allowance and one history. Full names stay on this computer; the kiosk only ever shows a first name and a few
        letters. That first name can be a nickname, the name students know them by.
      </p>
    </div>
  </header>

  {#if suggestions.length}
    <section class="card" aria-labelledby="merge-title">
      <div>
        <p class="eyebrow">Same student?</p>
        <h2 id="merge-title">These may be the same student in two classes</h2>
        <p class="muted small">
          Before the Roster, a student in two of your classes was kept twice. Merge the ones that are the same child, and
          their passes come together. Leave the others as they are.
        </p>
      </div>
      <ul class="merges">
        {#each suggestions as suggestion (suggestion.keep.id + suggestion.drop.id)}
          <li>
            <span>
              <strong>{nameOf(suggestion.keep)}</strong> in {suggestion.keepClasses.join(', ') || 'no class now'}
              <span class="muted">and</span>
              <strong>{nameOf(suggestion.drop)}</strong> in {suggestion.dropClasses.join(', ') || 'no class now'}
            </span>
            <span class="row">
              <button class="btn btn-small btn-quiet" onclick={() => dismissMerge(suggestion.keep.id, suggestion.drop.id)}>Different students</button>
              <button class="btn btn-small btn-primary" onclick={() => confirmMerge(suggestion)}>
                <Icon name="check" size={14} />Same student…
              </button>
            </span>
          </li>
        {/each}
      </ul>
      {#if !account.rosterMergeSeen}
        <div><button class="btn btn-small" onclick={differentStudents}>The rest are different students</button></div>
      {/if}
    </section>
  {/if}

  {#if recentMerges.length}
    <section class="card" aria-labelledby="merged-title">
      <h2 id="merged-title">Merged students</h2>
      <ul class="merges">
        {#each recentMerges as merge (merge.id)}
          <li>
            <span>
              <strong>{nameOf(merge.drop)}</strong> <span class="muted">into</span> <strong>{nameOf(merge.keep)}</strong>
              <span class="muted small">· {shortDate(merge.at)}</span>
            </span>
            <button class="btn btn-small" onclick={() => undoMerge(merge.id)}><Icon name="history" size={14} />Undo</button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  <section class="card" aria-labelledby="pins-title">
    <div class="option-row">
      <div>
        <h2 id="pins-title">Student PINs</h2>
        <p class="muted small">
          After tapping their name at the kiosk, each student types their own PIN, so nobody takes a pass as someone else. A
          student needs one to use their own device for passes, too. Each student has one PIN for all your
          classes. Happy Hallways makes them up; never use real student ID numbers.
        </p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Students use PINs"
          checked={!!account.studentPins}
          onchange={(event) => setStudentPins(event.currentTarget.checked)}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>
    {#if account.studentPins && rows.length}
      <div class="row">
        <button class="btn btn-small" onclick={() => (showPins = !showPins)}>
          <Icon name="key" size={14} />{showPins ? 'Hide PINs' : 'Show PINs'}
        </button>
        {#each account.classes as cls (cls.id)}
          <a class="btn btn-small btn-quiet" href="/classes/{cls.id}/pins"><Icon name="printer" size={14} />PIN cards: {cls.name}</a>
        {/each}
      </div>
    {/if}
  </section>

  <section class="card table-card">
    {#if rows.length}
      <!-- The card holds only the table, so the column headers sit right at its top. -->
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Classes</th>
              {#if account.studentPins}<th>PIN</th>{/if}
              <th class="num">This week</th>
              <th class="num">Min. this week</th>
              <th><span class="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row (row.student.id)}
              <tr>
                <td>
                  <strong>{row.name}</strong>
                  {#if row.student.alwaysGo}<span class="badge">Can always go</span>{:else if row.student.exempt}<span class="badge">Exempt</span>{/if}
                </td>
                <td>{row.classes.join(', ') || '–'}</td>
                {#if account.studentPins}
                  <!-- Hidden until asked for, so a student glancing at the screen doesn't see a classmate's. -->
                  <td class="pin">{!row.student.pin ? '–' : showPins ? row.student.pin : '••••'}</td>
                {/if}
                <td class="num">{row.week}</td>
                <td class="num">{row.minutesWeek}</td>
                <td class="num">
                  <button class="btn btn-small btn-quiet" aria-label="Edit {row.name}" onclick={() => (editing = row.student)}>
                    <Icon name="pencil" size={14} />
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <td colspan={account.studentPins ? 3 : 2}><strong>All students</strong></td>
              <td class="num"><strong>{totals.week}</strong></td>
              <td class="num"><strong>{totals.minutesWeek}</strong></td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    {:else}
      <p class="muted">No students yet. Add them to a class, and they appear here.</p>
    {/if}
  </section>
</div>

{#if confirming}
  {@const pair = confirming}
  {@const pinsDiffer = !!pair.keep.pin && !!pair.drop.pin && pair.keep.pin !== pair.drop.pin}
  <Modal onClose={() => (confirming = null)} labelledby="confirm-merge-title">
    <div class="dialog" style="width:min(560px,100%)">
      <h2 id="confirm-merge-title">Are these the same student?</h2>
      <p class="muted small">Merging can be undone from this page.</p>
      <div class="pair">
        {#each [{ student: pair.keep, classes: pair.keepClasses }, { student: pair.drop, classes: pair.dropClasses }] as side (side.student.id)}
          <div class="side">
            <strong>{nameOf(side.student)}</strong>
            {#if fullName(side.student)}<span>{fullName(side.student)}</span>{:else}<span class="muted small">Full name not known</span>{/if}
            <span class="muted small">{side.classes.join(', ') || 'No class now'}</span>
            <span class="muted small">PIN {side.student.pin ?? 'none'} · {passCount(side.student.id)} passes</span>
          </div>
        {/each}
      </div>
      {#if pinsDiffer}
        <fieldset class="pin-choice">
          <legend>They have different PINs. Which one should they keep?</legend>
          <label class="check"><input type="radio" bind:group={pinFrom} value={pair.keep.id} />{pair.keep.pin} ({pair.keepClasses.join(', ') || 'no class'})</label>
          <label class="check"><input type="radio" bind:group={pinFrom} value={pair.drop.id} />{pair.drop.pin} ({pair.dropClasses.join(', ') || 'no class'})</label>
        </fieldset>
      {/if}
      {#if pair.keep.alwaysGo || pair.drop.alwaysGo}
        <p class="muted small">The merged student can always go, since one of them could.</p>
      {:else if pair.keep.exempt || pair.drop.exempt}
        <p class="muted small">The merged student is exempt from the Pass Allowance, since one of them was.</p>
      {/if}
      <div class="dialog-actions">
        <button class="btn" onclick={() => (confirming = null)}>Cancel</button>
        <button
          class="btn btn-primary"
          onclick={() => {
            mergeStudents(pair.keep.id, pair.drop.id, pinFrom);
            confirming = null;
          }}>Merge them</button
        >
      </div>
    </div>
  </Modal>
{/if}

{#if editing}
  <EditStudentDialog student={editing} onClose={closeEditor} />
{/if}

<style>


  tfoot td {
    border-top: 1px solid var(--border);
    background: var(--surface-sunk);
  }

  .option-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .pin {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.1em;
  }

  .merges {
    display: grid;
    gap: 10px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .merges li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  .side {
    display: grid;
    gap: 3px;
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
  }

  .pin-choice {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .pin-choice legend {
    margin-bottom: 6px;
    font-size: 14px;
    font-weight: 700;
  }
</style>
