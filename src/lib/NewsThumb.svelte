<script lang="ts">
  import attendance from './news-art/attendance.svg?raw';
  import historyFix from './news-art/history-fix.svg?raw';
  import ownDevice from './news-art/own-device.svg?raw';
  import visibility from './news-art/visibility.svg?raw';
  import type { NewsThumb } from './popups';

  /**
   * A small picture beside one "What's new" item. Each is an SVG file in
   * news-art/ (viewBox 0 0 160 120), so a new drawing is dropped in as a file.
   */
  let { thumb, label }: { thumb: NewsThumb; label: string } = $props();
  const svgs: Record<NewsThumb, string> = {
    'own-device': ownDevice,
    attendance,
    visibility,
    'history-fix': historyFix,
  };
</script>

<!-- eslint-disable-next-line svelte/no-at-html-tags -- our own SVG files, not user content -->
<div class="thumb" role="img" aria-label={label}>{@html svgs[thumb]}</div>

<style>
  .thumb {
    width: 120px;
  }

  .thumb :global(svg) {
    display: block;
    width: 100%;
    height: auto;
  }
</style>
