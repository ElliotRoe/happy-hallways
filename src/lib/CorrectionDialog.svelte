<script lang="ts">
  import Modal from './Modal.svelte';
  import { cancelPass, correctPass, setPassNote } from './account.svelte';
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
  // svelte-ignore state_referenced_locally
  let note = $state(pass.note ?? '');
  const cancelled = $derived(pass.cancelledBy === 'teacher');
  let error = $state('');

  function save() {
    if (inAt && inAt < outAt) {
      error = 'The return time must be after the time they left.';
      return;
    }
    const changes = {
      student: studentId !== pass.studentId ? students.find((each) => each.id === studentId) : undefined,
      outAt: outAt !== toInput(pass.outAt) ? new Date(outAt).toISOString() : undefined,
      inAt: inAt && inAt !== toInput(pass.inAt) ? new Date(inAt).toISOString() : undefined,
    };
    // Only a change to who or when is a Correction; a note on its own isn't.
    if (changes.student || changes.outAt || changes.inAt) correctPass(pass.id, changes);
    setPassNote(pass.id, note);
    onClose();
  }

  /** A mis-tap, say: the pass stops counting and the student gets it back. Or, undoing that, it counts again. */
  function toggleCancelled() {
    setPassNote(pass.id, note);
    cancelPass(pass.id, !cancelled);
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
    <label class="field">
      Note (only you see it)
      <textarea rows="2" bind:value={note} placeholder="Went to the office on the way back"></textarea>
    </label>
    <p class="muted small">Changing who or when marks the pass as corrected. A note doesn't.</p>
    <div class="cancel-row">
      {#if cancelled}
        <span class="muted small">Cancelled and given back: it doesn't count toward their passes.</span>
        <button class="btn btn-small" onclick={toggleCancelled}>Count it again</button>
      {:else}
        <span class="muted small">Tapped by mistake? Cancel it, and it no longer counts toward their passes.</span>
        <button class="btn btn-small btn-danger" onclick={toggleCancelled}>Cancel pass, give it back</button>
      {/if}
    </div>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <button class="btn" onclick={onClose}>Cancel</button>
      <button class="btn btn-primary" onclick={save}>Save correction</button>
    </div>
  </div>
</Modal>

<style>
  .cancel-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--border);
  }
</style>
