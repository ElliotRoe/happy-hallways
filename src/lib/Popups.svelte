<script lang="ts">
  import { goto, replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { account, markPopupsSeen } from './account.svelte';
  import Modal from './Modal.svelte';
  import { news, popupNamed, unseenNews, type News } from './popups';
  import NewsThumb from './NewsThumb.svelte';
  import UpdateArt from './UpdateArt.svelte';
  import { supportEmail, supportMailto } from './support';

  /**
   * Shows news Popups. Closing one in any way counts as having seen it.
   * `?popup=<id>` shows one again, and `?popup=news` every piece of news, as
   * the Help menu offers. `?whats-new` previews the newest news without
   * counting it as seen, to look at it before it goes out.
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


  let preview = $state(page.url.searchParams.has('whats-new'));
  $effect(() => {
    if (!page.url.searchParams.has('whats-new')) return;
    preview = true;
    const url = new URL(page.url.href);
    url.searchParams.delete('whats-new');
    replaceState(url, {});
  });

  /** A closed preview stays closed until the page reloads, though it was never counted as seen. */
  let previewClosed = $state(false);

  const shownNews = $derived.by((): News[] => {
    if (preview) return news.slice(-1);
    if (previewClosed) return [];
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
    // A preview leaves it unseen, so it still shows when it goes out.
    if (!preview) markPopupsSeen(shownNews.map((each) => each.id));
    else previewClosed = true;
    preview = false;
    asked = null;
  }

  /** The note, with the support email as a link to write to it. */
  function noteParts(note: string) {
    const [before, ...rest] = note.split(supportEmail);
    return { before, after: rest.join(supportEmail), hasEmail: rest.length > 0 };
  }

  /** News that thanks teachers leads with its own title and thank-you. */
  const lead = $derived(shownNews.length === 1 && shownNews[0].thanks ? shownNews[0] : null);

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
        {#if lead}
          <h2 id="whats-changed-title">{lead.title}</h2>
          <p class="thanks">{lead.thanks}</p>
        {:else}
          <h2 id="whats-changed-title">Thank you for all your feedback</h2>
          <p class="muted">Here's what's new in Happy Hallways.</p>
        {/if}
      </div>

      {#each shownNews as update (update.id)}
        <section class="update">
          {#if shownNews.length > 1}<p class="eyebrow">{update.title}</p>{/if}
          {#if update.thanks && !lead}<p class="thanks">{update.thanks}</p>{/if}
          <ol class="changes">
            {#each update.items as item (item.title)}
              <li class:compact={!item.art && !item.thumb} class:with-thumb={!!item.thumb}>
                <div>
                  <h3>{item.title}</h3>
                  <p class="muted">
                    {item.text}
                    {#if item.link}<a class="go" href={item.link.href} onclick={closeNews}>{item.link.label} →</a>{/if}
                  </p>
                </div>
                {#if item.art}<UpdateArt art={item.art} />{:else if item.thumb}<NewsThumb thumb={item.thumb} label={item.title} />{/if}
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

      {#each shownNews.filter((each) => each.note) as update (update.id)}
        {@const parts = noteParts(update.note!)}
        <p class="note">
          {parts.before}{#if parts.hasEmail}<a href={supportMailto('Happy Hallways')}>{supportEmail}</a>{parts.after}{/if}
        </p>
      {/each}

      <div class="dialog-actions">
        {#if shownNews.length === 1 && shownNews[0].action}
          {@const action = shownNews[0].action}
          <button class="btn" onclick={() => act(action.href)}>{action.label}</button>
        {/if}
        <a class="see-all" href="/settings/changes" onclick={closeNews}>See everything that changed</a>
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

  .thanks {
    max-width: 68ch;
    margin-top: 6px;
    font-size: 16px;
    line-height: 1.55;
  }

  .note {
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--surface-sunk);
    color: var(--muted);
    font-size: 14px;
  }

  /* A small picture to the right of a short item. */
  .changes li.with-thumb {
    grid-template-columns: 1fr 120px;
    gap: 20px;
    padding-top: 12px;
  }

  .see-all {
    align-self: center;
    margin-right: auto;
    color: var(--muted);
    font-size: 13px;
  }
</style>
