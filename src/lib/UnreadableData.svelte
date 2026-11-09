<script lang="ts">
  import { unreadable } from './account.svelte';
  import { download } from './csv';
  import Icon from './Icon.svelte';
  import { supportEmail, supportMailto } from './support';

  /**
   * Shown instead of the app when the saved Account couldn't be read. Nothing
   * is saved over it; the teacher downloads it and sends it to us.
   */
  function save() {
    download(`happy-hallways-unreadable-${new Date().toISOString().slice(0, 10)}.json`, unreadable.raw ?? '', 'application/json');
  }
</script>

<main class="unreadable">
  <div class="card">
    <h1>We couldn't read your Happy Hallways data</h1>
    <p>
      Your classes and passes are still saved in this browser, and nothing will change them until this is fixed. Please
      download a copy and email it to us at <a href={supportMailto('Happy Hallways: data could not be read')}>{supportEmail}</a>.
      We'll get you back where you were.
    </p>
    <div class="row">
      <button class="btn btn-primary" onclick={save}><Icon name="download" size={16} />Download my data</button>
      <a class="btn" href={supportMailto('Happy Hallways: data could not be read')}><Icon name="mail" size={16} />Email support</a>
    </div>
    {#if unreadable.error}<p class="muted small">What went wrong: {unreadable.error}</p>{/if}
  </div>
</main>

<style>
  .unreadable {
    display: grid;
    min-height: 100vh;
    padding: 24px;
    place-items: center;
  }

  .card {
    max-width: 560px;
  }
</style>
