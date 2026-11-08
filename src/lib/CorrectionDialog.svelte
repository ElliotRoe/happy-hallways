<script lang="ts">
  import Modal from './Modal.svelte';
  import { correctPass } from './account.svelte';
  import { displayName } from './roster';
  import type { ClassStudent, Pass } from './types';

  let { pass, students, onClose }: { pass: Pass; students: ClassStudent[]; onClose: () => void } = $props();

  /** <input type="datetime-local"> speaks local time without a zone; storage is ISO. */
  function toInput(value?: string) {
    if (!value) return '';
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let studentId = $state(pass.studentId);
  // svelte-ignore state_referenced_locally
  let outAt = $state(toInput(pass.outAt));
  // svelte-ignore state_referenced_locally
  let inAt = $state(toInput(pass.inAt));
  let error = $state('');

  function save() {
    if (inAt && inAt < outAt) {
      error = 'The return time must be after the time they left.';
      return;
    }
    correctPass(pass.id, {
      student: studentId !== pass.studentId ? students.find((each) => each.id === studentId) : undefined,
      outAt: outAt !== toInput(pass.outAt) ? new Date(outAt).toISOString() : undefined,
      inAt: inAt && inAt !== toInput(pass.inAt) ? new Date(inAt).toISOString() : undefined,
    });
    onClose();
  }
</script>

<Modal onClose={onClose} labelledby="correct-title">
  <div class="dialog">
    <div class="dialog-head">
      <div>
        <p class="eyebrow">Correct a pass</p>
        <h2 id="correct-title">{pass.studentName} · {pass.destination}</h2>
      </div>
    </div>
    <label class="field">
      Student
      <select bind:value={studentId}>
        {#each students as student (student.id)}
          <option value={student.id}>{displayName(student)}{student.status === 'former' ? ' (former)' : ''}</option>
        {/each}
      </select>
    </label>
    <label class="field">Left <input type="datetime-local" bind:value={outAt} /></label>
    <label class="field">Came back <input type="datetime-local" bind:value={inAt} /></label>
    <p class="muted small">The pass will be marked as corrected.</p>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <button class="btn" onclick={onClose}>Cancel</button>
      <button class="btn btn-primary" onclick={save}>Save correction</button>
    </div>
  </div>
</Modal>
