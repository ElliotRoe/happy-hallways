<script lang="ts">
  import { goto } from '$app/navigation';
  import Modal from './Modal.svelte';
  import { classPasses, deleteClass, updateClass } from './account.svelte';
  import Icon from './Icon.svelte';
  import type { Class } from './types';

  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let name = $state(cls.name);
  let confirmingDelete = $state(false);

  function save(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    updateClass(cls.id, { name: name.trim() });
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
