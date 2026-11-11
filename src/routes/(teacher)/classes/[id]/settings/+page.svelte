<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import {
    account,
    asksForPins,
    classPasses,
    deleteClass,
    findClass,
    newClassCode,
    setAsksForPins,
    setVisibility,
    updateClass,
    visibilityOf,
  } from '#lib/account.svelte.ts';
  import ConfirmDialog from '#lib/ConfirmDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import RoomCode from '#lib/RoomCode.svelte';
  import type { ClassVisibility } from '#lib/types.ts';

  /**
   * A class's settings, as a tab beside its Students. Every change saves as
   * it's made, like Pass Options.
   */
  const cls = $derived(findClass(page.params.id ?? ''));
  const shows = $derived(visibilityOf(cls));
  let confirmingDelete = $state(false);
  let confirmingNewCode = $state(false);
  const isOn = $derived(account.activeClass?.id === cls?.id);

  function rename(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const name = input.value.trim();
    if (!cls) return;
    if (name) updateClass(cls.id, { name });
    else input.value = cls.name;
  }

  const seeOptions: { key: keyof ClassVisibility; title: string; text: string }[] = [
    {
      key: 'names',
      title: 'Show names on student devices',
      text: "Devices set up with a first name and PIN see who's out and who's in line, as the kiosk shows them. Off, only how many. Devices that haven't set up only ever get how many.",
    },
    {
      key: 'where',
      title: 'Show where students went',
      text: 'Off, every pass is just “Out” at the kiosk and on devices. Lines and limits still work.',
    },
    {
      key: 'lineNames',
      title: "Show who's in line",
      text: 'Off, only how many are waiting. Each student still sees their own place.',
    },
  ];

  function remove() {
    if (!cls) return;
    deleteClass(cls.id);
    goto('/', { replace: true });
  }
</script>

<svelte:head>
  <title>{cls ? `${cls.name} settings` : 'Class settings'} · Happy Hallways</title>
</svelte:head>

{#if cls}
  <section class="card">
    <label class="field" style="max-width:360px">
      Class name
      <input value={cls.name} onchange={rename} />
    </label>
    <p class="muted small">
      Student PINs are turned on in the <a href="/roster">Roster</a>, and attendance in <a href="/pass-options">Pass Options</a>, for all your classes at once. When this class is on the kiosk,
      and its no-pass times, are set in <a href="/schedule">Schedule</a>.
    </p>
  </section>

  <section class="card" aria-labelledby="pins-title">
    <h2 id="pins-title">PINs</h2>
    <div class="option-row">
      <div>
        <h3>Ask for PINs in this class</h3>
        <p class="muted small">
          {#if account.studentPins}
            Off, students in this class just tap their name, at the kiosk and for “Just arrived?”, and can't set up their own
            device. They keep their PIN for your other classes.
          {:else}
            Student PINs are off for all your classes. Turn them on in the <a href="/roster">Roster</a> first.
          {/if}
        </p>
      </div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          aria-label="Ask for PINs in this class"
          disabled={!account.studentPins}
          checked={asksForPins(cls)}
          onchange={(event) => setAsksForPins(cls.id, event.currentTarget.checked)}
        />
        <span aria-hidden="true"></span>
      </label>
    </div>
  </section>

  {#if cls.code}
    <section class="card" aria-labelledby="code-title">
      <h2 id="code-title">Class code</h2>
      <div class="option-row">
        <div class="code-row">
          <RoomCode code={cls.code} size="small" />
          <p class="muted small">
            Students join this class on their own device with this code. It stays the same, so you can post it, but it
            works only while {cls.name} is on{account.studentLink?.open ? '' : ', with student devices turned on'}.
            {isOn ? 'This class is on now.' : ''}
          </p>
        </div>
        <button class="btn" onclick={() => (confirmingNewCode = true)}><Icon name="history" size={16} />New code</button>
      </div>
    </section>
  {/if}

  <section class="card" aria-labelledby="sees-title">
    <h2 id="sees-title">What students can see</h2>
    {#each seeOptions as option (option.key)}
      <div class="option-row">
        <div>
          <h3>{option.title}</h3>
          <p class="muted small">{option.text}</p>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            role="switch"
            aria-label={option.title}
            checked={shows[option.key]}
            onchange={(event) => setVisibility(cls.id, option.key, event.currentTarget.checked)}
          />
          <span aria-hidden="true"></span>
        </label>
      </div>
    {/each}
  </section>

  <section class="card danger-zone">
    <div class="option-row">
      <div>
        <h2>Delete this class</h2>
        <p class="muted small">Its students and passes are gone for good. Download a backup first if you might need them.</p>
      </div>
      <button class="btn btn-danger" onclick={() => (confirmingDelete = true)}><Icon name="trash" size={15} />Delete class</button>
    </div>
  </section>

  {#if confirmingNewCode}
    <ConfirmDialog
      title="Give {cls.name} a new code?"
      message="The old code stops working for good. Students join with the new one{isOn ? ', and everyone in the class now has to join again and set up their device again' : ''}."
      confirmLabel="New code"
      onConfirm={() => {
        newClassCode(cls.id);
        confirmingNewCode = false;
      }}
      onCancel={() => (confirmingNewCode = false)}
    />
  {/if}

  {#if confirmingDelete}
    <ConfirmDialog
      title="Delete {cls.name}?"
      message="Its {cls.members.length} students and {classPasses(cls.id).length} passes will be gone for good. Download a backup first if you might need them."
      confirmLabel="Delete class"
      danger
      onConfirm={remove}
      onCancel={() => (confirmingDelete = false)}
    />
  {/if}
{/if}

<style>
  .option-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
  }

  .option-row + .option-row,
  h2 + .option-row {
    padding-top: 16px;
  }

  .option-row + .option-row {
    border-top: 1px solid var(--border);
  }

  .option-row p {
    max-width: 60ch;
    margin-top: 3px;
  }

  .code-row {
    display: flex;
    align-items: center;
    gap: 20px;
  }

  .code-row p {
    max-width: 44ch;
  }

  .option-row h3 {
    font-size: 15px;
  }

</style>
