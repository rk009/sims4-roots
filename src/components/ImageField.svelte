<script lang="ts">
  import { ImagePlus, X } from '@lucide/svelte';
  import { imageData } from '../lib/storage';
  import { safeImage } from '../lib/model';
  let { value, label = '画像を選択', large = false, monochrome = false, onchange }: { value?: string; label?: string; large?: boolean; monochrome?: boolean; onchange: (s: string)=>void } = $props();
  let error = $state(''); let busy = $state(false);
  async function upload(e: Event) {
    const input = e.currentTarget as HTMLInputElement, file = input.files?.[0];
    if (!file) return; busy = true; error = '';
    try { onchange(await imageData(file, large ? 1200 : 300)); } catch(e) { error=String(e instanceof Error ? e.message : e); }
    finally { busy=false; input.value=''; }
  }
</script>
<div class="image-field">
  {#if safeImage(value)}<img class:wide={large} class:monochrome class="image-preview" src={safeImage(value)} alt="選択した画像"/>{/if}
  <div><label class="button secondary upload"><ImagePlus size={16}/>{busy ? '読み込み中…' : label}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onchange={upload} disabled={busy}/></label>
  {#if value}<button class="text-button" type="button" onclick={()=>onchange('')}><X size={14}/>画像を外す</button>{/if}</div>
</div>
{#if error}<p class="form-error" role="alert">{error}</p>{/if}
