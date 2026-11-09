<script lang="ts">
  import { page } from '$app/state';
  import { account, classStudents, findClass } from '#lib/account.svelte.ts';
  import CorrectionDialog from '#lib/CorrectionDialog.svelte';
  import { download, historyToCsv } from '#lib/csv.ts';
  import { attendanceToCsv, markText } from '#lib/attendance.ts';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import FilterChips from '#lib/FilterChips.svelte';
  import {
    allRows,
    dateRanges,
    inRange,
    matches,
    minutesOf,
    rowKinds,
    type DateRange,
    type Filter,
    type FilterField,
  } from '#lib/history.ts';
  import Icon from '#lib/Icon.svelte';
  import PassMarks from '#lib/PassMarks.svelte';
  import { dayKey, duration, hasRealDuration, isOverdue, shortDate, time } from '#lib/passes.ts';
  import { displayName } from '#lib/roster.ts';
  import { destinationShares, minutesOut, passesByDay } from '#lib/stats.ts';
  import type { Pass } from '#lib/types.ts';

  /**
   * History: every pass and every denied Request, for looking back. The
   * summary and charts describe whatever the filters show. Filters start fresh
   * on each visit, on the class on the kiosk, or on the student a roster link
   * named.
   */
  function startingFilters(): Filter[] {
    const params = page.url.searchParams;
    const classId = params.get('class') ?? account.activeClass?.id;
    const filters: Filter[] = [];
    if (classId && findClass(classId)) filters.push({ field: 'class', values: [classId] });
    if (params.get('student')) filters.push({ field: 'student', values: [params.get('student')!] });
    return filters;
  }

  let filters = $state(startingFilters());
  let range = $state<DateRange>(page.url.searchParams.get('student') ? 'all' : 'week');
  let from = $state('');
  let to = $state(dayKey(new Date()));
  let sortBy = $state<'when' | 'minutes'>('when');
  let ascending = $state(false);
  let showAll = $state(false);
  let correcting = $state(null as Pass | null);

  const className = (id: string) => findClass(id)?.name ?? 'Deleted class';

  const fields = $derived.by((): FilterField[] => {
    const classFilter = filters.find((filter) => filter.field === 'class')?.values ?? [];
    const classes = account.classes.filter((cls) => !classFilter.length || classFilter.includes(cls.id));
    const several = classes.length > 1;
    return [
      { key: 'class', label: 'Class', options: account.classes.map((cls) => ({ value: cls.id, label: cls.name })) },
      {
        key: 'student',
        label: 'Student',
        options: classes.flatMap((cls) =>
          classStudents(cls)
            .map((student) => ({
              value: student.id,
              label: `${displayName(student)}${several ? ` · ${cls.name}` : ''}${student.status === 'former' ? ' (former)' : ''}`,
            }))
            .sort((a, b) => a.label.localeCompare(b.label)),
        ),
      },
      {
        key: 'destination',
        label: 'Destination',
        options: [...new Set([...account.destinations.map((each) => each.label), ...account.passes.map((pass) => pass.destination)])].map(
          (label) => ({ value: label, label }),
        ),
      },
      { key: 'kind', label: 'Kind', options: rowKinds },
    ];
  });

  const everything = $derived(allRows(account.passes, account.deniedRequests));
  const rows = $derived.by(() => {
    const shown = everything.filter((row) => inRange(row.at, range, from, to) && matches(row, filters));
    const direction = ascending ? 1 : -1;
    return shown.sort((a, b) =>
      sortBy === 'when'
        ? direction * a.at.localeCompare(b.at)
        : direction * (minutesOf(a) - minutesOf(b)) || b.at.localeCompare(a.at),
    );
  });
  const passes = $derived(rows.flatMap((row) => (row.kind === 'pass' ? [row.pass] : [])));
  const days = $derived(passesByDay(passes));
  const shares = $derived(destinationShares(passes));
  const visible = $derived(showAll ? rows : rows.slice(0, 50));

  function sort(by: 'when' | 'minutes') {
    if (sortBy === by) ascending = !ascending;
    else {
      sortBy = by;
      ascending = false;
    }
  }

  function ending(pass: Pass) {
    if (pass.cancelledBy === 'teacher') return { text: 'Cancelled, given back', tone: '' };
    if (!pass.inAt) return { text: 'Still out', tone: 'warn' };
    if (pass.endedBy === 'switch') return { text: 'Class changed', tone: '' };
    if (pass.endedBy === 'removed') return { text: 'Left the roster', tone: '' };
    if (pass.endedBy === 'teacher') return { text: 'Marked back by you', tone: '' };
    return { text: 'Came back', tone: 'ok' };
  }

  /** Attendance for the same dates, class and student filters, newest first. See docs/adr/0020. */
  const attendance = $derived.by(() => {
    const classFilter = filters.find((filter) => filter.field === 'class')?.values ?? [];
    const studentFilter = filters.find((filter) => filter.field === 'student')?.values ?? [];
    return account.attendance
      .filter(
        (mark) =>
          inRange(new Date(`${mark.day}T12:00:00`).toISOString(), range, from, to) &&
          (!classFilter.length || classFilter.includes(mark.classId)) &&
          (!studentFilter.length || studentFilter.includes(mark.studentId)),
      )
      .sort((a, b) => b.day.localeCompare(a.day) || a.studentName.localeCompare(b.studentName));
  });
  const anyAttendance = $derived(!!account.attendanceRules || account.attendance.length > 0);

  function exportAttendance() {
    download(`Happy Hallways attendance ${dayKey(new Date())}.csv`, attendanceToCsv(attendance, className), 'text/csv');
  }

  function exportCsv() {
    download(`Happy Hallways history ${dayKey(new Date())}.csv`, historyToCsv(rows, className), 'text/csv');
  }
</script>

<div class="page wide">
  <header class="page-head">
    <div>
      <p class="eyebrow">History</p>
      <h1>Every pass, in every class</h1>
      <p class="muted">Filter to a class, a student or a destination. Corrections are made here too.</p>
    </div>
    <button class="btn" onclick={exportCsv} disabled={!rows.length}><Icon name="download" size={16} />Download CSV</button>
  </header>

  <div class="filter-bar">
    <select class="range" bind:value={range} aria-label="Dates">
      {#each dateRanges as option (option.value)}<option value={option.value}>{option.label}</option>{/each}
    </select>
    {#if range === 'custom'}
      <label class="date">From <input type="date" bind:value={from} /></label>
      <label class="date">To <input type="date" bind:value={to} /></label>
    {/if}
    <FilterChips {fields} {filters} onchange={(next) => (filters = next)} />
    <span class="count muted small">{rows.length} of {everything.length}</span>
  </div>

  <section class="stats" aria-label="Summary">
    <div class="stat"><strong>{passes.length}</strong><span>Passes</span></div>
    <div class="stat"><strong>{minutesOut(passes)}</strong><span>Minutes out</span></div>
    <div class="stat">
      <strong>{passes.filter((pass) => pass.inAt && isOverdue(pass)).length}</strong><span>Overdue</span>
    </div>
    <div class="stat"><strong>{rows.length - passes.length}</strong><span>Requests denied</span></div>
  </section>

  <div class="grid-2">
    <section class="card">
      <div>
        <p class="eyebrow">Last 7 days</p>
        <h2>Passes by day</h2>
      </div>
      {#if days.some((day) => day.count)}
        <div class="bars" role="img" aria-label="Passes by day: {days.map((day) => `${day.label} ${day.count}`).join(', ')}">
          {#each days as day, index (day.key)}
            <div class:today={index === days.length - 1}>
              <span>{day.count || ''}</span>
              <div class="bar-slot"><span class="bar" style:height="{day.height}%"></span></div>
              <span>{day.label}</span>
            </div>
          {/each}
        </div>
      {:else}
        <div class="empty">No passes in the last week.</div>
      {/if}
    </section>

    <section class="card">
      <div>
        <p class="eyebrow">These passes</p>
        <h2>Where students go</h2>
      </div>
      {#each shares as share (share.label)}
        <div class="share">
          <div class="share-row">
            <span class="destination-chip"><DestinationIcon label={share.label} size={22} />{share.label}</span>
            <span>{share.share}% · {share.count}</span>
          </div>
          <div class="share-track"><span style:width="{share.share}%"></span></div>
        </div>
      {:else}
        <div class="empty">No trips to show.</div>
      {/each}
    </section>
  </div>

  {#if rows.length}
    <div class="history-table">
      <table>
        <thead>
          <tr>
            <th aria-sort={sortBy === 'when' ? (ascending ? 'ascending' : 'descending') : 'none'}>
              <button class="sort" onclick={() => sort('when')}>
                When{#if sortBy === 'when'}<Icon name={ascending ? 'arrow-up' : 'arrow-down'} size={13} />{/if}
              </button>
            </th>
            <th>Student</th>
            <th>Class</th>
            <th>Where</th>
            <th class="num" aria-sort={sortBy === 'minutes' ? (ascending ? 'ascending' : 'descending') : 'none'}>
              <button class="sort" onclick={() => sort('minutes')}>
                Minutes{#if sortBy === 'minutes'}<Icon name={ascending ? 'arrow-up' : 'arrow-down'} size={13} />{/if}
              </button>
            </th>
            <th>What happened</th>
            <th><span class="sr-only">Correct</span></th>
          </tr>
        </thead>
        <tbody>
          {#each visible as row (row.id)}
            <tr class:denied={row.kind === 'denied'}>
              <td>{shortDate(row.at)}, {time(row.at)}</td>
              {#if row.kind === 'pass'}
                {@const pass = row.pass}
                {@const end = ending(pass)}
                <td>
                  <strong>{pass.studentName}</strong>
                  {#if pass.note}<span class="pass-note muted small">{pass.note}</span>{/if}
                </td>
                <td>{className(pass.classId)}</td>
                <td><span class="destination-chip"><DestinationIcon label={pass.destination} size={22} />{pass.destination}</span></td>
                <td class="num">
                  {#if !pass.inAt}
                    …
                  {:else if hasRealDuration(pass)}
                    {#if isOverdue(pass)}<span class="badge warn">Overdue</span>{/if}
                    {duration(pass)}
                  {:else}
                    <span class="muted">unknown</span>
                  {/if}
                </td>
                <td>
                  <span class="badge {end.tone}">{end.text}</span>
                  <PassMarks {pass} />
                  {#if pass.corrected}<span class="badge">Corrected</span>{/if}
                </td>
                <td class="num">
                  <button class="btn btn-small btn-quiet" onclick={() => (correcting = pass)} aria-label="Correct this pass">
                    <Icon name="pencil" size={14} />
                  </button>
                </td>
              {:else}
                <td><strong>{row.request.studentName}</strong></td>
                <td>{className(row.classId)}</td>
                <td><span class="destination-chip"><DestinationIcon label={row.destination} size={22} />{row.destination}</span></td>
                <td class="num muted">–</td>
                <td>
                  <span class="badge danger">Request denied</span>
                  <span class="muted small">
                    {row.request.blocks
                      .map((block) => (block === 'allowance' ? 'out of passes' : block === 'no-pass' ? 'no-pass time' : 'destination full'))
                      .join(', ')}
                  </span>
                </td>
                <td></td>
              {/if}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    {#if rows.length > 50}
      <button class="btn btn-quiet" onclick={() => (showAll = !showAll)}>
        {showAll ? 'Show fewer' : `Show all ${rows.length}`}
      </button>
    {/if}
  {:else}
    <div class="empty card">
      <span class="icon-tile"><Icon name="history" /></span>
      {everything.length ? 'Nothing matches these filters.' : 'Passes will appear here as students take them at the kiosk.'}
    </div>
  {/if}

  {#if anyAttendance}
    <section class="card" aria-labelledby="attendance-history-title">
      <div class="card-head">
        <div>
          <p class="eyebrow">Your own log, not official attendance</p>
          <h2 id="attendance-history-title">Attendance</h2>
          <p class="muted small">For the dates, class and student chosen above. Change today's marks on the class's page.</p>
        </div>
        <button class="btn" onclick={exportAttendance} disabled={!attendance.length}>
          <Icon name="download" size={16} />Download attendance CSV
        </button>
      </div>
      {#if attendance.length}
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Date</th><th>Class</th><th>Student</th><th>Attendance</th><th>Arrived</th></tr>
            </thead>
            <tbody>
              {#each attendance as mark (mark.id)}
                <tr>
                  <td>{shortDate(`${mark.day}T12:00:00`)}</td>
                  <td>{className(mark.classId)}</td>
                  <td>{mark.studentName}</td>
                  <td>{markText(mark)}{#if mark.corrected} <span class="badge">Corrected</span>{/if}</td>
                  <td>{mark.arrivedAt ? time(mark.arrivedAt) : '–'}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="muted small">No attendance for these dates.</p>
      {/if}
    </section>
  {/if}
</div>

{#if correcting}
  <CorrectionDialog
    pass={correcting}
    students={classStudents(findClass(correcting.classId))}
    onClose={() => (correcting = null)}
  />
{/if}

<style>
  .pass-note {
    display: block;
    max-width: 32ch;
    white-space: normal;
  }

  .wide {
    max-width: 1240px;
  }

  .filter-bar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 10px;
  }

  .range {
    width: auto;
    padding: 4px 10px;
    border: 1px solid var(--border-strong);
    border-radius: 999px;
    background: var(--surface);
    font-size: 13px;
    font-weight: 700;
  }

  .date {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
  }

  .date input {
    padding: 3px 8px;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-size: 13px;
  }

  .count {
    margin-left: auto;
  }

  /* Notion-like: hairline grid, quiet headers, rows that light up on hover. */
  .history-table {
    overflow: auto;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .history-table table {
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  }

  .history-table th,
  .history-table td {
    height: 38px;
    padding: 0 12px;
    border-right: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    text-align: left;
    white-space: nowrap;
  }

  .history-table th:last-child,
  .history-table td:last-child {
    border-right: 0;
  }

  .history-table tbody tr:last-child td {
    border-bottom: 0;
  }

  .history-table th {
    background: var(--surface-sunk);
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .history-table .num {
    text-align: right;
  }

  .history-table tbody tr:hover {
    background: var(--bg);
  }

  .history-table tr.denied td:first-child {
    box-shadow: inset 3px 0 0 var(--danger);
  }

  .sort {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0;
    border: 0;
    background: none;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
    text-transform: inherit;
    cursor: pointer;
  }
</style>
