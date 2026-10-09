<script lang="ts">
  import { untrack } from 'svelte';
  import { Check, Globe2 } from '@lucide/svelte';
  import ImageField from './ImageField.svelte';
  import { clone, safeImage } from '../lib/model';
  import type { World } from '../lib/storage';
  let { world, isNew, onsave, onchange }: {world: World; isNew: boolean; onsave:(world:World)=>void; onchange:()=>void} = $props();
  let draft=$state(untrack(()=>clone(world)));
</script>
<form class="editor-form" oninput={onchange} onsubmit={event=>{event.preventDefault();onsave({...draft,world:draft.world.trim()});}}>
  <div class="section-label"><Globe2 size={15}/>ワールド情報</div>
  <div class="world-editor-preview">{#if safeImage(draft.image)}<img src={safeImage(draft.image)} alt=""/>{:else}<Globe2 size={34}/>{/if}</div>
  <ImageField value={draft.image} label="ワールド画像を選択" onchange={value=>{draft.image=value;onchange();}}/>
  <label>ワールド名 <span class="required">*</span><input required bind:value={draft.world} placeholder="例: Willow Creek"/></label>
  <div class="form-submit"><button class="button primary" type="submit"><Check size={16}/>{isNew?'ワールドを追加':'変更を反映'}</button></div>
</form>
