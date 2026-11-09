<script lang="ts">
  import SettingsTabs from '#lib/SettingsTabs.svelte';
  import { account, exportAccount, importAccount } from '#lib/account.svelte.ts';
  import Modal from '#lib/Modal.svelte';
  import { dayKey, shortDate } from '#lib/passes.ts';
  import { download } from '#lib/csv.ts';
  import Icon from '#lib/Icon.svelte';
  import { leaveTo } from '#lib/leaving.ts';
  import { onboarding, updateOnboarding } from '#lib/onboarding.svelte.ts';

  let pending = $state('');
  let error = $state('');

  const daysSinceExport = $derived(
    account.lastExportedAt ? Math.floor((Date.now() - new Date(account.lastExportedAt).getTime()) / 86_400_000) : null,
  );

  function exportFile() {
    download(`happy-hallways-${dayKey(new Date())}.json`, exportAccount(), 'application/json');
  }

  async function chooseFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    error = '';
    own = null;
    pending = await file.text();
  }

  /** Whether the backup is the teacher's own, from another computer, or a colleague's. The teacher must say. */
  let own = $state<boolean | null>(null);

  function replaceEverything() {
    try {
      if (own === null) return;
      importAccount(pending, own);
      // Start fresh so the kiosk connection picks up the imported pairing.
      leaveTo('/');
    } catch (problem) {
      error = problem instanceof Error ? problem.message : 'That file could not be read.';
      pending = '';
    }
  }
</script>

<div class="page">
  <SettingsTabs />
  <header class="page-head">
    <div>
      <p class="eyebrow">Settings</p>
      <h1>Your data</h1>
      <p class="muted">
        Happy Hallways has no sign-in. Everything it knows lives in this browser on this computer, and if the browser's data
        is cleared, it's gone. Download a backup now and then.
      </p>
    </div>
  </header>

  <section class="card">
    <div class="card-head">
      <div>
        <p class="eyebrow">Backup</p>
        <h2>Download a backup</h2>
        <p class="muted small">
          One file with every class, student, pass, destination, your pass options and your kiosk pairing. It holds your
          students' full names, so keep it somewhere only you can open.
          {#if account.lastExportedAt}
            Last backed up {daysSinceExport === 0 ? 'today' : `${shortDate(account.lastExportedAt)}, ${daysSinceExport} ${daysSinceExport === 1 ? 'day' : 'days'} ago`}.
          {:else}
            No backup yet.
          {/if}
        </p>
      </div>
      <button class="btn btn-primary" onclick={exportFile}><Icon name="download" size={16} />Download backup</button>
    </div>
    {#if daysSinceExport === null || daysSinceExport > 7}
      <div class="notice-bar"><Icon name="alert-triangle" />It's been a while. A backup is the only copy outside this browser.</div>
    {/if}
  </section>

  <section class="card">
    <div class="card-head">
      <div>
        <p class="eyebrow">Restore</p>
        <h2>Restore from a backup</h2>
        <p class="muted small">
          Replaces everything in this browser with the file, including the kiosk pairing, so you're back exactly where
          you were. Use it on a new computer, or to undo a mistake.
        </p>
      </div>
      <label class="btn">
        <Icon name="upload" size={16} />Choose backup file
        <input class="sr-only" type="file" accept=".json,application/json" onchange={chooseFile} />
      </label>
    </div>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  </section>


  <section class="card">
    <div>
      <p class="eyebrow">Getting started</p>
      <h2>Help getting set up</h2>
    </div>
    <label class="check">
      <input
        type="checkbox"
        checked={onboarding.showChecklist}
        onchange={(event) => updateOnboarding({ showChecklist: event.currentTarget.checked })}
      />
      Show the getting-started checklist
    </label>
    <div><a class="btn" href="/welcome/tour"><Icon name="circle-play" size={16} />Replay the welcome tour</a></div>
  </section>
</div>

{#if pending}
  <Modal onClose={() => (pending = '')} labelledby="replace-title">
    <div class="dialog">
      <h2 id="replace-title">Replace everything?</h2>
      <p class="muted">
        All the classes, students and passes in this browser will be replaced by the ones in the file. Anything not in
        the file will be lost.
      </p>
      <fieldset class="whose">
        <legend>Whose backup is this?</legend>
        <label class="check"><input type="radio" bind:group={own} value={true} />My own, from another computer (keeps my kiosk paired)</label>
        <label class="check"><input type="radio" bind:group={own} value={false} />Someone else's (set up my own kiosk and student devices again)</label>
      </fieldset>
      <div class="dialog-actions">
        <button class="btn" onclick={() => (pending = '')}>Cancel</button>
        <button class="btn btn-danger solid" onclick={replaceEverything} disabled={own === null}>Replace everything</button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 600;
    cursor: pointer;
  }

  .check input {
    width: 18px;
    height: 18px;
    margin: 0;
    accent-color: var(--accent);
  }

  .whose {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .whose legend {
    margin-bottom: 6px;
    font-weight: 700;
  }
</style>
