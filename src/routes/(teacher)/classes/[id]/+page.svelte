<script lang="ts">
  import { page } from '$app/state';
  import { account, classPasses, classStudents, findClass, removeStudent, restoreStudent } from '#lib/account.svelte.ts';
  import { skipsAllowance, usedBy } from '#lib/allowance.ts';
  import EditStudentDialog from '#lib/EditStudentDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import { studentSummaries } from '#lib/stats.ts';
  import type { ClassStudent } from '#lib/types.ts';

  /**
   * A class is its roster. How often each student goes is shown for a glance;
   * their passes are in History, one click away.
   */
  const cls = $derived(findClass(page.params.id ?? '')!);
  const allowance = $derived(account.passAllowance);
  let editing = $state(null as ClassStudent | null);
  let showPins = $state(false);

  const rows = $derived.by(() => {
    const passes = classPasses(cls.id);
    const students = classStudents(cls);
    return studentSummaries(cls, students, passes)
      .map((summary) => ({
        ...summary,
        student: students.find((student) => student.id === summary.id)!,
        // The Pass Allowance counts passes from every class the student has with you.
        allowanceUsed: usedBy(allowance, summary.id, account.passes),
      }))
      .sort((a, b) => Number(a.former) - Number(b.former) || a.name.localeCompare(b.name));
  });
</script>

<section class="card" data-tip="tip-roster">
  <div class="roster-head">
    <div>
      <p class="eyebrow">Roster</p>
      <h2>Students</h2>
    </div>
    {#if cls.studentPins && rows.length}
      <div class="row">
        <button class="btn btn-small" onclick={() => (showPins = !showPins)}>
          <Icon name="key" size={14} />{showPins ? 'Hide PINs' : 'Show PINs'}
        </button>
        <a class="btn btn-small" href="/classes/{cls.id}/pins"><Icon name="printer" size={14} />Print PIN cards</a>
      </div>
    {/if}
  </div>
  {#if rows.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            {#if cls.studentPins}<th>PIN</th>{/if}
            {#if allowance.enabled}<th class="num">Passes used</th>{/if}
            <th class="num">This week</th>
            <th class="num">Min. this week</th>
            <th><span class="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.id)}
            <tr>
              <td>
                <a class="student-link" href="/history?class={cls.id}&student={row.id}" title="See {row.name}'s passes in History">
                  <strong>{row.name}</strong>
                </a>
                <!-- The full name stays on this computer; the kiosk and the Student link show only the name above. -->
                {#if row.student.lastName}<span class="muted small">{row.student.firstName} {row.student.lastName}</span>{/if}
                {#if row.former}<span class="badge">Former</span>{/if}
                {#if row.student.alwaysGo}
                  <span class="badge" title="Never held back by the Pass Allowance, a limit, the line or no-pass time">Can always go</span>
                {:else if row.student.exempt}
                  <span class="badge" title="Exempt from the Pass Allowance, but waits for limits and no-pass time">Exempt</span>
                {/if}
                {#if allowance.enabled && !skipsAllowance(row.student) && !row.former && row.allowanceUsed >= allowance.passes}
                  <span class="badge warn">Out of passes</span>
                {/if}
              </td>
              {#if cls.studentPins}
                <!-- Hidden until asked for, so a student glancing at the screen doesn't see a classmate's. -->
                <td class="pin">{row.former || !row.student.pin ? '–' : showPins ? row.student.pin : '••••'}</td>
              {/if}
              {#if allowance.enabled}
                <td class="num">{skipsAllowance(row.student) ? '–' : `${row.allowanceUsed} of ${allowance.passes}`}</td>
              {/if}
              <td class="num">{row.week}</td>
              <td class="num">{row.minutesWeek}</td>
              <td class="num" style="white-space:nowrap">
                {#if row.former}
                  <button class="btn btn-small btn-quiet" onclick={() => restoreStudent(cls.id, row.id)}>Bring back</button>
                {:else}
                  <button class="btn btn-small btn-quiet" aria-label="Edit {row.name}" onclick={() => (editing = row.student)}>
                    <Icon name="pencil" size={14} />
                  </button>
                  <button class="btn btn-small btn-quiet" onclick={() => removeStudent(cls.id, row.id)}>Remove</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="muted small">Click a student to see their passes in History. Removed students keep their history.</p>
  {:else}
    <div class="empty">
      <span class="icon-tile"><Icon name="users" /></span>
      No students yet. Use Add students at the top to paste your class list.
    </div>
  {/if}
</section>

{#if editing}
  <EditStudentDialog {cls} student={editing} onClose={() => (editing = null)} />
{/if}

<style>
  .roster-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
  }

  .pin {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.1em;
  }

  .student-link {
    color: inherit;
    text-decoration: none;
  }

  .student-link:hover strong {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
