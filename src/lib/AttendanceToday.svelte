<script lang="ts">
  import {
    account,
    attendanceMark,
    classStudents,
    goneForTheDay,
    markAttendance,
    setExcused,
  } from './account.svelte';
  import { markText } from './attendance';
  import { time } from './passes';
  import { displayName } from './roster';
  import type { Class } from './types';

  /**
   * Today's Attendance for one class, for the teacher: who has arrived (and
   * when), who is Tardy or Absent, and a way to mark or correct each one. It is
   * the teacher's own log, not the school's official attendance. See docs/adr/0020.
   */
  let { cls }: { cls: Class } = $props();

  const rows = $derived(
    classStudents(cls)
      .filter((student) => student.status === 'current')
      .map((student) => ({ student, name: displayName(student), mark: attendanceMark(cls.id, student.id) }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  );
  const onNow = $derived(account.activeClass?.id === cls.id);
  const counts = $derived({
    arrived: rows.filter((row) => row.mark?.arrivedAt).length,
    tardy: rows.filter((row) => row.mark?.status === 'tardy').length,
    absent: rows.filter((row) => row.mark?.status === 'absent').length,
  });

  function choose(studentId: string, value: string) {
    if (value === 'gone') goneForTheDay(studentId);
    else markAttendance(cls.id, studentId, value as 'present' | 'tardy' | 'absent' | 'clear');
  }
</script>

<section class="card" aria-labelledby="attendance-title">
  <div class="attendance-head">
    <div>
      <p class="eyebrow">Your own log, not official attendance</p>
      <h2 id="attendance-title">Today's attendance</h2>
      <p class="muted small">
        {counts.arrived} arrived · {counts.tardy} tardy · {counts.absent} absent.
        {#if !onNow}Students tap in at the kiosk while this class is on it.{/if}
      </p>
    </div>
  </div>
  {#if rows.length}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>Today</th>
            <th><span class="sr-only">Mark</span></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row (row.student.id)}
            <tr>
              <td><strong>{row.name}</strong></td>
              <td>
                {#if row.mark}
                  {markText(row.mark)}{#if row.mark.arrivedAt}<span class="muted small"> · {time(row.mark.arrivedAt)}</span>{/if}
                  {#if row.mark.corrected}<span class="badge">Corrected</span>{/if}
                  {#if row.mark.status === 'tardy'}
                    <label class="excuse">
                      <input
                        type="checkbox"
                        checked={!!row.mark.excused}
                        onchange={(event) => setExcused(row.mark!.id, event.currentTarget.checked)}
                      />Excused
                    </label>
                  {/if}
                {:else}
                  <span class="muted">Not yet</span>
                {/if}
              </td>
              <td class="num">
                <select
                  aria-label="Mark {row.name}"
                  value=""
                  onchange={(event) => {
                    choose(row.student.id, event.currentTarget.value);
                    event.currentTarget.value = '';
                  }}
                >
                  <option value="" disabled>Mark…</option>
                  <option value="present">Arrived</option>
                  <option value="tardy">Tardy</option>
                  <option value="absent">Absent</option>
                  <option value="gone">Gone for the day</option>
                  {#if row.mark}<option value="clear">Not yet</option>{/if}
                </select>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <p class="muted small">No students in this class yet.</p>
  {/if}
</section>

<style>
  .attendance-head {
    display: flex;
    justify-content: space-between;
    gap: 12px;
  }

  .excuse {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-left: 8px;
    font-size: 13px;
  }

  select {
    width: auto;
  }
</style>
