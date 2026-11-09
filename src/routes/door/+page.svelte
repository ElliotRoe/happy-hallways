<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page, updated } from '$app/state';
  import { onMount } from 'svelte';
  import { keepAttendance, setDoorLocked } from '#lib/account.svelte.ts';
  import {
    absentCount,
    activeDoorClass,
    allowanceFor,
    arriveLateAs,
    askTeacher,
    canAsk,
    cancelRequest,
    changeClass,
    checkPin,
    checkStudentPin,
    clearLine,
    connectToLaptop,
    dismissNotice,
    door,
    doorSchedule,
    followSchedule,
    forgetDevice,
    hasClassLimit,
    isFull,
    isLocal,
    joinLine,
    leaveLine,
    line,
    lateArrivalNeedsPin,
    lineSpotFor,
    needsArrival,
    needsPin,
    shownTo,
    showsLineNames,
    showsWhere,
    noPassNow,
    onSchedule,
    openPassFor,
    outCount,
    pairWithCode,
    reconnectNow,
    requestFor,
    requestPass,
    settleRequests,
    setup,
    signBackIn,
    tapToArrive,
    undoPass,
    upNext,
    waitingCount,
    whenPassesOpen,
  } from '#lib/door.svelte.ts';
  import BrandMark from '#lib/BrandMark.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import Icon from '#lib/Icon.svelte';
  import { askBeforeLeaving, leaveTo } from '#lib/leaving.ts';
  import Modal from '#lib/Modal.svelte';
  import RoomCode from '#lib/RoomCode.svelte';
  import StudentPinPad from '#lib/StudentPinPad.svelte';
  import SupportDetails from '#lib/SupportDetails.svelte';
  import { serveStudentLink } from '#lib/studentLink.svelte.ts';
  import { keepAwake } from '#lib/wakeLock.ts';
  import { yourTurnSound } from '#lib/sound.ts';
  import { formatClock, nextClassPeriod } from '#lib/schedule.ts';

  const local = $derived(isLocal());
  const paired = $derived(!!door.device);
  const cls = $derived(activeDoorClass());
  const destinations = $derived(setup()?.destinations ?? []);
  // Periods and No-Pass Times start and end on their own, so look at the clock regularly.
  let clock = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (clock = Date.now()), 15_000);
    return () => clearInterval(timer);
  });
  // On Schedule, the teacher's computer changes class as each period starts; on a paired kiosk, it does that itself.
  $effect(() => {
    void clock;
    if (local) followSchedule();
  });
  // A Request ends by itself once nothing stops the student any more.
  $effect(() => {
    void clock;
    if (local) {
      settleRequests();
      keepAttendance();
    }
  });
  /** For a minute after the teacher says no, the student's name says so. */
  const deniedRecently = (studentId: string) => clock - (door.denied[studentId] ?? 0) < 60_000;
  const following = $derived(onSchedule());
  /** Between periods: the next class the schedule puts on today. */
  const next = $derived.by(() => {
    const period = nextClassPeriod(doorSchedule(), clock);
    const name = setup()?.classes.find((each) => each.id === period?.classId)?.name;
    return period && name ? { name, start: period.start } : null;
  });
  /** Moving the class by hand from the teacher menu takes the kiosk off schedule, so it asks first. */
  let switching = $state<string | null>(null);

  const waiting = $derived(line());
  /**
   * Each destination's line, in the order the destinations are listed, or,
   * under a Class Limit, the one Class Line (with no destination of its own).
   */
  const lines = $derived(
    // When the class hides where students went, every line shows as one, so a name never sits beside a place (docs/adr/0022).
    hasClassLimit() || !showsWhere()
      ? [{ destination: null, spots: waiting }].filter((each) => each.spots.length)
      : destinations
          .map((destination) => ({ destination: destination.label as string | null, spots: line(destination.label) }))
          .filter((each) => each.spots.length),
  );
  const ready = $derived(upNext(clock));
  const isUpNext = (studentId: string) => ready.some((spot) => spot.studentId === studentId);
  // A short "your turn" sound when someone in line becomes Up Next. Never anything about time (docs/adr/0003).
  let upNextBefore = new Set<string>();
  $effect(() => {
    const now = new Set(ready.map((spot) => spot.studentId));
    if ([...now].some((id) => !upNextBefore.has(id))) yourTurnSound();
    upNextBefore = now;
  });
  const blocked = $derived(noPassNow(clock));

  let code = $state(page.url.searchParams.get('code') ?? '');
  let choosingFor = $state(null as { id: string; name: string } | null);
  /** A student in the Line who tapped their name before it was their turn. */
  let waitingFor = $state(null as { id: string; name: string } | null);
  /** A student waiting for the teacher to answer their Request, who tapped their name again. */
  let askedFor = $state(null as { id: string; name: string } | null);
  /** The teacher menu: closed, asking for the PIN, or open. */
  let teacher = $state('closed' as 'closed' | 'pin' | 'menu');
  /** Set while the PIN is asked for to let a student go past whatever is stopping them. */
  let lettingGo = $state(null as { studentId: string; destination: string } | null);
  let pin = $state('');
  let pinError = $state('');
  let confirmForget = $state(false);
  /**
   * "Reconnect" on a kiosk that's offline: the same code screen a new device
   * sees. The teacher shows a code on their laptop; this device keeps
   * the returns it saved while offline. If it finds the laptop by itself meanwhile, the
   * screen steps aside.
   */
  let reconnecting = $state(false);
  let reconnectingFrom = '';
  function reconnect() {
    reconnectNow();
    code = '';
    reconnectingFrom = door.device?.kioskId ?? '';
    reconnecting = true;
  }
  $effect(() => {
    if (reconnecting && (door.status === 'live' || door.device?.kioskId !== reconnectingFrom)) reconnecting = false;
  });

  // The door screen is up all day: keep this device's screen from sleeping while it's open.
  onMount(() => {
    keepAwake(true);
    return () => keepAwake(false);
  });

  onMount(() => {
    // Opening the door screen locks it (on the laptop) or connects it (on a paired device).
    // On the teacher's own computer, it also keeps answering the Student link.
    if (local) {
      setDoorLocked(true);
      serveStudentLink();
    } else if (paired) connectToLaptop();
    // Arriving from the QR code: pair straight away, then drop the code from the
    // address so a later reload never retries a code that has been used up.
    if (page.url.searchParams.has('code')) replaceState('/door', {});
    else return;
    // A kiosk that's already paired can scan a new code too: that reconnects it.
    if (!local && /^\d{6}$/.test(code)) pairWithCode(code);
  });

  // After an update, the kiosk refreshes itself once nobody has touched it for
  // a minute, so it never stays on an older version than the laptop and no
  // student sees the screen blink. Unsent passes are saved on this device and
  // survive the refresh.
  let lastTouch = $state(Date.now());
  $effect(() => {
    const idle = !door.notice && !pinFor && !choosingFor && !waitingFor && !askedFor && teacher === 'closed';
    if (updated.current && idle && clock - lastTouch >= 60_000) leaveTo(location.href);
  });

  /** Puts the cursor in a field as soon as it appears, so the teacher can just type. */
  function focusOnShow(input: HTMLInputElement) {
    input.focus();
  }

  function submitCode(event: SubmitEvent) {
    event.preventDefault();
    if (/^\d{6}$/.test(code)) pairWithCode(code);
  }

  /** A student who tapped their name in a class that asks for PINs, typing theirs. */
  let pinFor = $state(null as { id: string; name: string } | null);

  /**
   * "Just arrived?": a student already marked Absent isn't on the door, so they
   * type their first name (and PIN) instead. The kiosk never lists who is
   * Absent. See docs/adr/0020.
   */
  let lateArrival = $state<{ firstName: string; pin: string } | null>(null);
  function sendLateArrival(event: SubmitEvent) {
    event.preventDefault();
    if (!lateArrival?.firstName.trim()) return;
    arriveLateAs(lateArrival.firstName.trim(), lateArrivalNeedsPin() ? lateArrival.pin : undefined);
    lateArrival = null;
  }

  function tap(student: { id: string; name: string }) {
    if (needsPin(student.id)) pinFor = student;
    else actFor(student);
  }

  function pinTyped() {
    const student = pinFor;
    pinFor = null;
    if (student) actFor(student);
  }

  /** Whatever tapping their name means right now: arriving, coming back, going, or checking on their line or Request. */
  function actFor(student: { id: string; name: string }) {
    if (needsArrival(student.id)) {
      tapToArrive(student.id);
      return;
    }
    if (openPassFor(student.id)) {
      signBackIn(student.id);
      return;
    }
    if (requestFor(student.id)) {
      askedFor = student;
      return;
    }
    const spot = lineSpotFor(student.id);
    if (!spot) choosingFor = student;
    // Their turn: go straight to where they lined up for.
    else if (isUpNext(student.id)) requestPass(student.id, spot.destination);
    else waitingFor = student;
  }

  function ordinal(position: number) {
    return position === 1 ? '1st' : position === 2 ? '2nd' : position === 3 ? '3rd' : `${position}th`;
  }

  function choose(destination: string) {
    if (!choosingFor) return;
    requestPass(choosingFor.id, destination);
    choosingFor = null;
  }

  function openTeacher() {
    lettingGo = null;
    switching = null;
    teacher = 'pin';
    pin = '';
    pinError = '';
    confirmForget = false;
  }

  function submitPin(event: SubmitEvent) {
    event.preventDefault();
    if (checkPin(pin) && lettingGo) {
      requestPass(lettingGo.studentId, lettingGo.destination, 'pin');
      lettingGo = null;
      teacher = 'closed';
    } else if (checkPin(pin)) {
      teacher = 'menu';
    } else {
      pinError = "That PIN isn't right.";
      pin = '';
    }
  }

  /** "Teacher: let them go", wherever a rule has stopped a student: the teacher types their PIN and lets them go right here. */
  function askToLetGo(offer: { studentId: string; destination: string }) {
    dismissNotice();
    openTeacher();
    lettingGo = offer;
  }

  /** "Ask my teacher", wherever a rule has stopped a student: the teacher answers on Home. */
  function ask(offer: { studentId: string; destination: string }) {
    dismissNotice();
    askTeacher(offer.studentId, offer.destination);
  }

  function switchTo(classId: string) {
    if (following && switching !== classId) {
      switching = classId;
      return;
    }
    switching = null;
    changeClass(classId);
    teacher = 'closed';
  }

  function exitToTeacher() {
    setDoorLocked(false);
    goto('/');
  }

  function stopBeingKiosk() {
    forgetDevice();
    teacher = 'closed';
  }
</script>

<!--
  Wherever a rule stops a student: asking the teacher, and the teacher letting
  them go with their PIN. Asking needs a separate kiosk that can reach the
  teacher's computer; otherwise the screen says why instead of hiding it.
-->
{#snippet askOptions(offer: { studentId: string; destination: string }, close?: () => void)}
  {#if paired}
    <button
      class="door-btn"
      disabled={!canAsk()}
      onclick={() => {
        // Read who and where before closing: closing the line pop-up clears what offer is worked out from.
        const chosen = { ...offer };
        close?.();
        ask(chosen);
      }}><Icon name="hand" size={16} />Ask my teacher</button
    >
    {#if !canAsk()}<p class="ask-note">Your teacher's computer isn't connected</p>{/if}
  {:else}
    <p class="ask-note">Need to go now? Ask your teacher to let you go.</p>
  {/if}
  <button
    class="door-btn"
    onclick={() => {
      const chosen = { ...offer };
      close?.();
      askToLetGo(chosen);
    }}><Icon name="lock" size={16} />Teacher: let them go</button
  >
{/snippet}

<svelte:head>
  <title>Happy Hallways kiosk</title>
  <!-- The kiosk screen is for a classroom door, not for search results. -->
  <meta name="robots" content="noindex" />
</svelte:head>

<!-- Closing the kiosk stops students taking passes, and may strand passes not yet sent. -->
<svelte:window onbeforeunload={(event) => askBeforeLeaving(event, local || paired)} />
<svelte:document onpointerdown={() => (lastTouch = Date.now())} onkeydown={() => (lastTouch = Date.now())} />

<div class="door">
  {#if (!local && !paired) || reconnecting}
    <!-- Not a kiosk yet, or reconnecting one: pair with the teacher's laptop. -->
    <main class="pairing">
      <span class="mark"><BrandMark size={52} /></span>
      {#if reconnecting}
        <h1>Reconnect this kiosk</h1>
        <p class="lede">
          On the teacher's laptop, open Happy Hallways and choose <strong>Reconnect</strong> on Home. Then type the 6-digit
          code here, or scan the QR code with this device's camera. Students who came back in here are kept.
        </p>
      {:else}
        <h1>Make this device the kiosk</h1>
        {#if door.unreadableSaved}
          <p class="lede" role="alert">
            This kiosk couldn't read what it had saved. A copy is kept for support. Pair it again to keep going; returns
            already sent to the teacher's laptop are safe there.
          </p>
        {/if}
        {#if door.status === 'replaced'}
          <p class="lede">This device is no longer the kiosk. A different one was paired on the teacher's laptop.</p>
        {/if}
        <p class="lede">
          On the teacher's laptop, open Happy Hallways and go to <strong>Kiosk → Pair a device</strong>. Then type the 6-digit
          code here, or scan the QR code with this device's camera.
        </p>
      {/if}
      <form onsubmit={submitCode}>
        <input
          class="code-input"
          inputmode="numeric"
          autocomplete="off"
          maxlength="6"
          aria-label="Pairing code"
          placeholder="000000"
          bind:value={code}
        />
        <button class="door-btn primary" disabled={!/^\d{6}$/.test(code) || door.pairing.state === 'connecting'}>
          {door.pairing.state === 'connecting' ? 'Connecting…' : 'Connect'}
        </button>
      </form>
      {#if door.pairing.state === 'error'}
        <p class="door-error" role="alert">{door.pairing.message}</p>
        {#if door.pairing.problem}<SupportDetails {...door.pairing.problem} />{/if}
      {/if}
      {#if door.pairing.state === 'connecting' && door.pairing.slow}
        <p class="lede small" role="status">Still trying… Check that the code matches the one on the teacher's screen.</p>
      {/if}
      {#if reconnecting}
        <button class="quiet-link" onclick={() => (reconnecting = false)}>Back to the kiosk</button>
      {:else}
        <a class="quiet-link" href="/">This is the teacher's computer</a>
      {/if}
    </main>
  {:else}
    <header class="door-head">
      <div>
        <p class="door-eyebrow">{cls?.name ?? 'Happy Hallways'}</p>
        <h1>{cls || !following ? 'Tap your name' : 'No class right now'}</h1>
      </div>
      {#if setup()?.room}
        <!-- Students can join this class on their own device with this code (docs/adr/0019). -->
        <div class="door-room"><RoomCode code={setup()!.room!.code} size="small" /></div>
      {/if}
      {#if paired && door.status === 'live' && door.laptopOutdated}
        <!-- An older version on the teacher's computer can't answer this kiosk; returns are still kept here. -->
        <p class="connection"><span class="dot"></span>Your teacher's computer needs to reload Happy Hallways</p>
      {:else if paired && door.status === 'live'}
        <p class="connection live"><span class="dot"></span>Connected</p>
      {:else if paired}
        <div class="connection">
          <span class="dot"></span>
          <span>
            Waiting for your teacher's computer{waitingCount() ? ` · ${waitingCount()} ${waitingCount() === 1 ? 'tap' : 'taps'} saved here` : ''}
          </span>
          <button class="reconnect" onclick={reconnect}>Reconnect</button>
        </div>
      {/if}
    </header>

    {#if cls && blocked}
      <div class="no-pass" role="status">
        <Icon name="ban" size={34} />
        <span><strong>No passes right now.</strong> {whenPassesOpen(blocked)}</span>
      </div>
    {/if}

    {#if cls}
      {#each lines as each (each.destination)}
        <div class="line-strip" aria-label={each.destination ? `The line for ${each.destination}` : 'The line'}>
          <strong class="line-name">
            {#if each.destination}
              <DestinationIcon label={each.destination} list={destinations} size={22} />{each.destination} line
            {:else}
              <Icon name="users" size={22} />Line
            {/if}
          </strong>
          {#if !showsLineNames()}
            <!-- Who's in line is hidden in this class: only how many (docs/adr/0022). -->
            <span class="line-spot">{each.spots.length} waiting</span>
          {:else}
            {#each each.spots as spot, index (spot.studentId)}
              <span class="line-spot" class:next={isUpNext(spot.studentId)}>
                <!-- Merged lines (where is hidden) have no single order to number. -->
                {#if hasClassLimit() || showsWhere()}<span class="line-number">{index + 1}</span>{/if}
                <!-- In the Class Line, each student shows where they're going. -->
                {#if !each.destination && showsWhere()}<DestinationIcon label={spot.destination} list={destinations} size={20} />{/if}
                {spot.studentName}
                {#if isUpNext(spot.studentId)}· your turn!{/if}
              </span>
            {/each}
          {/if}
        </div>
      {/each}
    {/if}

    {#if cls}
      {#if !destinations.length}
        <p class="door-error">Your teacher hasn't set up any destinations yet.</p>
      {/if}
      <main class="names" class:closed={blocked} aria-label="Students in {cls.name}">
        {#each cls.students as student (student.id)}
          {@const pass = openPassFor(student.id)}
          {@const isNext = isUpNext(student.id)}
          <!-- With who's in line hidden, a tile shows a place in line only when it's that student's turn (docs/adr/0022). -->
          {@const spot = pass ? null : showsLineNames() || isNext ? lineSpotFor(student.id) : null}
          {@const asked = pass ? null : requestFor(student.id)}
          <!-- Where they went, never how long: the door carries no clock. See docs/adr/0003. -->
          <button class="name" class:out={pass} class:waiting={spot && !isNext} class:up-next={isNext} class:asked onclick={() => tap(student)}>
            <span class="name-text">{student.name}</span>
            {#if pass}
              <span class="name-status out-status">
                {#if shownTo(pass.destination)}
                  <DestinationIcon label={pass.destination} list={destinations} size={22} />Out · {pass.destination}
                {:else}
                  <!-- A Private destination: only "Out" (docs/adr/0021). -->
                  Out
                {/if}
              </span>
            {:else if asked}
              <span class="name-status asked-status">
                {#if shownTo(asked.destination)}<DestinationIcon label={asked.destination} list={destinations} size={22} />{/if}Asked your teacher
              </span>
            {:else if isNext && spot}
              <span class="name-status next-status">
                {#if showsWhere()}<DestinationIcon label={spot.destination} list={destinations} size={22} />{/if}Your turn: tap!
              </span>
            {:else if spot}
              <span class="name-status waiting-status">
                {#if showsWhere()}<DestinationIcon label={spot.destination} list={destinations} size={22} />{/if}{ordinal(spot.position)} in line
              </span>
            {:else if needsArrival(student.id)}
              <!-- Never "tardy" on the door's shared screen (docs/adr/0020). -->
              <span class="name-status arrive-status">Tap when you arrive</span>
            {:else if deniedRecently(student.id)}
              <span class="name-status denied-status">Not right now</span>
            {:else}
              <span class="name-status">In class</span>
            {/if}
          </button>
        {:else}
          <p class="lede">There are no students on this class's roster yet.</p>
        {/each}
      </main>
      <p class="count">
        {outCount(cls.id)} out{waiting.length ? ` · ${waiting.length} in line` : ''}
        {#if absentCount()}
          <button class="door-btn just-arrived" onclick={() => (lateArrival = { firstName: '', pin: '' })}>Just arrived?</button>
        {/if}
      </p>
    {:else if following}
      <main class="pairing">
        <p class="lede">{next ? `Next: ${next.name} at ${formatClock(next.start)}` : "That's all the classes on today's schedule."}</p>
      </main>
    {:else}
      <main class="pairing">
        <p class="lede">No class is on the kiosk yet. Teacher: choose one from your laptop, or tap Teacher below.</p>
      </main>
    {/if}

    <button class="teacher-btn" onclick={openTeacher}><Icon name="lock" size={15} />Teacher</button>
  {/if}

  {#if pinFor}
    <StudentPinPad
      name={pinFor.name}
      check={(entered) => !!pinFor && checkStudentPin(pinFor.id, entered)}
      onPass={pinTyped}
      onCancel={() => (pinFor = null)}
    />
  {/if}

  {#if choosingFor && cls}
    <Modal overlay="overlay" labelledby="choose-title" onClose={() => (choosingFor = null)}>
      <div class="sheet" class:wide={destinations.length > 6}>
        <p class="door-eyebrow">Pass for</p>
        <h2 id="choose-title">{choosingFor.name}</h2>
        <p class="lede">Where are you going?</p>
        {#if allowanceFor(choosingFor.id)}
          {@const allowance = allowanceFor(choosingFor.id)!}
          <p class="allowance" class:used-up={allowance.usedUp}>{allowance.text}</p>
        {/if}
        <div class="choices">
          {#each destinations as destination (destination.id)}
            {@const lineLength = line(destination.label).length}
            <button class="door-btn choice" onclick={() => choose(destination.label)}>
              <DestinationIcon label={destination.label} list={destinations} size={40} />
              <span class="choice-text">
                {destination.label}
                {#if isFull(destination.label)}
                  <span class="choice-status">Full{lineLength ? ` · ${lineLength} waiting` : ''}</span>
                {:else if lineLength}
                  <span class="choice-status">{lineLength} waiting</span>
                {/if}
              </span>
            </button>
          {/each}
        </div>
        <button class="quiet-link" onclick={() => (choosingFor = null)}>Cancel</button>
      </div>
    </Modal>
  {/if}

  {#if waitingFor}
    {@const spot = lineSpotFor(waitingFor.id)}
    <Modal overlay="overlay" labelledby="waiting-title" onClose={() => (waitingFor = null)}>
      <div class="sheet">
        <p class="door-eyebrow">In line</p>
        <h2 id="waiting-title">{waitingFor.name}</h2>
        {#if spot}
          <p class="lede">
            You're {ordinal(spot.position)} in line for {spot.destination}. When your name turns green, tap it to go.
          </p>
        {/if}
        <div class="choices">
          <button class="door-btn primary" onclick={() => (waitingFor = null)}>Stay in line</button>
          <button
            class="door-btn"
            onclick={() => {
              choosingFor = waitingFor;
              waitingFor = null;
            }}>Go somewhere else</button
          >
          <button
            class="door-btn"
            onclick={() => {
              if (waitingFor) leaveLine(waitingFor.id);
              waitingFor = null;
            }}>Leave the line</button
          >
        </div>
        {#if spot}
          {@const offer = { studentId: spot.studentId, destination: spot.destination }}
          <div class="choices">
            {@render askOptions(offer, () => (waitingFor = null))}
          </div>
        {/if}
      </div>
    </Modal>
  {/if}

  {#if askedFor}
    {@const asked = requestFor(askedFor.id)}
    <Modal overlay="overlay" labelledby="asked-title" onClose={() => (askedFor = null)}>
      <div class="sheet">
        <p class="door-eyebrow">Asked your teacher</p>
        <h2 id="asked-title">{askedFor.name}</h2>
        {#if asked}
          <p class="lede">
            You asked {shownTo(asked.destination) ? `to go to ${asked.destination}` : 'your teacher'}. If your teacher says yes, your name will say you’re out. Then go.
          </p>
        {/if}
        <div class="choices">
          <button class="door-btn primary" onclick={() => (askedFor = null)}>Keep waiting</button>
          <button
            class="door-btn"
            onclick={() => {
              if (askedFor) cancelRequest(askedFor.id);
              askedFor = null;
            }}>Never mind</button
          >
        </div>
      </div>
    </Modal>
  {/if}

  {#if door.notice}
    <div class="notice {door.notice.kind}" role="status">
      <span class="notice-symbol"><Icon name={door.notice.kind === 'denied' ? 'x' : 'check'} size={46} stroke={2.5} /></span>
      <p class="door-eyebrow">
        {door.notice.eyebrow ??
          (door.notice.kind === 'denied' ? 'Not right now' : door.notice.kind === 'returned' ? 'Welcome back' : 'Pass approved')}
      </p>
      <h2>{door.notice.title}</h2>
      <p class="notice-message">{door.notice.message}</p>
      <div class="notice-actions">
        {#if door.notice.undoPassId}
          <button class="door-btn" onclick={() => undoPass(door.notice!.undoPassId!)}>That's not me</button>
        {/if}
        {#if door.notice.offerLine}
          {@const offer = door.notice.offerLine}
          <button class="door-btn primary" onclick={() => joinLine(offer.studentId, offer.destination)}>Join the line</button>
          <button class="door-btn" onclick={dismissNotice}>Not now</button>
        {:else}
          <button class="door-btn" class:primary={door.notice.offerTeacher} onclick={dismissNotice}>Done</button>
        {/if}
        {#if door.notice.offerTeacher}
          {@const offer = door.notice.offerTeacher}
          {@render askOptions(offer)}
        {/if}
      </div>
    </div>
  {/if}

  {#if lateArrival}
    <Modal overlay="overlay" label="Just arrived" onClose={() => (lateArrival = null)}>
      <div class="sheet">
        <h2>Just arrived?</h2>
        <p class="lede small">Type your first name{lateArrivalNeedsPin() ? ' and your PIN' : ''}.</p>
        <form class="late-form" onsubmit={sendLateArrival}>
          <input aria-label="Your first name" autocomplete="off" bind:value={lateArrival.firstName} {@attach focusOnShow} />
          {#if lateArrivalNeedsPin()}
            <input class="code-input" type="password" inputmode="numeric" autocomplete="off" aria-label="Your PIN" maxlength="6" bind:value={lateArrival.pin} />
          {/if}
          <button
            class="door-btn primary"
            disabled={!lateArrival.firstName.trim() || (lateArrivalNeedsPin() && !/^\d{3,6}$/.test(lateArrival.pin))}>I'm here</button
          >
        </form>
        <button class="quiet-link" onclick={() => (lateArrival = null)}>Cancel</button>
      </div>
    </Modal>
  {/if}

  {#if teacher !== 'closed'}
    <Modal overlay="overlay" label="Teacher menu" onClose={() => (teacher = 'closed')}>
      <div class="sheet">
        {#if teacher === 'pin'}
          <h2>Teacher PIN</h2>
          {#if lettingGo}<p class="lede small">Enter your PIN to let this student go now. Their pass will show you approved it.</p>{/if}
          <form onsubmit={submitPin}>
            <input class="code-input" type="password" inputmode="numeric" autocomplete="off" aria-label="PIN" bind:value={pin} {@attach focusOnShow} />
            <button class="door-btn primary">Unlock</button>
          </form>
          {#if pinError}<p class="door-error" role="alert">{pinError}</p>{/if}
        {:else if confirmForget}
          <h2>Stop being the kiosk?</h2>
          {#if waitingCount()}
            <p class="door-error">
              {waitingCount()} {waitingCount() === 1 ? 'tap (a return or arrival) hasn’t' : 'taps (returns or arrivals) haven’t'} reached the teacher's computer yet, and will be lost.
            </p>
          {/if}
          <div class="choices">
            <button class="door-btn danger" onclick={stopBeingKiosk}>Unpair this device</button>
          </div>
        {:else}
          <h2>Switch class</h2>
          {#if following}
            <p class="lede small">
              The kiosk is following your schedule. Switching by hand turns the schedule off until you turn it back on
              from your laptop.
            </p>
          {/if}
          <div class="choices">
            {#each setup()?.classes ?? [] as option (option.id)}
              <button class="door-btn choice" class:current={option.id === cls?.id} onclick={() => switchTo(option.id)}>
                {switching === option.id ? `Tap again: turn off the schedule and switch to ${option.name}` : option.name}
              </button>
            {/each}
          </div>
          <p class="lede small">Students still out in the current class will have their passes ended, and the line will be cleared.</p>
          {#if waiting.length}
            <button
              class="door-btn"
              onclick={() => {
                clearLine();
                teacher = 'closed';
              }}>Clear the line ({waiting.length})</button
            >
          {/if}
          {#if local}
            <button class="door-btn" onclick={exitToTeacher}><Icon name="unlock" size={16} />Exit kiosk</button>
          {:else}
            <button class="door-btn" onclick={() => (confirmForget = true)}>Unpair this device</button>
          {/if}
        {/if}
        <button class="quiet-link" onclick={() => (teacher = 'closed')}>Cancel</button>
      </div>
    </Modal>
  {/if}
</div>

<style>
  .ask-note {
    margin: 0;
    color: var(--muted);
    font-size: 15px;
    text-align: center;
  }

  .door-room {
    margin-left: auto;
  }

  /* The door screen is read from across the room: large type, plain light surfaces, strong contrast. */
  .door {
    --door-bg: var(--bg);
    --door-tile: #fff;
    --door-line: var(--border);
    --door-text: var(--text);
    --door-muted: var(--muted);
    --door-accent: var(--accent);
    --door-out: #a8620f;
    min-height: 100vh;
    padding: 28px clamp(16px, 4vw, 48px) 90px;
    background: var(--door-bg);
    color: var(--door-text);
  }

  h1 {
    font-size: clamp(28px, 4vw, 40px);
  }

  h2 {
    font-size: 28px;
  }

  .door-eyebrow {
    color: var(--door-accent);
    font-size: 13px;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .lede {
    color: var(--door-muted);
    font-size: 17px;
    max-width: 52ch;
  }

  .small {
    font-size: 14px;
  }

  .allowance {
    margin-top: 6px;
    font-size: 17px;
    font-weight: 700;
    color: var(--door-accent);
  }

  .allowance.used-up {
    color: var(--door-out);
  }

  .door-head {
    flex-wrap: wrap;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 16px;
    margin-bottom: 24px;
  }

  .connection {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--door-muted);
    font-size: 14px;
    font-weight: 700;
  }

  .reconnect {
    padding: 6px 12px;
    border: 1px solid var(--door-line);
    border-radius: 999px;
    background: var(--door-tile);
    color: var(--door-text);
    font: inherit;
    cursor: pointer;
  }

  .connection .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--door-out);
  }

  .connection.live .dot {
    background: var(--door-accent);
  }

  .names {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
  }

  .name {
    display: grid;
    gap: 4px;
    min-height: 92px;
    padding: 16px;
    border: 1px solid var(--door-line);
    border-radius: 12px;
    background: var(--door-tile);
    text-align: left;
    cursor: pointer;
  }

  .name:hover {
    border-color: var(--door-accent);
  }

  .name-text {
    font-size: 21px;
    font-weight: 800;
  }

  .name-status {
    color: var(--door-muted);
    font-size: 14px;
    font-weight: 700;
  }

  .name.out {
    border-color: #e6c48f;
    background: #fdf6ea;
  }

  .out-status {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--door-out);
  }

  .name.waiting {
    border-color: #b9d0ec;
    background: #f1f6fd;
  }

  .name.up-next {
    border-color: var(--accent);
    border-width: 2px;
    background: #e9f4ec;
  }

  .name.asked {
    border-color: #d9c6ef;
    background: #f6f1fc;
  }

  .waiting-status,
  .asked-status,
  .next-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .waiting-status {
    color: #2361a6;
  }

  .next-status {
    color: var(--accent);
  }

  .asked-status {
    color: #6a4cbb;
  }

  .denied-status {
    color: var(--door-out);
  }

  .just-arrived {
    margin-left: 12px;
  }

  .late-form {
    display: grid;
    gap: 10px;
  }

  .late-form input:not(.code-input) {
    padding: 12px;
    font-size: 22px;
  }

  .arrive-status {
    color: #2361a6;
    font-weight: 800;
  }

  /* Readable from across the room, so students can see it isn't time without asking. */
  .no-pass {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 14px;
    padding: 18px 22px;
    border: 1px solid #ecd3ac;
    border-radius: 14px;
    background: var(--warn-wash);
    color: var(--warn);
    font-size: clamp(20px, 2.6vw, 28px);
    line-height: 1.25;
  }

  .no-pass strong {
    display: block;
  }

  .names.closed {
    filter: grayscale(0.85);
    opacity: 0.6;
  }

  .line-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-bottom: 18px;
    padding: 10px 14px;
    border: 1px solid #b9d0ec;
    border-radius: 12px;
    background: #f1f6fd;
    font-size: 16px;
  }

  .line-name {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .line-strip + .line-strip {
    margin-top: -8px;
  }

  .line-spot {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px 4px 4px;
    border-radius: 999px;
    background: #fff;
    font-weight: 700;
  }

  .line-spot.next {
    background: var(--accent);
    color: #fff;
  }

  .line-number {
    display: grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: #e1ecf8;
    color: #2361a6;
    font-size: 12px;
    font-weight: 800;
  }

  .line-spot.next .line-number {
    background: #fff;
    color: var(--accent);
  }

  .count {
    margin-top: 20px;
    color: var(--door-muted);
    font-weight: 700;
  }

  .teacher-btn {
    position: fixed;
    right: 18px;
    bottom: 18px;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--door-line);
    border-radius: 8px;
    background: transparent;
    color: var(--door-muted);
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
  }

  .pairing {
    display: grid;
    justify-items: center;
    gap: 16px;
    max-width: 560px;
    margin: 8vh auto 0;
    text-align: center;
  }

  .pairing .lede {
    margin: 0 auto;
  }

  .mark {
    display: grid;
    place-items: center;
  }

  form {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .code-input {
    width: 220px;
    padding: 12px 14px;
    border: 1px solid var(--door-line);
    border-radius: 10px;
    background: var(--door-tile);
    color: var(--door-text);
    font: 700 28px/1 ui-monospace, 'SF Mono', Menlo, monospace;
    letter-spacing: 0.2em;
    text-align: center;
  }

  .door-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    padding: 12px 20px;
    border: 1px solid var(--door-line);
    border-radius: 10px;
    background: var(--door-tile);
    color: var(--door-text);
    font-size: 17px;
    font-weight: 800;
    cursor: pointer;
  }

  .door-btn.primary {
    background: var(--door-accent);
    border-color: var(--door-accent);
    color: #fff;
  }

  .door-btn.danger {
    background: var(--danger);
    border-color: var(--danger);
    color: #fff;
  }

  .door-btn:disabled {
    opacity: 0.5;
  }

  .door-btn.current {
    border-color: var(--door-accent);
  }

  .door-error {
    color: var(--danger);
    font-weight: 700;
  }

  .quiet-link {
    border: 0;
    background: none;
    color: var(--door-muted);
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
  }

  /* A pop-up taller than the screen scrolls, by finger or mouse, instead of being cut off. */
  :global(.overlay) {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: grid;
    justify-items: center;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding: 16px;
    background: rgb(42 34 22 / 40%);
    backdrop-filter: blur(3px);
  }

  .sheet {
    display: grid;
    gap: 16px;
    /* Centered when it fits; when it's taller than the screen, it starts at the top so nothing is out of reach. */
    margin-block: auto;
    width: min(560px, 100%);
    padding: 28px;
    border: 1px solid var(--door-line);
    border-radius: 16px;
    background: #fff;
    box-shadow: 0 16px 48px rgb(42 34 22 / 18%);
    text-align: center;
  }

  /* A long list of destinations spreads into more columns, like the names behind it. */
  .sheet.wide {
    width: min(960px, 100%);
  }

  .sheet .lede {
    margin: 0 auto;
  }

  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 10px;
  }

  .door-btn.choice {
    justify-content: flex-start;
    gap: 14px;
    min-height: 72px;
    font-size: 20px;
  }

  .choice-text {
    display: grid;
    text-align: left;
  }

  .choice-status {
    color: var(--door-out);
    font-size: 14px;
  }

  .notice-actions {
    flex-wrap: wrap;
    justify-content: center;
  }

  .notice {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: grid;
    place-content: center;
    justify-items: center;
    gap: 12px;
    padding: 24px;
    text-align: center;
    background: #e3f0e7;
    --notice-strong: var(--accent);
  }

  .notice.denied {
    background: #fbefdc;
    --notice-strong: #a8620f;
  }

  .notice.returned {
    background: #e1ecf8;
    --notice-strong: #2361a6;
  }

  .notice .door-eyebrow {
    color: var(--notice-strong);
  }

  .notice h2 {
    font-size: clamp(32px, 5vw, 52px);
  }

  .notice-symbol {
    display: grid;
    place-items: center;
    width: 86px;
    height: 86px;
    border-radius: 50%;
    background: var(--notice-strong);
    color: #fff;
  }

  .notice-message {
    font-size: clamp(20px, 3vw, 28px);
    font-weight: 700;
    max-width: 30ch;
  }

  .notice-actions {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }
</style>
