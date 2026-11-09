<script lang="ts">
  import type { Pass } from './types';

  /** The rules a pass went past, each marked on its own, and how the teacher approved it. */
  let { pass }: { pass: Pass } = $props();
</script>

{#if pass.alwaysGo}<span class="badge" title="Taken by a student who can always go, so no rule held them back and they took no one's spot">Can always go</span>{/if}
{#if pass.extra}<span class="badge" title="Taken after their Pass Allowance was used up">Extra</span>{/if}
{#if pass.noPassException}<span class="badge" title="Taken during No-Pass Time, with your approval">No-pass time</span>{/if}
{#if pass.lineSkip}<span class="badge" title="Taken ahead of the line while the destination was full, with your approval">Skipped line</span>{/if}
{#if pass.approvedBy}<span class="badge ok" title="You approved their request {pass.approvedBy === 'home' ? 'on Home' : 'with your PIN at the kiosk'}">Approved{pass.approvedBy === 'pin' ? ' by PIN' : ''}</span>{/if}
{#if pass.fromLink}<span class="badge" title="Started from the student's own device, not the kiosk">Student device</span>{/if}
