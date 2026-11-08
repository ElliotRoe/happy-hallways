<script lang="ts">
  import { account, classesOf, dismissRosterMerge, mergeStudents } from '#lib/account.svelte.ts';
  import Icon from '#lib/Icon.svelte';
  import { mergeSuggestions } from '#lib/merge.ts';

  /**
   * The Roster: every student the teacher teaches, each once, with the classes
   * they're in. Full names stay on this computer. See docs/adr/0015 and 0017.
   */
  const suggestions = $derived(mergeSuggestions(account));

  const shownPrefix = (studentId: string) =>
    account.classes.flatMap((cls) => cls.members).find((member) => member.studentId === studentId)?.lastPrefix ?? '';
  const nameOf = (student: { id: string; firstName: string; lastName?: string }) =>
    student.lastName ? `${student.firstName} ${student.lastName}` : `${student.firstName} ${shownPrefix(student.id)}${shownPrefix(student.id) ? '.' : ''}`;

  const rows = $derived(
    account.roster
      .map((student) => ({ student, name: nameOf(student), classes: classesOf(student.id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
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
        Pass Allowance and one history. Full names stay on this computer; the kiosk and the Student link only ever show a
        first name and a few letters.
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

  <section class="card">
    {#if rows.length}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Classes</th>
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
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {:else}
      <p class="muted">No students yet. Add them to a class, and they appear here.</p>
    {/if}
  </section>
</div>

<style>
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
