<script lang="ts">
  import Icon from './Icon.svelte';
  import type { IconName } from './icons';
  import type { Pass } from './types';

  /**
   * The rules a pass went past, each marked on its own, and how the teacher approved it.
   * Compact shows each as a small icon, with the words on hover, for a busy table.
   */
  let { pass, compact = false }: { pass: Pass; compact?: boolean } = $props();

  const marks = $derived(
    [
      pass.alwaysGo && {
        icon: 'shield-check',
        text: 'Can always go',
        detail: 'Taken by a student who can always go, so no rule held them back and they took no one’s spot',
      },
      pass.extra && { icon: 'plus', text: 'Extra', detail: 'Taken after their Pass Allowance was used up' },
      pass.noPassException && { icon: 'circle-slash', text: 'No-pass time', detail: 'Taken during No-Pass Time, with your approval' },
      pass.lineSkip && {
        icon: 'arrow-up',
        text: 'Skipped line',
        detail: 'Taken ahead of the line while the destination was full, with your approval',
      },
      pass.approvedBy && {
        icon: 'check',
        text: `Approved${pass.approvedBy === 'pin' ? ' by PIN' : ''}`,
        detail: `You approved it ${pass.approvedBy === 'home' ? 'on Home' : 'with your PIN at the kiosk'}`,
        ok: true,
      },
      pass.fromLink && { icon: 'smartphone', text: 'Student device', detail: 'Started from the student’s own device, not the kiosk' },
    ].filter(Boolean) as { icon: IconName; text: string; detail: string; ok?: boolean }[],
  );
</script>

{#each marks as mark (mark.text)}
  {#if compact}
    <span class="mark" class:ok={mark.ok} role="img" aria-label={mark.text} title="{mark.text}: {mark.detail}"
      ><Icon name={mark.icon} size={13} stroke={2.5} /></span
    >
  {:else}
    <span class="badge" class:ok={mark.ok} title={mark.detail}>{mark.text}</span>
  {/if}
{/each}

<style>
  .mark {
    display: inline-grid;
    place-items: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--border);
    border-radius: 999px;
    background: var(--surface-sunk);
    color: var(--muted);
    vertical-align: middle;
    cursor: help;
  }

  .mark.ok {
    background: var(--accent-wash);
    border-color: #c7dccd;
    color: var(--accent);
  }
</style>
