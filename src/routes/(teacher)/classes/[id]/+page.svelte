<script lang="ts">
  import { page } from '$app/state';
  import { account, classPasses, classStudents, findClass, removeStudent, restoreStudent } from '#lib/account.svelte.ts';
  import { skipsAllowance, usedBy } from '#lib/allowance.ts';
  import AttendanceToday from '#lib/AttendanceToday.svelte';
  import Icon from '#lib/Icon.svelte';
  import { studentSummaries } from '#lib/stats.ts';

  /**
   * The students in this class, from the Roster, with how often each goes in
   * this class. Names, PINs and settings are edited on the Roster, where each
   * student is once; their passes are in History. See docs/adr/0015.
   */
  const cls = $derived(findClass(page.params.id ?? '')!);
  const allowance = $derived(account.passAllowance);

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

{#if account.attendanceRules}<AttendanceToday {cls} />{/if}

<section class="card table-card">
  {#if rows.length}
    <!-- The card holds only the table, so the column headers sit right at its top. -->
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Student</th>
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
                <a class="student-link" href="/roster?student={row.id}" title="Edit {row.name} on the Roster">
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
              {#if allowance.enabled}
                <td class="num">{skipsAllowance(row.student) ? '–' : `${row.allowanceUsed} of ${allowance.passes}`}</td>
              {/if}
              <td class="num">{row.week}</td>
              <td class="num">{row.minutesWeek}</td>
              <td class="num" style="white-space:nowrap">
                {#if row.former}
                  <button class="btn btn-small btn-quiet" onclick={() => restoreStudent(cls.id, row.id)}>Bring back</button>
                {:else}
                  <a class="btn btn-small btn-quiet" href="/history?class={cls.id}&student={row.id}">Passes</a>
                  <button class="btn btn-small btn-quiet" onclick={() => removeStudent(cls.id, row.id)}>Remove</button>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty">
      <span class="icon-tile"><Icon name="users" /></span>
      No students yet. Use Add students at the top to paste your class list.
    </div>
  {/if}
</section>


<style>


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
