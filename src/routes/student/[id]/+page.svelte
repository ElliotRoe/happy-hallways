<script lang="ts">
  import BrandMark from '#lib/BrandMark.svelte';

  /** Lasting student links were replaced by a Room code for each class period (docs/adr/0019). */
</script>

<svelte:head>
  <title>Join your class · Happy Hallways</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="moved">
  <BrandMark size={52} />
  <h1>This link doesn't work any more</h1>
  <p>Your class now has a short code, new each class. Look for it on the board or the kiosk.</p>
  <a class="big" href="/join">Type the code</a>
</main>

<style>
  .moved {
    display: grid;
    justify-items: center;
    gap: 14px;
    max-width: 420px;
    margin: 12vh auto 0;
    padding: 0 16px;
    text-align: center;
  }

  p {
    color: var(--muted);
    font-size: 17px;
  }

  .big {
    padding: 14px 22px;
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    font-weight: 800;
    text-decoration: none;
  }
</style>
