<script lang="ts">
  import { goto } from '$app/navigation';
  import {
    account,
    activeClassLabel,
    createClass,
    findClass,
    findSchedule,
    liveSchedule,
    markReturned,
    moveWarning,
    noPassNow,
    openPasses,
    removeKiosk,
    passStatus,
    passStatusIcon,
    passStatusText,
    setActiveClass,
    setDoorLocked,
    stopFollowingSchedule,
    useSchedule,
    useThisComputer,
    useWarning,
  } from '#lib/account.svelte.ts';
  import { clock } from '#lib/clock.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import Icon from '#lib/Icon.svelte';
  import MenuSelect from '#lib/MenuSelect.svelte';
  import { cancelPairing, kioskOnline, kioskState, refreshLink } from '#lib/link.svelte.ts';
  import PairingDialog from '#lib/PairingDialog.svelte';
  import PassMarks from '#lib/PassMarks.svelte';
  import QuietScene, { seasons, type Season } from '#lib/QuietScene.svelte';
  import { page } from '$app/state';
  import { currentRoom, studentLink, studentLinkUrl } from '#lib/studentLink.svelte.ts';
  import RoomBoard from '#lib/RoomBoard.svelte';
  import { activeDoorClass, isLimited, line, perform, setup } from '#lib/door.svelte.ts';
  import RoomCode from '#lib/RoomCode.svelte';
  import { popOutRoom } from '#lib/popOut.ts';
  import { duration, hasRealDuration, isOverdue, now, time } from '#lib/passes.ts';
  import { nextClassPeriod, periodAt, toMinutes } from '#lib/schedule.ts';

  /**
   * Home: the one page a teacher keeps open all day. The day and whether
   * students may leave come first; then the class on the kiosk, what's
   * happening in it, and students' Requests down the side. See CONTEXT.md.
   */
  let name = $state('');
  /** `?season=winter` shows that season's scene, to preview it. Otherwise it follows the date. */
  const season = $derived(seasons.find((each) => each === page.url.searchParams.get('season')) as Season | undefined);

  const at = $derived(clock.now);
  const classId = $derived(account.activeClass?.id ?? null);
  const live = $derived(liveSchedule());
  const status = $derived(passStatus(at));
  const noPass = $derived(classId ? noPassNow(classId, at) : null);
  const tone = $derived({ open: 'ok', 'no-pass': 'warn', between: '', 'no-class': '' }[status]);

  /** "22 min", or "1 hr 5 min", until a clock time today. */
  function until(clockTime: string) {
    const nowDate = new Date(at);
    const minutes = Math.max(1, toMinutes(clockTime) - (nowDate.getHours() * 60 + nowDate.getMinutes()));
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} hr${minutes % 60 ? ` ${minutes % 60} min` : ''}`;
  }

  /** The second line: when this changes next, in words. */
  const timing = $derived.by(() => {
    if (!classId && account.activeClass?.onSchedule) {
      const upcoming = nextClassPeriod(live, at);
      const cls = findClass(upcoming?.classId);
      return upcoming && cls ? `${cls.name} starts in ${until(upcoming.start)}` : 'No more classes today';
    }
    if (!classId) return 'Choose a class to put on the kiosk';
    if (noPass) return noPass.end ? `Passes open in ${until(noPass.end)}` : 'Passes stay closed until you open them';
    const period = live ? periodAt(live, at) : null;
    // Off schedule nothing changes by itself, so there's nothing to say; the schedule menu says it's off.
    return period ? `Ends in ${until(period.end)}` : '';
  });

  const out = $derived(classId ? openPasses(classId).sort((a, b) => a.outAt.localeCompare(b.outAt)) : []);
  const waiting = $derived(account.line.filter((spot) => spot.classId === classId));
  /** Each destination has its own line; under a Class Limit there is one Class Line, named by no destination. */
  const lines = $derived(
    account.limitMode === 'class'
      ? [{ destination: null, spots: waiting }].filter((each) => each.spots.length)
      : [...new Set(waiting.map((spot) => spot.destination))].map((destination) => ({
          destination: destination as string | null,
          spots: waiting.filter((spot) => spot.destination === destination),
        })),
  );

  /** "This class" starts when it came on the kiosk, or this morning if that was before today. */
  const since = $derived.by(() => {
    const changed = account.activeClass?.changedAt;
    const midnight = new Date(at);
    midnight.setHours(0, 0, 0, 0);
    return changed && changed > midnight.toISOString() ? changed : midnight.toISOString();
  });
  const thisClass = $derived(
    account.passes.filter((pass) => pass.classId === classId && pass.outAt >= since && pass.endedBy !== 'cancelled'),
  );
  const classOptions = $derived([
    ...(classId ? [] : [{ value: '', label: activeClassLabel(), disabled: true }]),
    ...account.classes.map((cls) => ({ value: cls.id, label: cls.name })),
  ]);
  const scheduleOptions = $derived([
    ...account.schedules.map((schedule) => ({
      value: schedule.id,
      label: schedule.name,
      disabled: !schedule.periods.length,
      hint: schedule.periods.length ? undefined : 'Add a period first',
    })),
    {
      value: '',
      label: account.schedules.length ? 'Off schedule' : 'No schedule',
      hint: 'You choose the class by hand',
    },
  ]);

  type Activity = { id: string; at: string; text: string; pass?: (typeof account.passes)[number]; denied?: boolean };
  /** What has happened in this class so far, newest first. */
  const activity = $derived.by(() => {
    const events: Activity[] = [];
    for (const pass of thisClass) {
      events.push({ id: `${pass.id}-out`, at: pass.outAt, text: `${pass.studentName} left for ${pass.destination}`, pass });
      if (pass.inAt && pass.endedBy === 'student') {
        const minutes = hasRealDuration(pass) ? ` after ${duration(pass)} min` : '';
        events.push({ id: `${pass.id}-in`, at: pass.inAt, text: `${pass.studentName} came back${minutes}` });
      }
      if (pass.inAt && pass.endedBy === 'teacher') {
        events.push({ id: `${pass.id}-in`, at: pass.inAt, text: `You marked ${pass.studentName} back` });
      }
    }
    for (const request of account.deniedRequests) {
      if (request.classId !== classId || request.deniedAt < since) continue;
      events.push({
        id: request.id,
        at: request.deniedAt,
        text: `You said no to ${request.studentName} (${request.destination})`,
        denied: true,
      });
    }
    return events.sort((a, b) => b.at.localeCompare(a.at));
  });

  /** A change that needs the teacher's OK first: taking the kiosk off schedule, or ending passes. */
  let confirming = $state(null as null | { title: string; message: string; label: string; run: () => void });

  function chooseClass(id: string) {
    if (id === classId) return;
    const cls = findClass(id);
    const move = () => setActiveClass({ id, changedAt: now() });
    const warning = moveWarning(id);
    if (!warning) return move();
    confirming = {
      title: live ? `You're on ${live.name}. Switch to ${cls?.name} by hand?` : `Switch the kiosk to ${cls?.name}?`,
      message: warning,
      label: 'Switch class',
      run: move,
    };
  }

  function chooseSchedule(id: string) {
    if (!id) return stopFollowingSchedule();
    const warning = useWarning(id);
    if (!warning) return useSchedule(id);
    confirming = { title: `Use ${findSchedule(id)?.name}?`, message: warning, label: 'Use this schedule', run: () => useSchedule(id) };
  }

  function create(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    goto(`/classes/${createClass(name.trim())}?add`);
  }

  const kiosk = $derived(kioskState());
  let pairing = $state(false);

  /** Reconnecting is pairing again with a code, on the same kiosk. */
  let reconnecting = $state(false);

  function thisComputer() {
    pairing = false;
    cancelPairing();
    useThisComputer();
    refreshLink();
  }

  function disconnect() {
    confirming = {
      title: account.kiosk?.kind === 'device' ? 'Disconnect the kiosk?' : 'Stop using this computer as the kiosk?',
      message:
        account.kiosk?.kind === 'device'
          ? "Students won't be able to take a pass on it. If it's holding passes this computer hasn't received yet, they'll still arrive the next time it connects."
          : "Students won't be able to take a pass until you set up a kiosk again.",
      label: 'Disconnect',
      run: () => {
        cancelPairing();
        removeKiosk();
        refreshLink();
      },
    };
  }

  function openDoor() {
    setDoorLocked(true);
    goto('/door');
  }

  const today = $derived(
    new Intl.DateTimeFormat([], { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(at)),
  );

  /**
   * Managing the Line from here: the teacher's computer keeps it (docs/adr/0014), so adding,
   * removing and clearing go through the same rules as the kiosk's taps.
   */
  const quiet = () => {};
  let lineStudent = $state('');
  let lineDestination = $state('');
  const lineChoices = $derived.by(() => {
    const cls = activeDoorClass();
    const waitingIds = new Set(line().map((spot) => spot.studentId));
    const outIds = new Set(openPasses(cls?.id ?? undefined).map((pass) => pass.studentId));
    return {
      students: (cls?.students ?? []).filter((student) => !waitingIds.has(student.id) && !outIds.has(student.id) && !student.alwaysGo),
      // Only destinations with a limit have a line.
      destinations: (setup()?.destinations ?? []).filter((destination) => isLimited(destination.label)).map((destination) => destination.label),
    };
  });
  $effect(() => {
    if (!lineChoices.destinations.includes(lineDestination)) lineDestination = lineChoices.destinations[0] ?? '';
  });

  function addToLine(event: SubmitEvent) {
    event.preventDefault();
    if (!lineStudent || !lineDestination) return;
    perform({ kind: 'join', studentId: lineStudent, destination: lineDestination }, quiet);
    lineStudent = '';
  }

  function removeFromLine(studentId: string) {
    perform({ kind: 'leave', studentId }, quiet);
  }

  function clearOneLine(spots: { studentId: string }[]) {
    for (const spot of spots) perform({ kind: 'leave', studentId: spot.studentId }, quiet);
  }

  /** The join link with the code already in it, to paste into Google Classroom or a chat. */
  let copied = $state(false);
  async function copyJoinLink() {
    try {
      await navigator.clipboard.writeText(studentLinkUrl());
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Copying needs a secure page in some browsers; the Student devices page shows the link to copy by hand.
    }
  }

  /** The Room code full screen on this computer (say, on the projector), until Escape. It's always here, just hidden. */
  let board = $state<HTMLDivElement | null>(null);
</script>

{#if !account.classes.length}
  <div class="page">
    <header class="page-head">
      <div>
        <p class="eyebrow">Welcome to Happy Hallways</p>
        <h1>Start with your first class</h1>
        <p class="muted">
          Happy Hallways keeps track of who is out of your room, where they went and for how long. Everything stays on this
          computer. There's nothing to sign up for.
        </p>
      </div>
    </header>

    <form class="card" onsubmit={create}>
      <label class="field">
        Class name
        <input bind:value={name} placeholder="Period 1 · Math" />
      </label>
      <div class="row">
        <button class="btn btn-primary" disabled={!name.trim()}><Icon name="plus" size={16} />Create class</button>
      </div>
    </form>

    <p class="muted small">
      Is this the tablet or Chromebook by the door? <a href="/door">Make this device the kiosk</a>.
    </p>
  </div>
{:else}
  <div class="home">
    <div class="home-main">
      <header class="home-head">
        <div class="title-row">
          <h1>{today}</h1>
          <span class="badge status-badge {tone}" role="status"><Icon name={passStatusIcon[status]} size={15} />{passStatusText[status]}</span>
          <span class="schedule-menu">
            <MenuSelect label="Schedule" icon="calendar" value={live?.id ?? ''} options={scheduleOptions} onchoose={chooseSchedule} />
          </span>
        </div>
        <div class="context-row">
          <MenuSelect label="Class on the kiosk" value={classId ?? ''} options={classOptions} onchoose={chooseClass} />
          {#if timing}<span class="timing">{timing}</span>{/if}
        </div>
      </header>

      {#if classId}
        <section class="stats this-class" aria-label="Right now">
          <div class="stat"><strong>{out.length}</strong><span>Out of class now</span></div>
          <div class="stat"><strong>{waiting.length}</strong><span>Waiting in line</span></div>
        </section>

        <section class="card">
          <h2>Right now</h2>
          {#if !out.length && !lines.length}<p class="muted">Everyone's in class.</p>{/if}
          {#if out.length}
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Student</th><th>Where</th><th>Left</th><th class="num">Minutes</th><th></th></tr>
                </thead>
                <tbody>
                  {#each out as pass (pass.id)}
                    <tr>
                      <td><strong>{pass.studentName}</strong> <PassMarks {pass} /></td>
                      <td><span class="destination-chip"><DestinationIcon label={pass.destination} size={24} />{pass.destination}</span></td>
                      <td>{time(pass.outAt)}</td>
                      <td class="num">
                        {#if isOverdue(pass, at)}<span class="badge warn">Overdue</span>{/if}
                        {duration(pass, at)}{pass.minutes ? ` of ${pass.minutes}` : ''}
                      </td>
                      <td class="num">
                        <button class="btn btn-small" onclick={() => markReturned(pass.id)}>
                          <Icon name="check" size={14} />Mark back
                        </button>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
          {#each lines as each (each.destination)}
            <div class="stack" style="gap:8px">
              <div class="line-head">
                <p class="eyebrow">{each.destination ? `In line for ${each.destination}` : 'In line'} ({each.spots.length})</p>
                <button class="btn btn-small btn-quiet" onclick={() => clearOneLine(each.spots)}>Clear</button>
              </div>
              <ol class="line-list">
                {#each each.spots as spot, index (spot.studentId)}
                  <li>
                    <span class="line-position">{index + 1}</span>
                    <strong>{spot.studentName}</strong>
                    <span class="muted small">{each.destination ? '' : `for ${spot.destination}, `}since {time(spot.joinedAt)}</span>
                    <button class="btn btn-small btn-quiet remove" aria-label="Take {spot.studentName} out of the line" onclick={() => removeFromLine(spot.studentId)}>
                      <Icon name="x" size={14} />
                    </button>
                  </li>
                {/each}
              </ol>
            </div>
          {/each}
          {#if account.lineEnabled && lineChoices.students.length && lineChoices.destinations.length}
            <!-- The teacher's computer keeps the Line (docs/adr/0014), so the teacher can add someone here. -->
            <form class="add-to-line" onsubmit={addToLine}>
              <select aria-label="Student to add to a line" bind:value={lineStudent}>
                <option value="" disabled>Add to a line…</option>
                {#each lineChoices.students as student (student.id)}<option value={student.id}>{student.name}</option>{/each}
              </select>
              <select aria-label="Line for" bind:value={lineDestination}>
                {#each lineChoices.destinations as destination (destination)}<option value={destination}>{destination}</option>{/each}
              </select>
              <button class="btn btn-small" disabled={!lineStudent}>Add</button>
            </form>
          {/if}
        </section>

        <section class="this-class-log">
          <div class="log-head">
            <h2>This class</h2>
            <a class="btn btn-quiet btn-small" href="/history">All history<Icon name="arrow-right" size={14} /></a>
          </div>
          {#if activity.length}
            <ol class="activity">
              {#each activity as event (event.id)}
                <li class:denied={event.denied}>
                  <span class="when">{time(event.at)}</span>
                  <span>{event.text}</span>
                  {#if event.pass}<PassMarks pass={event.pass} />{/if}
                </li>
              {/each}
            </ol>
          {:else}
            <p class="muted small">Nothing yet. Passes and your answers to requests show up here as they happen.</p>
          {/if}
        </section>
      {:else}
        <QuietScene {season} message={account.activeClass?.onSchedule ? `No class right now. ${timing}.` : 'No class is on the kiosk. Choose one above.'} />
      {/if}
    </div>

    <div class="side">
    <!-- Requests and No passes live in the drawer in the bottom-right corner, on every page. -->
    <section class="devices-card" aria-labelledby="devices-title">
      <h2 id="devices-title" class="devices-title">Devices</h2>

      <div class="device" aria-labelledby="kiosk-title">
        <div class="panel-head">
          <h3 id="kiosk-title">
            <Icon name="kiosk" size={18} />Kiosk
            <a class="device-gear" href="/kiosk" aria-label="Kiosk settings" title="Kiosk settings"><Icon name="settings" size={15} /></a>
          </h3>
          <span class="kiosk-state"><span class="status-dot {kiosk.dot}" aria-hidden="true"></span>{kiosk.text.replace(/^Kiosk (\w)/, (_, first) => first.toUpperCase())}</span>
        </div>
        {#if !account.kiosk}
          <p class="muted small">Students take a pass on a tablet or Chromebook by the door, or on this computer.</p>
          {#if account.pin}
            <div class="kiosk-actions">
              <button class="btn btn-small btn-primary" onclick={() => (pairing = true)}>Pair a device</button>
              <button class="btn btn-small" onclick={thisComputer}>Use this computer</button>
            </div>
          {:else}
            <a class="btn btn-small" href="/kiosk">Set up the kiosk</a>
          {/if}
        {:else if account.kiosk.kind === 'this-computer'}
          <div class="kiosk-actions">
            <button class="btn btn-small btn-primary" onclick={openDoor} disabled={!account.activeClass}>
              <Icon name="lock" size={14} />Open kiosk screen
            </button>
            <button class="btn btn-small" onclick={() => (pairing = true)}>Pair a device instead</button>
            <button class="btn btn-small btn-quiet" onclick={disconnect}>Stop using it</button>
          </div>
        {:else if kioskOnline()}
          <div class="kiosk-actions">
            <button class="btn btn-small btn-quiet" onclick={disconnect}>Disconnect</button>
          </div>
        {:else}
          <p class="muted small">
            {account.kiosk.lastSeenAt ? `Last connected at ${time(account.kiosk.lastSeenAt)}. ` : ''}Until it reconnects,
            students can only come back in there.
          </p>
          <div class="kiosk-actions">
            <button
              class="btn btn-small btn-primary"
              onclick={() => {
                reconnecting = true;
                pairing = true;
              }}>Reconnect</button
            >
            <button class="btn btn-small btn-quiet" onclick={disconnect}>Disconnect</button>
          </div>
        {/if}
      </div>

      <div class="device" aria-labelledby="student-link-title">
        <div class="panel-head">
          <h3 id="student-link-title">
            <Icon name="smartphone" size={18} />Student devices
            <a class="device-gear" href="/student-link" aria-label="Student devices settings" title="Student devices settings"><Icon name="settings" size={15} /></a>
          </h3>
          {#if account.studentLink?.open}
            <span class="kiosk-state">
              <span class="status-dot" class:live={studentLink.viewers > 0} aria-hidden="true"></span>{studentLink.setUp} set up · {studentLink.viewers - studentLink.setUp} watching
            </span>
          {/if}
        </div>
        {#if account.studentLink?.open && currentRoom()}
          <RoomCode code={currentRoom()!.code} size="small" />
          <div class="kiosk-actions">
            <!-- Just an icon, so the three buttons fit on one line. -->
            <button
              class="btn btn-small icon-only"
              onclick={copyJoinLink}
              aria-label={copied ? 'Copied' : 'Copy link'}
              title={copied ? 'Copied' : 'Copy the join link'}><Icon name={copied ? 'check' : 'copy'} size={14} /></button
            >
            <button class="btn btn-small" onclick={() => board?.requestFullscreen?.()}><Icon name="maximize" size={14} />Full screen</button>
            <button class="btn btn-small" onclick={popOutRoom}><Icon name="pop-out" size={14} />Pop out</button>
          </div>
        {:else if account.studentLink?.open}
          <p class="muted small">A code for students to join appears when a class is on.</p>
        {:else}
          <p class="muted small">Students can join each class from their own Chromebook or phone with a code.</p>
          <div class="kiosk-actions"><a class="btn btn-small" href="/student-link">Turn on student devices</a></div>
        {/if}
      </div>
    </section>
    </div>
  </div>
{/if}

<div class="board-holder" bind:this={board}><RoomBoard /></div>

{#if pairing}
  <PairingDialog
    {reconnecting}
    onClose={() => {
      pairing = false;
      reconnecting = false;
    }}
    onUseThisComputer={thisComputer}
  />
{/if}

{#if confirming}
  {@const change = confirming}
  <ConfirmDialog
    title={change.title}
    message={change.message}
    confirmLabel={change.label}
    onConfirm={() => {
      change.run();
      confirming = null;
    }}
    onCancel={() => (confirming = null)}
  />
{/if}

<style>
  .icon-only {
    padding-inline: 8px;
  }

  .line-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .line-list .remove {
    margin-left: auto;
  }

  .add-to-line {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .add-to-line select {
    width: auto;
  }

  /* Only shown while it's full screen. */
  .board-holder:not(:fullscreen) {
    display: none;
  }

  /*
   * Home fits the window: the side column fills it top to bottom, and the
   * footer sits at the foot of the middle column, so nothing scrolls until the
   * middle column outgrows the window.
   */
  .home {
    --fit: calc(100vh - 40px - 24px);
    flex: 1;
    display: grid;
    margin-bottom: 24px;
    grid-template-columns: minmax(0, 1fr) 380px;
    align-items: start;
    gap: 24px;
    max-width: 1320px;
  }

  .home-main {
    display: flex;
    flex-direction: column;
    gap: 22px;
    min-height: var(--fit);
  }

  .home-head {
    display: grid;
    gap: 8px;
  }

  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 14px;
  }

  .title-row h1 {
    font-size: 30px;
  }

  .status-badge {
    padding: 3px 12px;
    font-size: 13.5px;
  }


  .schedule-menu {
    margin-left: auto;
    color: var(--muted);
    font-size: 15px;
  }

  .context-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    margin-left: -8px;
    font-size: 17px;
  }

  .timing {
    color: var(--muted);
    font-weight: 600;
  }

  .this-class {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .this-class-log {
    display: grid;
    gap: 6px;
  }

  .log-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .activity {
    display: grid;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .activity li {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 12px;
    padding: 9px 0;
    border-top: 1px solid var(--border);
    font-size: 14.5px;
  }

  .activity li:first-child {
    border-top: 0;
  }

  .activity .when {
    width: 72px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  .activity li.denied {
    color: var(--danger);
  }

  /* The live column: what the teacher can do right now, then what students are asking. */
  .side {
    position: sticky;
    top: 40px;
    display: grid;
    align-content: start;
    gap: 12px;
    height: var(--fit);
  }

  .devices-card {
    display: grid;
    align-content: start;
    gap: 14px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
  }

  .devices-title {
    color: var(--faint);
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .device {
    display: grid;
    gap: 10px;
  }

  .device + .device {
    padding-top: 14px;
    border-top: 1px solid var(--border);
  }

  .panel-head h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 16px;
    white-space: nowrap;
  }

  .kiosk-state {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    white-space: nowrap;
    color: var(--muted);
    font-size: 13px;
    font-weight: 700;
  }

  /* Opens the device's own page. */
  .device-gear {
    display: inline-grid;
    place-items: center;
    width: 26px;
    height: 26px;
    margin-left: -2px;
    border-radius: 6px;
    color: var(--faint);
  }

  .device-gear:hover,
  .device-gear:focus-visible {
    background: var(--surface-sunk);
    color: var(--text);
  }

  .kiosk-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .panel-head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 4px 12px;
  }

  @media (max-width: 1100px) {
    .home {
      grid-template-columns: 1fr;
    }

    .side {
      position: static;
      height: auto;
      grid-row: 2;
    }
  }
</style>
