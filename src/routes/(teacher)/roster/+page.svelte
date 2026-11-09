<script lang="ts">
  import { page } from '$app/state';
  import { replaceState } from '$app/navigation';
  import { account, classesOf, dismissRosterMerge, findStudent, mergeStudents, setStudentPins } from '#lib/account.svelte.ts';
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
            <button class="btn btn-small btn-primary" onclick={() => mergeStudents(suggestion.keep.id, suggestion.drop.id)}>
              <Icon name="check" size={14} />Same student
            </button>
          </li>
        {/each}
      </ul>
      {#if !account.rosterMergeSeen}
        <div><button class="btn btn-small" onclick={dismissRosterMerge}>The rest are different students</button></div>
      {/if}
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

  <section class="card">
    {#if rows.length}
      <!-- The card holds only the table, so the column headers sit right at its top. -->
      <div class="table-wrap flush">
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

{#if editing}
  <EditStudentDialog student={editing} onClose={closeEditor} />
{/if}

<style>
  .table-wrap.flush {
    margin-top: -20px;
    border-radius: var(--radius) var(--radius) 0 0;
  }

  /* The card's own border is the top edge here, so the headers don't draw a second one. */
  .table-wrap.flush :global(th) {
    border-top: 0;
  }

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
</style>
