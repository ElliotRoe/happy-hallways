<script lang="ts">
  import Modal from './Modal.svelte';
  import { account, classStudents, renameStudent, setAlwaysGo, setExempt, setStudentPin } from './account.svelte';
  import { pinProblem } from './pins';
  import { displayName, maxPrefix } from './roster';
  import type { Student } from './types';

  /**
   * Edits one student on the Roster: their name, PIN and whether they can
   * always go or are exempt apply in every class; the letters shown are set
   * per class, since they only need to tell classmates apart. See docs/adr/0015.
   */
  let { student, onClose }: { student: Student; onClose: () => void } = $props();

  const memberships = $derived(
    account.classes.flatMap((cls) => {
      const member = cls.members.find((each) => each.studentId === student.id && each.status === 'current');
      return member ? [{ cls, lastPrefix: member.lastPrefix }] : [];
    }),
  );

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let firstName = $state(student.firstName);
  // svelte-ignore state_referenced_locally
  let lastName = $state(student.lastName ?? '');
  // svelte-ignore state_referenced_locally
  let prefixes = $state(Object.fromEntries(memberships.map(({ cls, lastPrefix }) => [cls.id, lastPrefix])) as Record<string, string>);
  // svelte-ignore state_referenced_locally
  let exempt = $state(!!student.exempt);
  // svelte-ignore state_referenced_locally
  let alwaysGo = $state(!!student.alwaysGo);
  // svelte-ignore state_referenced_locally
  let pin = $state(student.pin ?? '');
  let error = $state('');

  /** The same rule the import enforces: no two students may look alike at the kiosk, in any of their classes. */
  function save(event: SubmitEvent) {
    event.preventDefault();
    const first = firstName.trim();
    if (!first) {
      error = 'A first name is needed.';
      return;
    }
    for (const { cls } of memberships) {
      const name = displayName({ firstName: first, lastPrefix: (prefixes[cls.id] ?? '').trim().slice(0, maxPrefix) }).toLowerCase();
      const clash = classStudents(cls).find(
        (other) => other.id !== student.id && other.status === 'current' && displayName(other).toLowerCase() === name,
      );
      if (clash) {
        error = `${displayName(clash)} is already in ${cls.name}. Add a letter or use a nickname.`;
        return;
      }
    }
    const newPin = pin.trim();
    if (account.studentPins && newPin !== student.pin) {
      // A student has one PIN in every class, so it must differ from everyone's on the Roster.
      const others = account.roster.filter((other) => other.id !== student.id).map((other) => other.pin);
      error = pinProblem(newPin, others, account.pin);
      if (error) return;
      setStudentPin(student.id, newPin);
    }
    for (const { cls } of memberships) {
      renameStudent(cls.id, student.id, first, (prefixes[cls.id] ?? '').trim().slice(0, maxPrefix), lastName.trim());
    }
    if (exempt !== !!student.exempt) setExempt(student.id, exempt);
    if (alwaysGo !== !!student.alwaysGo) setAlwaysGo(student.id, alwaysGo);
    onClose();
  }
</script>

<Modal onClose={onClose} labelledby="edit-title">
  <form class="dialog" onsubmit={save}>
    <h2 id="edit-title">Edit {student.firstName} {student.lastName ?? ''}</h2>
    <label class="field">First name or nickname <input bind:value={firstName} /></label>
    <label class="field">
      Last name
      <input bind:value={lastName} autocomplete="off" />
      <span class="muted small">Kept only on this computer. The kiosk never shows it.</span>
    </label>
    {#each memberships as { cls } (cls.id)}
      <label class="field">
        Letters of the last name to show in {cls.name} (up to {maxPrefix})
        <input bind:value={prefixes[cls.id]} maxlength={maxPrefix} />
      </label>
    {/each}
    {#if account.studentPins}
      <label class="field">
        PIN (3 to 6 digits, the same in every class)
        <input bind:value={pin} inputmode="numeric" autocomplete="off" maxlength="6" />
      </label>
    {/if}
    <label class="check">
      <input type="checkbox" bind:checked={alwaysGo} />
      <span>
        Can always go (medical / IEP / 504)
        <span class="muted small">
          Nothing at the kiosk ever holds them back: no Pass Allowance, limit, line or no-pass time. They never take
          another student's spot. Every trip is still recorded and marked in History.
        </span>
      </span>
    </label>
    <!-- Can always go includes this, so it shows ticked while that is; their own choice here comes back if it's unticked. -->
    <label class="check">
      <input
        type="checkbox"
        checked={exempt || alwaysGo}
        disabled={alwaysGo}
        onchange={(event) => (exempt = event.currentTarget.checked)}
      />
      <span>
        Exempt from the Pass Allowance only
        <span class="muted small">
          {#if alwaysGo}
            Included, because they can always go.
          {:else}
            They never run out of passes, but still wait for a free spot and for no-pass time to end, like everyone
            else. Every trip is still recorded.
            {#if !account.passAllowance.enabled}The Pass Allowance is off in Pass Options right now.{/if}
          {/if}
        </span>
      </span>
    </label>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div class="dialog-actions">
      <button type="button" class="btn" onclick={onClose}>Cancel</button>
      <button class="btn btn-primary">Save</button>
    </div>
  </form>
</Modal>

