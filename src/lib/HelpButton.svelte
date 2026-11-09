<script lang="ts">
  import Icon from './Icon.svelte';
  import Modal from './Modal.svelte';
  import { supportEmail, supportMailto } from './support';

  /** The one way to reach a person: on every page, out of the way, saying one thing. */
  let open = $state(false);
</script>

<button class="help-button" aria-label="Help" aria-haspopup="dialog" title="Help" onclick={() => (open = true)}>
  <Icon name="help" size={22} />
</button>

{#if open}
  <Modal onClose={() => (open = false)} labelledby="help-title">
    <section class="dialog" style="width:min(440px,100%)">
      <div class="dialog-head">
        <h2 id="help-title">Need a hand?</h2>
        <button class="btn btn-small btn-quiet" aria-label="Close help" onclick={() => (open = false)}>
          <Icon name="x" size={16} />
        </button>
      </div>
      <p>
        Step-by-step help is in the <a href="/guides">Guides</a>.
      </p>
      <p>
        <a href="?popup=news" onclick={() => (open = false)}>See what's changed</a>
      </p>
      <p>
        If you're running into trouble or have suggestions, email us at
        <a href={supportMailto('Happy Hallways')}>{supportEmail}</a>.
      </p>
    </section>
  </Modal>
{/if}

<style>
  .help-button {
    display: inline-grid;
    place-items: center;
    flex: none;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: transparent;
    color: var(--faint);
    cursor: pointer;
  }

  .help-button:hover,
  .help-button:focus-visible {
    background: var(--accent-wash);
    color: var(--accent);
  }

  p {
    font-size: 15px;
    line-height: 1.6;
  }

  a {
    font-weight: 700;
    text-underline-offset: 4px;
  }
</style>
