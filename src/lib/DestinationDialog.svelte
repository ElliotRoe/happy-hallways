<script lang="ts">
  import Modal from './Modal.svelte';
  import { account, deleteDestination, saveDestination } from './account.svelte';
  import { destinationColors, iconMatchesSearch, type DestinationColor, type DestinationIcon } from './destinations';
  import { destinationIconGroups } from './icons';
  import Icon from './Icon.svelte';
  import { newId } from './passes';
  import type { Destination } from './types';

  /** Edits one destination, or creates one when `destination` is null. */
  let { destination, onClose }: { destination: Destination | null; onClose: () => void } = $props();

  // The dialog edits a copy; nothing changes until Save.
  // svelte-ignore state_referenced_locally
  let label = $state(destination?.label ?? '');
  // A number field hands back a number, or null while it's empty.
  // svelte-ignore state_referenced_locally
  let minutes = $state<number | null>(destination?.minutes ?? null);
  // svelte-ignore state_referenced_locally
  let color = $state<DestinationColor>(destination?.color ?? 'green');
  // svelte-ignore state_referenced_locally
  let icon = $state<DestinationIcon>(destination?.icon ?? 'map-pin');
  // svelte-ignore state_referenced_locally
  let counts = $state(destination?.countsTowardAllowance !== false);
  // A new destination starts at one at a time; the teacher opens it up for places like the Nurse.
  // svelte-ignore state_referenced_locally
  let studentLimit = $state<number | null>(destination ? destination.limit : 1);
  // svelte-ignore state_referenced_locally
  let countsTowardClass = $state(destination?.countsTowardClassLimit !== false);
  // svelte-ignore state_referenced_locally
  let isPrivate = $state(!!destination?.private);
  /** Only the way limits work now is shown; the other way's setting is kept for if the teacher switches back. */
  const hasClassLimit = $derived(account.limitMode === 'class');
  const limitChoices = $derived([...new Set([1, 2, 3, 4, 5, 6, ...(studentLimit ? [studentLimit] : [])])].sort((a, b) => a - b));
  let error = $state('');

  const colorNames = Object.keys(destinationColors) as DestinationColor[];

  let iconSearch = $state('');
  const iconGroups = $derived(
    Object.entries(destinationIconGroups)
      .map(([group, names]) => ({ group, names: names.filter((name) => iconMatchesSearch(name, iconSearch)) }))
      .filter((entry) => entry.names.length),
  );

  function save(event: SubmitEvent) {
    event.preventDefault();
    const name = label.trim();
    const limit = typeof minutes === 'number' && !Number.isNaN(minutes) ? Math.round(minutes) : null;
    if (!name) {
      error = 'Give the destination a name.';
      return;
    }
    if (account.destinations.some((each) => each.id !== destination?.id && each.label.toLowerCase() === name.toLowerCase())) {
      error = `There's already a destination called ${name}.`;
      return;
    }
    if (limit !== null && !(limit >= 1 && limit <= 120)) {
      error = 'Minutes should be between 1 and 120, or left empty for no time limit.';
      return;
    }
    // A Private destination never has a limit or a line (docs/adr/0021).
    const saved: Destination = { id: destination?.id ?? newId(), label: name, minutes: limit, color, icon, limit: isPrivate ? null : studentLimit };
    if (!counts) saved.countsTowardAllowance = false;
    if (!countsTowardClass || isPrivate) saved.countsTowardClassLimit = false;
    if (isPrivate) saved.private = true;
    saveDestination(saved);
    onClose();
  }

  function remove() {
    if (destination) deleteDestination(destination.id);
    onClose();
  }
</script>

<Modal onClose={onClose} labelledby="destination-title">
  <form class="dialog destination-dialog" style="width:min(880px,100%)" onsubmit={save}>
    <div class="dialog-head">
      <h2 id="destination-title">{destination ? `Edit ${destination.label}` : 'New destination'}</h2>
      <span
        class="destination-icon"
        style:width="44px"
        style:height="44px"
        style:background={destinationColors[color].soft}
        style:color={destinationColors[color].strong}
        aria-hidden="true"
      >
        <Icon name={icon} size={24} />
      </span>
    </div>

    <div class="dest-cols">
      <div class="dest-look">
        <label class="field">Name <input bind:value={label} placeholder="Library" /></label>
        <div class="field">
          <span>Color</span>
          <div class="swatches" role="group" aria-label="Color">
            {#each colorNames as name (name)}
              <button
                type="button"
                class="swatch"
                style:background={destinationColors[name].strong}
                aria-label={name}
                aria-pressed={color === name}
                onclick={() => (color = name)}
              ></button>
            {/each}
          </div>
        </div>
        <div class="field icon-field">
          <span>Icon</span>
          <input type="search" placeholder="Search icons, e.g. water, book, bus" bind:value={iconSearch} aria-label="Search icons" />
          <div class="icon-groups">
            {#each iconGroups as entry (entry.group)}
              <p class="eyebrow">{entry.group}</p>
              <div class="icon-choices" role="group" aria-label={entry.group}>
                {#each entry.names as name (name)}
                  <button
                    type="button"
                    class="icon-choice"
                    style:color={icon === name ? destinationColors[color].strong : ''}
                    title={name.replaceAll('-', ' ')}
                    aria-label={name.replaceAll('-', ' ')}
                    aria-pressed={icon === name}
                    onclick={() => (icon = name)}
                  >
                    <Icon {name} size={20} />
                  </button>
                {/each}
              </div>
            {:else}
              <p class="muted small">No icons match "{iconSearch}".</p>
            {/each}
          </div>
        </div>
      </div>
      <div class="dest-rules">
        <label class="field">
          Minutes the trip should take (optional)
          <input type="number" min="1" max="120" bind:value={minutes} placeholder="No time limit" style="max-width:160px" />
          <span class="muted small" style="font-weight:500">Leave it empty if this trip has no time limit. It'll never show as overdue.</span>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={counts} />
          <span>
            Counts toward the Pass Allowance
            <span class="muted small">Untick for trips that shouldn't use up a student's passes, like the Nurse.</span>
          </span>
        </label>
        <label class="check">
          <input type="checkbox" bind:checked={isPrivate} />
          <span>
            Private
            <span class="muted small">
              Students see someone is out, not where. No limit or line.
            </span>
          </span>
        </label>
        {#if isPrivate}
          <!-- No limit or line to set: a line would show the room who's going here. -->
        {:else if hasClassLimit}
          <label class="check">
            <input type="checkbox" bind:checked={countsTowardClass} />
            <span>
              Counts toward the class limit
              <span class="muted small">
                Untick for places like the Nurse or the Counselor, so students going there never wait, however many are out.
              </span>
            </span>
          </label>
        {:else}
          <label class="field">
            Students here at once
            <select
              value={studentLimit === null ? '' : String(studentLimit)}
              onchange={(event) => (studentLimit = event.currentTarget.value ? Number(event.currentTarget.value) : null)}
              style="max-width:160px"
            >
              <option value="">No limit</option>
              {#each limitChoices as option (option)}<option value={String(option)}>{option} at a time</option>{/each}
            </select>
            <span class="muted small" style="font-weight:500">
              Once it's full, the next student waits, or joins this destination's line if lines are on in Pass Options.
              Choose “No limit” for places like the Nurse, so nobody has to wait.
            </span>
          </label>
        {/if}
      </div>
    </div>

    {#if error}<p class="form-error" role="alert">{error}</p>{/if}

    <div class="dialog-actions" style="justify-content:space-between">
      {#if destination}
        <button type="button" class="btn btn-danger" onclick={remove}><Icon name="trash" size={15} />Delete</button>
      {:else}
        <span></span>
      {/if}
      <div class="row">
        <button type="button" class="btn" onclick={onClose}>Cancel</button>
        <button class="btn btn-primary">Save</button>
      </div>
    </div>
  </form>
</Modal>

<style>
  /* What it looks like on the left; how passes there work on the right. */
  .dest-cols {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 28px;
    min-height: 0;
  }

  /* Lets the icon list, not the whole dialog, scroll on a short screen. */
  :global(.destination-dialog) > .dest-cols {
    flex: 0 1 auto;
  }

  .dest-look,
  .dest-rules {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-height: 0;
  }

  .dest-look > :global(*),
  .dest-rules > :global(*) {
    flex: none;
  }

  .dest-look > :global(.icon-field) {
    flex: 0 1 auto;
    display: flex;
    flex-direction: column;
    min-height: 220px;
  }

  .dest-rules {
    padding-left: 28px;
    border-left: 1px solid var(--border);
  }

  @media (max-width: 720px) {
    .dest-cols {
      grid-template-columns: minmax(0, 1fr);
    }

    .dest-rules {
      padding-left: 0;
      border-left: 0;
    }
  }
</style>
