<script lang="ts">
  import { GripVertical } from '@lucide/svelte';
  let { index, group, label, onreorder }: { index: number; group: string; label: string; onreorder: (from: number, to: number) => void } = $props();
  let startY = 0;
  let dragging = false;
  let target: HTMLElement | null = null;
  let list: HTMLElement | null = null;

  function clear() {
    target?.classList.remove('reorder-target');
    target = null;
    list = null;
    dragging = false;
  }
  function pointerDown(event: PointerEvent) {
    if (event.button !== 0) return;
    startY = event.clientY;
    list = event.currentTarget instanceof HTMLElement ? event.currentTarget.closest('.editor-form') : null;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  function pointerMove(event: PointerEvent) {
    if (!list || (!dragging && Math.abs(event.clientY - startY) < 4)) return;
    dragging = true;
    const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-reorder-index]') ?? null;
    const next = row && list.contains(row) && row.dataset.reorderGroup === group && row !== (event.currentTarget as HTMLElement).closest('[data-reorder-index]') ? row : null;
    if (next === target) return;
    target?.classList.remove('reorder-target');
    target = next;
    target?.classList.add('reorder-target');
  }
  function pointerUp() {
    const to = target ? Number(target.dataset.reorderIndex) : -1;
    clear();
    if (to >= 0) onreorder(index, to);
  }
  function keyDown(event: KeyboardEvent) {
    const direction = event.key === 'ArrowUp' ? -1 : event.key === 'ArrowDown' ? 1 : 0;
    if (!direction) return;
    const form = (event.currentTarget as HTMLElement).closest('.editor-form');
    const count = form?.querySelectorAll(`[data-reorder-group="${group}"]`).length ?? 0;
    const to = index + direction;
    if (to < 0 || to >= count) return;
    event.preventDefault();
    onreorder(index, to);
  }
</script>
<button type="button" class="icon-button reorder-handle" aria-label={`${label}を並び替え`} title="ドラッグまたは上下キーで並び替え" onpointerdown={pointerDown} onpointermove={pointerMove} onpointerup={pointerUp} onpointercancel={clear} onkeydown={keyDown}><GripVertical size={17}/></button>
