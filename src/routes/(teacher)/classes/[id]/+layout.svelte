<script lang="ts">
  import { replaceState } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { currentSchedule, findClass } from '#lib/account.svelte.ts';
  import AddStudentsDialog from '#lib/AddStudentsDialog.svelte';
  import Icon from '#lib/Icon.svelte';
  import PageTabs from '#lib/PageTabs.svelte';
  import { formatRange, sortedPeriods } from '#lib/schedule.ts';

  let { children } = $props();

  const cls = $derived(findClass(page.params.id ?? ''));
  const base = $derived(`/classes/${page.params.id}`);
  const current = $derived(cls?.members.filter((member) => member.status === 'current').length ?? 0);
  /** When the Current Schedule puts this class on the kiosk. */
  const schedule = $derived(currentSchedule());
  const periods = $derived(schedule ? sortedPeriods(schedule).filter((period) => period.classId === cls?.id) : []);

  let adding = $state(false);
  /** The class's tabs: its students, their PINs (to see and print), and its settings. */
  const tabs = $derived([
    { href: base, label: 'Students' },
    { href: `${base}/pins`, label: 'PINs' },
    { href: `${base}/settings`, label: 'Settings' },
  ]);

  // A brand-new class arrives with ?add, so the teacher goes straight to adding students.
  onMount(() => {
    if (page.url.searchParams.has('add')) {
      adding = true;
      replaceState(base, {});
    }
  });
</script>

{#if cls}
  <div class="page">
    <header class="class-head">
      <div class="class-title">
        <h1>{cls.name}</h1>
        <p class="muted small">
          {current} {current === 1 ? 'student' : 'students'}
          {#if periods.length}
            · {schedule?.name}: {periods.map(formatRange).join(', ')}
          {/if}
        </p>
      </div>
      <div class="row">
        <button class="btn btn-primary" onclick={() => (adding = true)}><Icon name="user-plus" size={16} />Add students</button>
      </div>
    </header>

    <PageTabs {tabs} label={cls.name} />

    {@render children()}
  </div>

  {#if adding}<AddStudentsDialog {cls} onClose={() => (adding = false)} />{/if}
{:else}
  <div class="page">
    <div class="empty">This class doesn't exist anymore. <a href="/">Go to Home</a></div>
  </div>
{/if}
