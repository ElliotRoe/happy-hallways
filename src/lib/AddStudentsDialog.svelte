<script lang="ts">
  import Modal from './Modal.svelte';
  import { account, applyImport, classStudents, rosterCandidates } from './account.svelte';
  import Icon from './Icon.svelte';
  import { planImport, type ImportPlan } from './roster';
  import type { Class } from './types';

  let { cls, onClose }: { cls: Class; onClose: () => void } = $props();

  let pasted = $state('');
  let error = $state('');
  /** Set when some names seem to be students already on the Roster, for the teacher to confirm. */
  let reviewing = $state(null as ImportPlan | null);
  /** The Roster matches the teacher says are the same student. All of them, unless they untick one. */
  let confirmed = $state(new Set<string>());
  /** Students whose PIN the teacher agreed to change to the one in the list. None, unless they tick one. */
  let acceptPins = $state(new Set<string>());

  /**
   * Adds everyone new in the list. Students already in the class are kept as
   * they are, and nobody is ever removed from here: that's on the Students page.
   * A name that seems to be someone already on the Roster is asked about first.
   */
  function add() {
    const plan = planImport(pasted, classStudents(cls), account.pin, rosterCandidates(cls.id));
    if (plan.error) {
      error = plan.error;
      return;
    }
    const matches = plan.added.filter((entry) => entry.rosterMatch);
    if (matches.length || plan.pinChanges.length) {
      acceptPins = new Set();
      confirmed = new Set(matches.map((entry) => entry.rosterMatch!.studentId));
      reviewing = plan;
      return;
    }
    applyImport(cls.id, plan, []);
    onClose();
  }

  function togglePin(studentId: string, on: boolean) {
    const next = new Set(acceptPins);
    if (on) next.add(studentId);
    else next.delete(studentId);
    acceptPins = next;
  }

  /** Students the teacher didn't confirm join as new students instead. */
  function addReviewed() {
    if (!reviewing) return;
    const added = reviewing.added.map((entry) =>
      entry.rosterMatch && !confirmed.has(entry.rosterMatch.studentId) ? { ...entry, rosterMatch: undefined } : entry,
    );
    applyImport(cls.id, { ...reviewing, added }, [], acceptPins);
    onClose();
  }

  function toggle(studentId: string, on: boolean) {
    const next = new Set(confirmed);
    if (on) next.add(studentId);
    else next.delete(studentId);
    confirmed = next;
  }

  async function readFile(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    pasted = await file.text();
    add();
  }
</script>

<Modal onClose={onClose} labelledby="add-title">
  <div class="dialog" style="width:min(560px,100%)">
    <div class="dialog-head">
      <div>
        <p class="eyebrow">{cls.name}</p>
        <h2 id="add-title">Add students</h2>
      </div>
      <button class="btn btn-small btn-quiet" onclick={onClose} aria-label="Close"><Icon name="x" size={16} /></button>
    </div>
    {#if reviewing}
      {#if reviewing.added.some((entry) => entry.rosterMatch)}
      <p>Some of these students are already in your other classes. Is each one the same student?</p>
      <p class="muted small">The same student shares one PIN, one Pass Allowance and one history across your classes.</p>
      {/if}
      <ul class="matches">
        {#each reviewing.added.filter((entry) => entry.rosterMatch) as entry (entry.rosterMatch!.studentId)}
          {@const match = entry.rosterMatch!}
          <li>
            <label class="check">
              <input
                type="checkbox"
                checked={confirmed.has(match.studentId)}
                onchange={(event) => toggle(match.studentId, event.currentTarget.checked)}
              />
              <span>
                <strong>{entry.firstName} {entry.lastName}</strong> is the same student as {match.label}
              </span>
            </label>
          </li>
        {/each}
      </ul>
      {#if reviewing.pinChanges.length}
        <p>Your list has a different PIN for some students who already have one. Change theirs?</p>
        <ul class="matches">
          {#each reviewing.pinChanges as change (change.studentId)}
            <li>
              <label class="check">
                <input type="checkbox" checked={acceptPins.has(change.studentId)} onchange={(event) => togglePin(change.studentId, event.currentTarget.checked)} />
                <span>Change <strong>{change.name}</strong>'s PIN from {change.from} to {change.to}</span>
              </label>
            </li>
          {/each}
        </ul>
      {/if}
      <div class="row">
        <button class="btn btn-primary" onclick={addReviewed}>Add students</button>
        <button class="btn" onclick={() => (reviewing = null)}>Back</button>
      </div>
    {:else}
    <p class="muted small">
      Paste a list, one student per line, or choose a CSV. Full names stay on this computer. The kiosk and the Student
      link only ever show a first name plus the fewest letters of the last name it takes to tell students apart.
    </p>
    {#if account.studentPins}
      <p class="muted small">
        Each new student gets a PIN for the kiosk. To choose them yourself, put 3 to 6 digits at the end of each line, like
        <code>Maya Chen, 4821</code>. Make them up; don't use real student ID numbers.
      </p>
    {/if}
    <textarea aria-label="One student per line" bind:value={pasted} oninput={() => (error = '')} rows="7" placeholder={'Maya Chen\nJordan Ellis'}></textarea>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div class="row">
      <button class="btn btn-primary" onclick={add} disabled={!pasted.trim()}>Add students</button>
      <label class="btn">
        <Icon name="upload" size={16} />Choose a CSV
        <input class="sr-only" type="file" accept=".csv,text/csv,text/plain" onchange={readFile} />
      </label>
    </div>
    {/if}
  </div>
</Modal>

<style>
  .matches {
    display: grid;
    gap: 8px;
    margin: 0 0 12px;
    padding: 0;
    list-style: none;
  }
</style>
