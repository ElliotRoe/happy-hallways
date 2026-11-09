<script lang="ts">
  import Icon from './Icon.svelte';
  import { studentLinkUrl } from './studentLink.svelte';

  /** The Student link's address, with a Copy button, ready to paste into Google Classroom. */
  let copied = $state(false);
  const url = $derived(studentLinkUrl());

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Some browsers only allow copying on secure pages; the address can still be selected and copied by hand.
    }
  }
</script>

<div class="copy-link">
  <input readonly value={url} aria-label="Join link" onfocus={(event) => event.currentTarget.select()} />
  <button class="btn btn-small" onclick={copy}>
    <Icon name={copied ? 'check' : 'copy'} size={14} />{copied ? 'Copied' : 'Copy'}
  </button>
</div>

<style>
  .copy-link {
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .copy-link input {
    min-width: 0;
    padding: 5px 9px;
    font-size: 13px;
    color: var(--muted);
  }

  .copy-link button {
    flex: none;
  }
</style>
