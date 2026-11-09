<script lang="ts">
  import { account, openPasses } from './account.svelte';
  import { activeDoorClass, isLimited, line, perform, setup, startPassFromHome } from './door.svelte';
  import Modal from './Modal.svelte';

  /**
   * The teacher starting a pass for a student, or putting them in a line, from
   * their own computer: for a student with no device, or to let someone go
   * while the destination is full. The teacher's computer is in charge
   * (docs/adr/0014), so no rule holds it back.
   */
  let { onClose }: { onClose: () => void } = $props();

  let studentId = $state('');
  let destination = $state(setup()?.destinations[0]?.label ?? '');

  const cls = $derived(activeDoorClass());
  const outIds = $derived(new Set(openPasses(cls?.id ?? undefined).map((pass) => pass.studentId)));
  const students = $derived((cls?.students ?? []).filter((student) => !outIds.has(student.id)));
  const destinations = $derived((setup()?.destinations ?? []).map((each) => each.label));
  const chosen = $derived(students.find((student) => student.id === studentId));
  /** Only a destination with a limit has a line, and an Always-Go student never waits in one. */
  const canLineUp = $derived(
    !!account.lineEnabled &&
      !!chosen &&
      !chosen.alwaysGo &&
      !line().some((spot) => spot.studentId === chosen.id) &&
      isLimited(destination),
  );

  function start(event: SubmitEvent) {
    event.preventDefault();
    if (!chosen || !destination) return;
    startPassFromHome(chosen.id, destination);
    onClose();
  }

  function lineUp() {
    if (!canLineUp) return;
    perform({ kind: 'join', studentId, destination }, () => {});
    onClose();
  }
</script>

<Modal {onClose} labelledby="start-pass-title">
  <form class="dialog" onsubmit={start}>
    <h2 id="start-pass-title">Start a pass</h2>
    <p class="muted">For a student without a device, or to let someone go even though it's full.</p>
    <label class="field">
      <span>Student</span>
      <select bind:value={studentId}>
        <option value="" disabled>Choose a student</option>
        {#each students as student (student.id)}<option value={student.id}>{student.name}</option>{/each}
      </select>
    </label>
    <label class="field">
      <span>Going to</span>
      <select bind:value={destination}>
        {#each destinations as each (each)}<option value={each}>{each}</option>{/each}
      </select>
    </label>
    <div class="dialog-actions">
      <button type="button" class="btn" onclick={onClose}>Cancel</button>
      {#if account.lineEnabled}
        <button type="button" class="btn" disabled={!canLineUp} onclick={lineUp}>Add to line</button>
      {/if}
      <button class="btn btn-primary" disabled={!chosen || !destination}>Start pass</button>
    </div>
  </form>
</Modal>

