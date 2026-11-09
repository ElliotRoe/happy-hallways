<script lang="ts">
  import { goto } from '$app/navigation';
  import Modal from './Modal.svelte';
  import { classPasses, deleteClass, setAttendance, setVisibility, updateClass, visibilityOf } from './account.svelte';
  import { defaultAttendance } from './attendance';
  import Icon from './Icon.svelte';
  import type { Class } from './types';

  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let name = $state(cls.name);
  // svelte-ignore state_referenced_locally
  let takesAttendance = $state(!!cls.attendance);
  // svelte-ignore state_referenced_locally
  let graceMinutes = $state(cls.attendance?.graceMinutes ?? defaultAttendance.graceMinutes);
  // svelte-ignore state_referenced_locally
  let absentAfterMinutes = $state(cls.attendance?.absentAfterMinutes ?? defaultAttendance.absentAfterMinutes);
  // svelte-ignore state_referenced_locally
  const shows = $state(visibilityOf(cls));
  let confirmingDelete = $state(false);

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    updateClass(cls.id, { name: name.trim() });
    const minutes = (value: number, fallback: number) => (Number.isFinite(value) && value >= 0 ? Math.round(value) : fallback);
    setAttendance(
      cls.id,
      takesAttendance
        ? {
            graceMinutes: minutes(graceMinutes, defaultAttendance.graceMinutes),
            absentAfterMinutes: Math.max(1, minutes(absentAfterMinutes, defaultAttendance.absentAfterMinutes)),
          }
        : null,
    );
    setVisibility(cls.id, 'names', shows.names);
    setVisibility(cls.id, 'where', shows.where);
    setVisibility(cls.id, 'lineNames', shows.lineNames);
    onClose();
  }

  function remove() {
    deleteClass(cls.id);
    onClose();
    goto('/', { replace: true });
  }
</script>

<Modal onClose={onClose} labelledby="settings-title">
  {#if confirmingDelete}
    <div class="dialog">
      <h2 id="settings-title">Delete {cls.name}?</h2>
      <p class="muted">
        Its {cls.members.length} students and {classPasses(cls.id).length} passes will be gone for good. Download a backup first
        if you might need them.
      </p>
      <div class="dialog-actions">
        <button class="btn" onclick={() => (confirmingDelete = false)}>Cancel</button>
        <button class="btn btn-danger solid" onclick={remove}>Delete class</button>
      </div>
    </div>
  {:else}
    <form class="dialog" onsubmit={save}>
      <h2 id="settings-title">Class settings</h2>
      <label class="field">Class name <input bind:value={name} /></label>
      <p class="muted small">Student PINs are on the <a href="/roster">Roster</a>, for all your classes at once.</p>
      <label class="check">
        <input type="checkbox" bind:checked={takesAttendance} />
        <span>
          Take attendance in this class
          <span class="muted small">
            Students tap their name at the kiosk when they arrive. Arriving after the period starts on your schedule is
            tardy; not arriving at all is absent, and absent students are hidden from the kiosk. This is your own log for
            your class, not your school's official attendance.
          </span>
        </span>
      </label>
      {#if takesAttendance}
        <label class="field">
          Minutes after the period starts before an arrival is tardy
          <input type="number" min="0" bind:value={graceMinutes} />
        </label>
        <label class="field">
          Minutes after class starts before a student who hasn't arrived is absent
          <input type="number" min="1" bind:value={absentAfterMinutes} />
        </label>
      {/if}

      <fieldset class="sees">
        <legend>What students can see</legend>
        <label class="check">
          <input type="checkbox" bind:checked={shows.names} />
          <span>
            Show names on student devices
            <span class="muted small">Watching devices see who's out and who's in line, as the kiosk shows them. Off, only how many.</span>
          </span>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={shows.where} />
          <span>
            Show where students went
            <span class="muted small">Off, every pass is just “Out” at the kiosk and on devices. Lines and limits still work.</span>
          </span>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={shows.lineNames} />
          <span>
            Show who's in line
            <span class="muted small">Off, only how many are waiting. Each student still sees their own place.</span>
          </span>
        </label>
      </fieldset>

      <p class="muted small">When this class is on the kiosk, and its no-pass times, are set in <a href="/schedule">Schedule</a>.</p>
      <div class="dialog-actions" style="justify-content:space-between">
        <button type="button" class="btn btn-danger" onclick={() => (confirmingDelete = true)}>
          <Icon name="trash" size={15} />Delete class
        </button>
        <div class="row">
          <button type="button" class="btn" onclick={onClose}>Cancel</button>
          <button class="btn btn-primary" disabled={!name.trim()}>Save</button>
        </div>
      </div>
    </form>
  {/if}
</Modal>

<style>
  .sees {
    display: grid;
    gap: 12px;
    margin: 0;
    padding: 14px 0 0;
    border: 0;
    border-top: 1px solid var(--border);
  }

  .sees legend {
    padding: 0 0 10px;
    font-size: 14px;
    font-weight: 800;
  }
</style>
