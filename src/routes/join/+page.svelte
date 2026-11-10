<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import BrandMark from '#lib/BrandMark.svelte';

  /**
   * Where students join their class on their own device: they type the Room
   * code their teacher shows on the board or the kiosk, or scan its QR code,
   * which comes straight to /join/<code>. Each class keeps its code, which
   * works only while the class is on. See docs/adr/0023.
   */
  // A link may carry the code as ?code=123456; it's filled in, ready to join.
  let code = $state(page.url.searchParams.get('code') ?? '');
  const digits = $derived(code.replace(/\D/g, ''));

  function join(event: SubmitEvent) {
    event.preventDefault();
    if (digits.length === 6) goto(`/join/${digits}`);
  }
</script>

<svelte:head>
  <title>Join your class · Happy Hallways</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="join">
  <BrandMark size={52} />
  <h1>Join your class</h1>
  <p>Type the code your teacher shows on the board or the kiosk.</p>
  <form onsubmit={join}>
    <input
      class="code"
      inputmode="numeric"
      autocomplete="off"
      maxlength="7"
      placeholder="123 456"
      aria-label="Class code"
      bind:value={code}
    />
    <button class="big" disabled={digits.length !== 6}>Join</button>
  </form>
</main>

<style>
  .join {
    display: grid;
    justify-items: center;
    gap: 14px;
    max-width: 420px;
    margin: 12vh auto 0;
    padding: 0 16px;
    text-align: center;
  }

  h1 {
    font-size: clamp(26px, 6vw, 34px);
  }

  p {
    color: var(--muted);
    font-size: 17px;
  }

  form {
    display: grid;
    gap: 10px;
    width: 100%;
  }

  .code {
    padding: 14px;
    border: 1px solid var(--border);
    border-radius: 14px;
    font: inherit;
    font-size: 32px;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-align: center;
  }

  .big {
    min-height: 52px;
    border: 1px solid var(--accent);
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    font: inherit;
    font-size: 18px;
    font-weight: 800;
    cursor: pointer;
  }

  .big:disabled {
    opacity: 0.5;
    cursor: default;
  }
</style>
