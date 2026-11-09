<script lang="ts">
  import {
    account,
    activeClassLabel,
    currentSchedule,
    liveSchedule,
    passStatus,
    passStatusIcon,
    passStatusText,
    waitingRequests,
  } from './account.svelte';
  import { clock } from './clock.svelte';
  import Icon from './Icon.svelte';
  import { kioskState } from './link.svelte';
  import { devicesText, studentLink } from './studentLink.svelte';

  /**
   * The status box at the top of the sidebar: the day at a glance, on every
   * page. Clicking it goes to Home, where all of it can be changed.
   */
  const status = $derived(passStatus(clock.now));
  const kiosk = $derived(kioskState());
  const schedule = $derived.by(() => {
    if (liveSchedule()) return liveSchedule()!.name;
    return currentSchedule() ? 'Off schedule' : 'No schedule';
  });
  const requests = $derived(waitingRequests().length);
  const devices = $derived(
    !account.studentLink?.open
      ? 'Student devices off'
      : studentLink.viewers
        ? devicesText()
        : 'Student devices on',
  );
</script>

<a class="status-box {status}" href="/">
  <span class="pass-status {status}" role="img" title={passStatusText[status]} aria-label={passStatusText[status]}>
    <Icon name={passStatusIcon[status]} size={16} />
  </span>
  <strong class="class-name">{activeClassLabel()}</strong>
  <span class="row-line"><Icon name="kiosk" size={14} />{kiosk.text}</span>
  <span class="row-line"><Icon name="smartphone" size={14} />{devices}</span>
  <span class="row-line"><Icon name="calendar" size={14} />{schedule}</span>
  {#if account.kiosk?.kind === 'device'}
    <span class="row-line requests" class:waiting={requests}>
      <Icon name="hand" size={14} />{requests ? `${requests} ${requests === 1 ? 'request' : 'requests'}` : 'No requests'}
    </span>
  {/if}
</a>

<style>
  .status-box {
    position: relative;
    display: grid;
    gap: 4px;
    padding: 12px 14px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--bg);
    color: var(--text);
    text-decoration: none;
  }

  .status-box:hover {
    border-color: var(--border-strong);
  }

  /* The whole box takes the color of whether students may leave right now. */
  .status-box.open {
    border-color: #b9d6c1;
    background: var(--accent-wash);
  }

  .status-box.no-pass {
    border-color: #ecd3ac;
    background: var(--warn-wash);
  }

  .status-box.between,
  .status-box.no-class {
    background: var(--surface-sunk);
  }

  .class-name {
    font-size: 16px;
    line-height: 1.3;
  }

  /* Whether students may leave right now, as one colored icon in the corner. */
  .pass-status {
    position: absolute;
    top: 10px;
    right: 10px;
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--surface);
    color: var(--muted);
  }

  .pass-status.open {
    background: var(--surface);
    color: var(--accent);
  }

  .pass-status.no-pass {
    background: var(--surface);
    color: var(--warn);
  }

  .class-name {
    padding-right: 30px;
  }

  .row-line {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }

  .requests.waiting {
    color: #6a4cbb;
    font-weight: 800;
  }
</style>
