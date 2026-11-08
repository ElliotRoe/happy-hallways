<script lang="ts">
  import { account } from './account.svelte';
  import Icon from './Icon.svelte';
  import { onboarding, updateOnboarding } from './onboarding.svelte';
  import { keepOpen, steps } from './welcome/steps';

  /**
   * The getting-started checklist in the corner. Each item ticks itself off
   * from what's really there, or the teacher ticks or unticks it by hand,
   * which wins. Once the last one ticks, it says so and goes. Settings can
   * bring it back.
   */
  const auto = $derived({
    class: account.classes.some((cls) => cls.members.some((member) => member.status === 'current')),
    destinations: onboarding.visitedDestinations,
    kiosk: !!account.kiosk && !!account.activeClass,
  });
  const links = $derived({
    class: account.classes[0] ? `/classes/${account.classes[0].id}` : '/',
    destinations: '/destinations',
    kiosk: '/kiosk',
  });
  const items = $derived(
    steps.map((step) => ({
      key: step.key,
      label: step.title,
      href: links[step.key],
      done: onboarding.checked[step.key] ?? auto[step.key],
    })),
  );
  const count = $derived(items.filter((item) => item.done).length);
  const allDone = $derived(count === items.length);

  let collapsed = $state(false);

  function toggle(key: string, done: boolean) {
    updateOnboarding({ checked: { ...onboarding.checked, [key]: !done } });
  }

  // Finishing the last item while it's showing celebrates briefly, then hides it.
  // Brought back from Settings already complete, it stays until closed.
  // svelte-ignore state_referenced_locally
  const doneOnOpen = allDone;
  $effect(() => {
    if (!allDone || doneOnOpen) return;
    const timer = setTimeout(() => updateOnboarding({ showChecklist: false }), 2600);
    return () => clearTimeout(timer);
  });
</script>

<aside class="checklist" aria-label="Getting started">
  <header>
    <button class="toggle" aria-expanded={!collapsed} onclick={() => (collapsed = !collapsed)}>
      <span class="title">{allDone ? 'You’re all set!' : 'Getting started'}</span>
      <span class="progress">{count} of {items.length}</span>
      <Icon name={collapsed ? 'chevron-up' : 'chevron-down'} size={15} />
    </button>
    <button
      class="close"
      aria-label="Hide the checklist"
      title="Hide (bring it back from Settings)"
      onclick={() => updateOnboarding({ showChecklist: false })}
    >
      <Icon name="x" size={15} />
    </button>
  </header>
  <div class="meter"><span style:width="{(count / items.length) * 100}%"></span></div>
  {#if !collapsed}
    <ol>
      {#each items as item (item.key)}
        <li class:done={item.done}>
          <button
            class="box"
            role="checkbox"
            aria-checked={item.done}
            aria-label={item.label}
            title={item.done ? 'Mark as not done' : 'Mark as done'}
            onclick={() => toggle(item.key, item.done)}
          >
            {#if item.done}<Icon name="check" size={12} stroke={3} />{/if}
          </button>
          {#if item.done}<span>{item.label}</span>{:else}<a href={item.href}>{item.label}</a>{/if}
        </li>
      {/each}
    </ol>
    <p class="keep-open"><Icon name="alert-triangle" size={14} />{keepOpen.title} all day: this page and the kiosk.</p>
  {/if}
</aside>

<style>
  /* It sits in the teacher layout's corner, under any toasts. */
  .checklist {
    width: 270px;
    pointer-events: auto;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 12px;
    background: var(--surface);
    box-shadow:
      0 12px 32px rgb(42 34 22 / 14%),
      0 2px 6px rgb(42 34 22 / 6%);
    animation: arrive 260ms both;
  }

  @keyframes arrive {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }

  header {
    display: flex;
    align-items: center;
    padding: 4px 4px 4px 0;
  }

  .toggle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 6px 8px 14px;
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
  }

  .title {
    font-weight: 800;
  }

  .progress {
    margin-left: auto;
    color: var(--muted);
    font-size: 12px;
  }

  .close {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 8px;
    background: none;
    color: var(--muted);
    cursor: pointer;
  }

  .close:hover {
    background: var(--surface-sunk);
  }

  .meter {
    height: 3px;
    margin: 0 14px;
    overflow: hidden;
    border-radius: 999px;
    background: var(--border);
  }

  .meter span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 300ms ease;
  }

  ol {
    display: flex;
    flex-direction: column;
    gap: 9px;
    margin: 0;
    padding: 12px 14px 10px;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .box {
    flex: none;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: 1.5px solid var(--border-strong);
    border-radius: 50%;
    background: #fff;
    color: #fff;
    cursor: pointer;
  }

  .box:hover {
    border-color: var(--accent);
    background: var(--accent-wash);
  }

  li.done .box {
    border-color: var(--accent);
    background: var(--accent);
    animation: tick 260ms both;
  }

  @keyframes tick {
    from {
      transform: scale(0.6);
    }
  }

  li.done span {
    color: var(--muted);
    text-decoration: line-through;
  }

  a {
    color: var(--text);
    font-weight: 600;
    text-decoration: none;
  }

  a:hover {
    color: var(--accent);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  .keep-open {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    margin: 0 14px 14px;
    padding: 8px 10px;
    border-radius: 8px;
    background: var(--warn-wash);
    color: var(--warn);
    font-size: 12.5px;
    font-weight: 700;
    line-height: 1.4;
  }

  .keep-open :global(svg) {
    margin-top: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .checklist,
    li.done .box {
      animation: none;
    }
  }
</style>
