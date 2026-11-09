<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { account, markPopupsSeen } from './account.svelte';
  import Modal from './Modal.svelte';
  import { news, popupNamed, unseenNews, type News } from './popups';
  import UpdateArt from './UpdateArt.svelte';

  /**
   * Shows news Popups. Closing one in any way counts as having seen it.
   * `?popup=<id>` shows one again, and `?popup=news` every piece of news, as
   * the Help menu offers.
   */
  let asked = $state(page.url.searchParams.get('popup'));
  // Arriving with ?popup= shows it once; drop it from the address so a reload doesn't.
  $effect(() => {
    const wanted = page.url.searchParams.get('popup');
    if (!wanted) return;
    asked = wanted;
    const url = new URL(page.url.href);
    url.searchParams.delete('popup');
    replaceState(url, {});
  });


  const shownNews = $derived.by((): News[] => {
    if (asked === 'news') return [...news].reverse();
    const one = asked ? popupNamed(asked) : null;
    if (one && 'items' in one) return [one];
    return [...unseenNews(account.seenPopups)].reverse();
  });

  // News waits while another dialog is open, so it never stacks on top of one,
  // and shows once that dialog closes.
  let otherDialogOpen = $state(false);
  $effect(() => {
    if (!shownNews.length) return;
    const check = () => {
      otherDialogOpen = document.querySelector('[aria-modal="true"]:not([aria-labelledby="whats-changed-title"])') !== null;
    };
    check();
    const timer = setInterval(check, 400);
    return () => clearInterval(timer);
  });

  function closeNews() {
    markPopupsSeen(shownNews.map((each) => each.id));
    asked = null;
  }

  function act(href: string) {
    closeNews();
    goto(href);
  }

</script>

{#if shownNews.length && !otherDialogOpen}
  <Modal onClose={closeNews} labelledby="whats-changed-title">
    <div class="dialog whats-changed">
      <div>
        <p class="eyebrow">What's changed</p>
        <h2 id="whats-changed-title">Thank you for all your feedback</h2>
        <p class="muted">Here's what's new in Happy Hallways.</p>
      </div>

      {#each shownNews as update (update.id)}
        <section class="update">
          {#if shownNews.length > 1}<p class="eyebrow">{update.title}</p>{/if}
          <ol class="changes">
            {#each update.items as item (item.title)}
              <li class:compact={!item.art}>
                <div>
                  <h3>{item.title}</h3>
                  <p class="muted">
                    {item.text}
                    {#if item.link}<a class="go" href={item.link.href} onclick={closeNews}>{item.link.label} →</a>{/if}
                  </p>
                </div>
                {#if item.art}<UpdateArt art={item.art} />{/if}
              </li>
            {/each}
          </ol>
          {#if update.also}<p class="muted small also"><strong>Also:</strong> {update.also}</p>{/if}
          {#if shownNews.length > 1 && update.action}
            {@const action = update.action}
            <div><button class="btn" onclick={() => act(action.href)}>{action.label}</button></div>
          {/if}
        </section>
      {/each}

      <div class="dialog-actions">
        {#if shownNews.length === 1 && shownNews[0].action}
          {@const action = shownNews[0].action}
          <button class="btn" onclick={() => act(action.href)}>{action.label}</button>
        {/if}
        <button class="btn btn-primary" onclick={closeNews}>Got it</button>
      </div>
    </div>
  </Modal>
{/if}

<style>
  .whats-changed {
    width: min(860px, 100%);
    max-height: calc(100vh - 32px);
    overflow-y: auto;
  }

  .update {
    display: grid;
    gap: 14px;
  }

  .update + .update {
    padding-top: 22px;
    border-top: 2px solid var(--border-strong);
  }

  .changes {
    display: grid;
    gap: 16px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .changes li {
    display: grid;
    grid-template-columns: 1fr minmax(0, 260px);
    align-items: center;
    gap: 28px;
    padding-top: 16px;
    border-top: 1px solid var(--border);
  }

  /* A change without a drawing: a short row, so a long list still fits on a laptop. */
  .changes li.compact {
    grid-template-columns: 1fr;
    padding-top: 12px;
  }

  .changes li.compact h3 {
    margin-bottom: 2px;
    font-size: 16px;
  }

  .changes li.compact p {
    margin: 0;
  }

  .go {
    margin-left: 4px;
    font-weight: 700;
    white-space: nowrap;
  }

  .also {
    margin: 0;
  }

  h3 {
    margin-bottom: 6px;
    font-size: 18px;
  }

  @media (max-width: 640px) {
    .changes li {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }
</style>
