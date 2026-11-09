<script lang="ts">
  import { page } from '$app/state';
  import type { DataConnection, Peer } from 'peerjs';
  import { onMount } from 'svelte';
  import BrandMark from '#lib/BrandMark.svelte';
  import DestinationIcon from '#lib/DestinationIcon.svelte';
  import Icon from '#lib/Icon.svelte';
  import { createPeer, keepAlive, studentLinkPrefix } from '#lib/peer.ts';
  import { yourTurnSound } from '#lib/sound.ts';
  import { isUpNext, nextAlert, turnTitle } from '#lib/yourTurn.ts';
  import type { DoorNoticeMessage, LinkAction, OwnView, StudentLinkMessage, StudentMessage, StudentView } from '#lib/types.ts';

  /**
   * The Student link, on a student's own Chromebook or phone, joined with the
   * Room code for this class period (docs/adr/0019): whether passes
   * are open, and how many are out and waiting, straight from the teacher's
   * computer. It never shows another student's name (docs/adr/0018). Once a
   * student sets up this device with their first name and PIN, it acts as them:
   * going, coming back, lining up and asking, and it shows their own status.
   * The teacher's computer decides; this device keeps only the Claim's random
   * token. See docs/adr/0016.
   */
  type Reach = 'connecting' | 'live' | 'unreachable' | 'closed' | 'full' | 'old-link';
  let reach = $state<Reach>('connecting');
  let view = $state<StudentView | null>(null);
  /** This page has reached the class before, so losing it now is most likely the teacher's page reloading. */
  let wasLive = $state(false);

  /** How long to wait before trying the teacher's computer again, by what happened last time. */
  const retrySeconds: Partial<Record<Reach, number>> = { unreachable: 10, closed: 20, full: 30 };
  /** After a dropped connection, look again quickly: the teacher's page is usually back within seconds. */
  const reconnectSeconds = 3;

  const claimKey = `hallway.claim.${page.params.code}`;
  function savedClaim(): { token: string; name: string } | null {
    try {
      return JSON.parse(localStorage.getItem(claimKey) ?? 'null');
    } catch {
      return null;
    }
  }
  let claimed = $state(savedClaim());
  let me = $state<OwnView | null>(null);
  /** Counts up from the teacher's word on how long their pass has run, so it ticks without asking again. */
  let outSince = $state(0);
  let tick = $state(Date.now());
  let notice = $state<DoorNoticeMessage | null>(null);
  let noticeTimer = 0;
  /** What the panel at the bottom is doing: its usual buttons, setting up this device, or choosing where to go. */
  let panel = $state<'main' | 'setup' | 'choose'>('main');
  let firstName = $state('');
  let pin = $state('');
  let setupError = $state('');

  let say: (message: StudentMessage) => void = () => {};
  /** The teacher's computer checks every action is this device's own student. */
  const myId = () => me?.studentId ?? '';

  function forgetClaim() {
    claimed = null;
    me = null;
    localStorage.removeItem(claimKey);
  }

  function act(action: LinkAction) {
    if (claimed) say({ type: 'act', token: claimed.token, action });
    panel = 'main';
    notice = null;
  }

  function startSetup() {
    setupError = '';
    pin = '';
    panel = 'setup';
  }

  function sendSetup(event: SubmitEvent) {
    event.preventDefault();
    if (firstName.trim() && /^\d{3,6}$/.test(pin)) say({ type: 'claim', firstName: firstName.trim(), pin });
  }

  function hear(message: StudentLinkMessage) {
    if (message.type === 'claimed') {
      claimed = { token: message.token, name: message.name };
      localStorage.setItem(claimKey, JSON.stringify(claimed));
      panel = 'main';
      firstName = '';
      pin = '';
    }
    if (message.type === 'claim-refused') {
      setupError = message.message;
      pin = '';
    }
    if (message.type === 'claim-ended') forgetClaim();
    if (message.type === 'me') {
      me = message.me;
      outSince = message.me.out ? Date.now() - message.me.out.secondsOut * 1000 : 0;
    }
    if (message.type === 'notice') {
      clearTimeout(noticeTimer);
      notice = message.notice;
      noticeTimer = window.setTimeout(() => (notice = null), message.seconds * 1000);
    }
  }

  onMount(() => {
    const timer = setInterval(() => (tick = Date.now()), 1000);
    return () => clearInterval(timer);
  });

  const minutesOut = $derived(outSince ? Math.floor((tick - outSince) / 60_000) : 0);

  onMount(() => {
    const address = studentLinkPrefix + page.params.code;
    let peer: Peer | null = null;
    let connection: DataConnection | null = null;
    let retryTimer = 0;
    let giveUpTimer = 0;

    function tryAgainLater() {
      clearTimeout(retryTimer);
      const seconds = reach === 'unreachable' && wasLive ? reconnectSeconds : retrySeconds[reach];
      if (seconds) retryTimer = window.setTimeout(dial, seconds * 1000);
    }

    function stopWatching(why: Reach) {
      reach = why;
      view = null;
      tryAgainLater();
    }

    function dial() {
      // While the matchmaking server is out of reach, createPeer keeps trying, and dials once it answers.
      if (!peer || peer.destroyed || peer.disconnected) return;
      clearTimeout(giveUpTimer);
      const previous = connection;
      connection = null;
      previous?.close();
      // A claimed device says so, so it's never turned away when the link is busy.
      const attempt = peer.connect(address, { reliable: true, metadata: claimed ? { token: claimed.token } : {} });
      connection = attempt;
      say = (message) => {
        if (attempt.open) attempt.send(message);
      };
      giveUpTimer = window.setTimeout(() => {
        if (!attempt.open) attempt.close();
        if (connection === attempt) stopWatching('unreachable');
      }, 20_000);
      attempt.on('open', () => {
        clearTimeout(giveUpTimer);
        keepAlive(attempt);
      });
      attempt.on('data', (data) => {
        const message = data as StudentLinkMessage;
        if (message.type === 'view') {
          view = message.view;
          reach = 'live';
          wasLive = true;
        }
        if (message.type === 'closed' || message.type === 'full' || message.type === 'old-link') stopWatching(message.type);
        hear(message);
      });
      attempt.on('close', () => {
        if (connection !== attempt) return;
        connection = null;
        if (reach === 'live' || reach === 'connecting') stopWatching('unreachable');
      });
    }

    createPeer().then((created) => {
      peer = created;
      created.on('open', dial);
      created.on('error', (error) => {
        // Nobody answers at that address: the teacher's computer is off, or Happy Hallways is closed on it.
        if (error.type === 'peer-unavailable' || error.type === 'network' || error.type === 'server-error') {
          clearTimeout(giveUpTimer);
          stopWatching('unreachable');
        }
      });
    });

    return () => {
      clearTimeout(retryTimer);
      clearTimeout(giveUpTimer);
      peer?.destroy();
    };
  });

  const list = $derived(view?.destinations ?? []);
  const outTotal = $derived(view?.out.reduce((sum, each) => sum + each.count, 0) ?? 0);
  const statusText = $derived(
    view
      ? {
          open: 'Passes open',
          'no-pass': 'No passes',
          between: 'Between classes',
          'no-class': 'No class',
        }[view.status]
      : '',
  );
  const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`);

  // "It's your turn": once per turn, a sound and a buzz; while it lasts, the tab title flashes. Only on a set-up device.
  const upNext = $derived(!!claimed && isUpNext(me));
  let alerted = false;
  $effect(() => {
    const next = nextAlert(alerted, claimed ? me : null);
    alerted = next.alerted;
    if (!next.alert) return;
    try {
      yourTurnSound();
    } catch {
      // Sound not allowed here: the screen and the title still say so.
    }
    navigator.vibrate?.([200, 100, 200]);
  });
  let flashTick = $state(0);
  $effect(() => {
    if (!upNext) return;
    flashTick = 0;
    const timer = setInterval(() => flashTick++, 1000);
    return () => clearInterval(timer);
  });
  const title = $derived(turnTitle(`${view?.className ? `${view.className} · ` : ''}Happy Hallways`, upNext, flashTick));
</script>

<svelte:head>
  <title>{title}</title>
  <!-- Each class's link is private to its students, not for search results. -->
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="student">
  <header class="brand-row">
    <BrandMark size={26} />
    <span>Happy Hallways</span>
  </header>

  {#if reach === 'live' && view}
    <main class="live" aria-live="polite">
      <div class="title">
        <h1>{view.className ?? 'No class right now'}</h1>
        <p class="status {view.status}" role="status">
          <Icon name={view.status === 'open' ? 'door' : view.status === 'no-pass' ? 'ban' : 'pause'} size={18} />
          {statusText}
        </p>
      </div>
      {#if view.whenPassesOpen}<p class="when">{view.whenPassesOpen}</p>{/if}

      {#if view.className}
        <section class="card" aria-labelledby="out-title">
          <h2 id="out-title">Out of class <span class="count">{outTotal}</span></h2>
          {#if view.outNames?.length}
            <!-- The class shows names on student devices (docs/adr/0022). -->
            <ul class="tallies names-out">
              {#each view.outNames as each, index (index)}
                <li>
                  {#if each.destination}<DestinationIcon label={each.destination} {list} size={26} />{/if}<span>{each.name}</span>
                  <strong class="where">{each.destination ?? 'Out'}</strong>
                </li>
              {/each}
            </ul>
          {:else if view.out.length}
            <ul class="tallies">
              {#each view.out as each (each.destination)}
                <li>
                  {#if !each.private}<DestinationIcon label={each.destination} {list} size={26} />{/if}<span>{each.destination}</span><strong>{each.count}</strong>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="empty-note">Everyone's in class.</p>
          {/if}
        </section>

        {#if view.lines.length}
          <section class="card" aria-labelledby="lines-title">
            <h2 id="lines-title">Waiting in line</h2>
            <ul class="tallies">
              {#each view.lines as line (line.destination)}
                <li>
                  {#if line.destination}<DestinationIcon label={line.destination} {list} size={26} /><span>{line.destination}</span>{:else}<span>The line</span>{/if}
                  <strong>{line.waiting}</strong>
                  {#if line.names?.length}
                    <ol class="line-names">
                      {#each line.names as name, index (index)}<li>{name}</li>{/each}
                    </ol>
                  {/if}
                </li>
              {/each}
            </ul>
          </section>
        {/if}

        {#if claimed && me}
          <section class="card mine" aria-labelledby="mine-title">
            <h2 id="mine-title">{me.name}</h2>
            {#if me.out}
              <p class="mine-status">
                <DestinationIcon label={me.out.destination} {list} size={24} />Out at {me.out.destination} · {minutesOut} min{#if me.out.minutes}
                  of {me.out.minutes}{/if}
              </p>
            {:else if !me.canAct}
              <p class="mine-status">You can take a pass from here during your class.</p>
            {:else if me.request}
              <p class="mine-status">You asked your teacher for {me.request.destination}. If they say yes, go.</p>
            {:else if me.line}
              <p class="mine-status">
                {me.line.upNext ? "It's your turn!" : `You're ${ordinal(me.line.position)} in line for ${me.line.destination}.`}
              </p>
            {:else}
              <p class="mine-status">In class</p>
            {/if}
            {#if me.passesLeft}<p class="muted-note">{me.passesLeft}</p>{/if}
            {#if me.attendance}
              <p class="muted-note">
                {{ 'not-yet': 'Not tapped in yet: tap your name at the kiosk when you arrive.', present: 'Arrived', tardy: 'Arrived late (tardy)', absent: 'Marked absent' }[me.attendance]}
              </p>
            {/if}
          </section>
        {/if}
      {/if}

      <!--
        One panel at the bottom holds every action and every reply. A reply
        replaces the buttons in the same place, so nothing on the page moves.
      -->
      <section class="panel" aria-label="What you can do">
        {#if notice}
          <div class="reply {notice.kind}" role="alert">
            {#if notice.eyebrow}<p class="eyebrow">{notice.eyebrow}</p>{/if}
            <strong>{notice.title}</strong>
            <p>{notice.message}</p>
            <div class="buttons">
              {#if notice.offerLine}
                {@const offer = notice.offerLine}
                <button class="big primary" onclick={() => act({ kind: 'join', studentId: offer.studentId, destination: offer.destination })}>
                  Join the line
                </button>
              {/if}
              {#if notice.offerTeacher}
                {@const offer = notice.offerTeacher}
                <button class="big" onclick={() => act({ kind: 'ask', studentId: offer.studentId, destination: offer.destination })}>
                  <Icon name="hand" size={18} />Ask my teacher
                </button>
              {/if}
              {#if notice.undoPassId}
                {@const passId = notice.undoPassId}
                <button class="big" onclick={() => act({ kind: 'undo', passId })}>Oops, undo</button>
              {/if}
              <button class="big" onclick={() => (notice = null)}>OK</button>
            </div>
          </div>
        {:else if claimed && me}
          {#if panel === 'choose'}
            <p class="panel-title">Where are you going?</p>
            <div class="buttons">
              {#each list as destination (destination.label)}
                <button class="big" onclick={() => act({ kind: 'pass', studentId: myId(), destination: destination.label })}>
                  <DestinationIcon label={destination.label} {list} size={24} />{destination.label}
                </button>
              {/each}
              <button class="link-btn" onclick={() => (panel = 'main')}>Cancel</button>
            </div>
          {:else if me.out}
            <button class="big primary" onclick={() => act({ kind: 'back', studentId: myId() })}>I'm back</button>
          {:else if !me.canAct}
            <!-- Nothing to do until their class is on. -->
          {:else if me.request}
            <button class="big" onclick={() => act({ kind: 'cancel-request', studentId: myId() })}>Cancel my request</button>
          {:else if me.line}
            {#if me.line.upNext}
              <button class="big primary" onclick={() => act({ kind: 'pass', studentId: myId(), destination: me!.line!.destination })}>
                Go to {me.line.destination}
              </button>
            {/if}
            <button class="big" onclick={() => act({ kind: 'leave', studentId: myId() })}>Leave the line</button>
          {:else}
            <button class="big primary" onclick={() => (panel = 'choose')}><Icon name="door" size={20} />I need to leave</button>
          {/if}
          <button class="link-btn" onclick={() => claimed && say({ type: 'end-claim', token: claimed.token })}>
            Not {me.name}? Stop using this device as them
          </button>
        {:else if view.claimsOpen && panel === 'setup'}
          <p class="panel-title">Use this device for passes</p>
          <form class="setup" onsubmit={sendSetup}>
            <label>Your first name <input bind:value={firstName} autocomplete="off" autocapitalize="words" /></label>
            <label>
              Your PIN
              <input type="password" inputmode="numeric" autocomplete="off" maxlength="6" bind:value={pin} />
            </label>
            <button class="big primary" disabled={!firstName.trim() || !/^\d{3,6}$/.test(pin)}>Use this device</button>
          </form>
          {#if setupError}<p class="setup-error" role="alert">{setupError}</p>{/if}
          <p class="muted-note">You do this once each class. Then you can leave class and come back from here.</p>
          <button class="link-btn" onclick={() => (panel = 'main')}>Cancel</button>
        {:else if view.claimsOpen}
          <!-- "Sign out" here would read like logging out of an account; this device isn't anyone's yet. -->
          <button class="big" onclick={startSetup}><Icon name="user-round" size={20} />Use this device for passes</button>
          <p class="muted-note">Leave class and come back from here instead of the kiosk.</p>
        {:else}
          <p class="muted-note">This page updates by itself. To leave class, use the kiosk by the door.</p>
        {/if}
      </section>
    </main>
  {:else}
    <main class="message" role="status">
      {#if reach === 'connecting'}
        <span class="icon-ring"><Icon name="link" size={30} /></span>
        <h1>Connecting to your teacher's computer…</h1>
      {:else if reach === 'unreachable' && wasLive}
        <span class="icon-ring"><Icon name="link" size={30} /></span>
        <h1>Reconnecting to your teacher's computer…</h1>
        <p>This usually takes a few seconds. You don't need to do anything.</p>
      {:else if reach === 'unreachable'}
        <span class="icon-ring warn"><Icon name="laptop" size={30} /></span>
        <h1>Can't reach this class</h1>
        <p>
          Check the code on the board or the kiosk. If it's right, your teacher's computer may be closed; we'll keep
          trying.
        </p>
        <a class="big" href="/join">Type a different code</a>
      {:else if reach === 'closed'}
        <span class="icon-ring"><Icon name="lock" size={30} /></span>
        <h1>This class isn't open right now</h1>
        <p>Your teacher has turned student devices off, or no class is on. Look for the code when your class starts.</p>
        <a class="big" href="/join">Type a code</a>
      {:else if reach === 'full'}
        <span class="icon-ring warn"><Icon name="users" size={30} /></span>
        <h1>Too many people are viewing</h1>
        <p>Try again in a minute. This page will keep trying by itself.</p>
      {:else}
        <span class="icon-ring warn"><Icon name="link" size={30} /></span>
        <h1>This code has ended</h1>
        <p>Each class gets a new code. Look for this class's code on the board or the kiosk.</p>
        <a class="big" href="/join">Type the new code</a>
      {/if}
    </main>
  {/if}
</div>

<style>
  .names-out .where {
    color: var(--muted);
    font-size: 14px;
    font-weight: 700;
  }

  .line-names {
    flex-basis: 100%;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin: 2px 0 0;
    padding-left: 20px;
    color: var(--muted);
    font-size: 14px;
  }

  /* Read on a Chromebook or a phone: big, friendly and plain. */
  /* Exactly one screen tall on a phone too: 100vh counts the browser's address bar, 100dvh doesn't. */
  .student {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    min-height: 100dvh;
    max-width: 720px;
    margin: 0 auto;
    padding: 20px 16px 0;
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 22px;
    color: var(--muted);
    font-size: 14px;
    font-weight: 800;
  }

  .live {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 16px;
  }

  .title {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
  }

  h1 {
    font-size: clamp(26px, 6vw, 36px);
  }

  .status {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-sunk);
    color: var(--muted);
    font-size: 16px;
    font-weight: 800;
    white-space: nowrap;
  }

  .status.open {
    border-color: #c7dccd;
    background: var(--accent-wash);
    color: var(--accent);
  }

  .status.no-pass {
    border-color: #ecd3ac;
    background: var(--warn-wash);
    color: var(--warn);
  }

  .when {
    margin-top: -6px;
    color: var(--muted);
    font-size: 16px;
  }

  .card {
    display: grid;
    gap: 10px;
    padding: 16px;
    border: 1px solid var(--border);
    border-radius: 16px;
    background: var(--surface);
  }

  h2 {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 20px;
  }

  .count {
    display: grid;
    place-items: center;
    min-width: 28px;
    height: 28px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--surface-sunk);
    border: 1px solid var(--border);
    font-size: 14px;
  }

  .tallies {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .tallies li {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 18px;
  }

  .tallies strong {
    margin-left: auto;
    font-size: 20px;
  }

  .mine-status {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 18px;
    font-weight: 700;
  }

  .empty-note,
  .muted-note {
    color: var(--muted);
    font-size: 15px;
  }

  /* Always the last thing on the page, held to the bottom of the screen. */
  .panel {
    position: sticky;
    bottom: 0;
    display: grid;
    gap: 10px;
    margin: auto -16px 0;
    padding: 16px 16px 20px;
    border-top: 1px solid var(--border);
    background: var(--bg);
  }

  .panel-title {
    font-size: 18px;
    font-weight: 800;
  }

  .buttons {
    display: grid;
    gap: 8px;
  }

  .big {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 52px;
    padding: 10px 16px;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    color: inherit;
    font: inherit;
    font-size: 18px;
    font-weight: 800;
    cursor: pointer;
  }

  .big.primary {
    border-color: var(--accent);
    background: var(--accent);
    color: #fff;
  }

  .big:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .link-btn {
    justify-self: center;
    padding: 4px 0;
    border: 0;
    background: none;
    color: var(--muted);
    font: inherit;
    font-size: 15px;
    text-decoration: underline;
    cursor: pointer;
  }

  .reply {
    display: grid;
    gap: 6px;
    font-size: 17px;
  }

  .reply.approved strong {
    color: var(--accent);
  }

  .reply.denied strong {
    color: var(--warn);
  }

  .reply .eyebrow {
    color: var(--muted);
    font-size: 13px;
    font-weight: 800;
    text-transform: uppercase;
  }

  .setup {
    display: grid;
    gap: 10px;
  }

  .setup label {
    display: grid;
    gap: 4px;
    font-weight: 700;
  }

  .setup input {
    padding: 12px;
    border: 1px solid var(--border);
    border-radius: 12px;
    font: inherit;
    font-size: 20px;
  }

  .setup-error {
    color: var(--warn);
    font-weight: 700;
  }

  .message {
    display: grid;
    justify-items: center;
    gap: 14px;
    margin-top: 8dvh;
    text-align: center;
  }

  .message h1 {
    font-size: clamp(24px, 5.5vw, 32px);
  }

  .message p {
    max-width: 44ch;
    color: var(--muted);
    font-size: 17px;
  }

  .icon-ring {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--accent-wash);
    color: var(--accent);
  }

  .icon-ring.warn {
    background: var(--warn-wash);
    color: var(--warn);
  }

  .tallies li:has(.line-names) {
    flex-wrap: wrap;
  }

  .tallies .line-names li {
    display: list-item;
    font-size: 14px;
  }
</style>
