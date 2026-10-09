<script lang="ts">
  import { untrack } from 'svelte';
  import { Check, House, Plus, Trash2, Undo2, LogOut, UserRound } from '@lucide/svelte';
  import ImageField from './ImageField.svelte';
  import ReorderHandle from './ReorderHandle.svelte';
  import { reorder } from '../lib/reorder';
  import { clone, type Character, type Family } from '../lib/model';
  let { family, characters, worlds, isNew, onsave, onchange }: { family: Family; characters: Character[]; worlds: string[]; isNew: boolean; onsave:(f:Family)=>void; onchange:()=>void } = $props();
  let draft = $state(untrack(()=>{const {catalog,...editable}=family;return clone(editable) as Family;}));
  let memberQuery = $state('');
  let petName = $state('');
  let available = $derived(characters.filter(c=>!draft.members.some(member=>member.characterName===c.characterName) && !draft.formerMembers?.some(member=>member.characterName===c.characterName) && !draft.servants?.some(servant=>servant.characterName===c.characterName)));
  let matchingCharacters = $derived(available.filter(c=>`${c.displayName ?? ''} ${c.characterName}`.toLocaleLowerCase().includes(memberQuery.trim().toLocaleLowerCase())));
  function addMember(name:string) {
    const person=matchingCharacters.find(c=>c.characterName===name);
    if(!person)return;
    draft.members=[...draft.members,clone(person)];memberQuery='';onchange();
  }
  function moveMember(name:string, leaving:boolean) {
    const source=leaving?draft.members:(draft.formerMembers ?? []);
    const person=source.find(c=>c.characterName===name);
    if(!person)return;
    if(leaving){draft.members=source.filter(c=>c.characterName!==name);draft.formerMembers=[...(draft.formerMembers ?? []),person];}
    else {draft.formerMembers=source.filter(c=>c.characterName!==name);draft.members=[...draft.members,person];}
    onchange();
  }
  function makeServant(name:string) {
    const person=draft.members.find(member=>member.characterName===name);
    if(!person)return;
    draft.members=draft.members.filter(member=>member.characterName!==name);
    draft.servants=[...(draft.servants??[]),person];
    onchange();
  }
  function restoreServant(name:string) {
    const person=draft.servants?.find(servant=>servant.characterName===name);
    if(!person)return;
    draft.servants=draft.servants?.filter(servant=>servant.characterName!==name);
    draft.members=[...draft.members,person];
    onchange();
  }
  function removeServant(name:string) {
    draft.servants=draft.servants?.filter(servant=>servant.characterName!==name);
    onchange();
  }
  function addPet() {
    const name=petName.trim();
    if(!name || draft.pets?.includes(name))return;
    draft.pets=[...(draft.pets ?? []),name];petName='';onchange();
  }
  function removePet(name:string) {
    draft.pets=(draft.pets ?? []).filter(pet=>pet!==name);
    if(draft.petImages)delete draft.petImages[name];
    onchange();
  }
  function renamePet(oldName:string, value:string) {
    const name=value.trim();
    if (!name || name===oldName || draft.pets?.includes(name)) return;
    draft.pets=(draft.pets ?? []).map(pet=>pet===oldName?name:pet);
    if (draft.petImages?.[oldName] !== undefined) {
      draft.petImages[name]=draft.petImages[oldName];
      delete draft.petImages[oldName];
    }
    onchange();
  }
</script>
<form class="editor-form family-editor" oninput={onchange} onsubmit={e=>{e.preventDefault();if(draft.familyName.trim())onsave({...family,...draft,familyName:draft.familyName.trim(),displayName:draft.displayName?.trim() ?? ''});}}>
  <div class="section-label"><House size={15}/>ファミリー情報</div>
  <ImageField value={draft.image} label="ファミリーアイコン" onchange={v=>{draft.image=v;onchange();}}/>
  <label><span class="field-title">識別名 <span class="required">*</span></span><input required bind:value={draft.familyName} placeholder="例: Joestar"/></label>
  <label>表示名<input bind:value={draft.displayName} placeholder="例: ジョースター家"/></label>
  <label>ワールド<select aria-label="ワールド" bind:value={draft.world}><option value="">ワールドを選択</option>{#each worlds as world}<option value={world}>{world}</option>{/each}{#if draft.world && !worlds.includes(draft.world)}<option value={draft.world}>{draft.world}</option>{/if}</select></label>
  <div class="family-member-section">
  <div class="section-label">ファミリーのシム</div>
  <input class="member-search" aria-label="追加するシムを検索" placeholder="表示名・識別名で検索して追加" bind:value={memberQuery} oninput={event=>event.stopPropagation()} onkeydown={event=>{if(event.key==='Enter' && memberQuery.trim()){event.preventDefault();if(matchingCharacters.length)addMember(matchingCharacters[0].characterName);}}}/>
  {#if memberQuery.trim()}
    <div class="member-search-results" aria-label="検索結果">
      {#each matchingCharacters.slice(0,12) as person (person.characterName)}
        <button type="button" class="member-search-result" onclick={()=>addMember(person.characterName)}><span>{person.displayName || person.characterName}<small>{person.characterName}</small></span><Plus size={17}/></button>
      {:else}<p>該当するシムはいません。</p>{/each}
      {#if matchingCharacters.length>12}<p>ほか {matchingCharacters.length-12} 人。名前をさらに入力して絞り込んでください。</p>{/if}
    </div>
  {/if}
  {#each draft.members as member, i (member.characterName)}
    <div class="list-row" data-reorder-group="members" data-reorder-index={i}><span>{member.displayName || member.characterName}<small>{member.characterName}</small></span><div class="member-row-actions"><button type="button" class="icon-button" title="使用人にする" aria-label="{member.characterName} を使用人にする" onclick={()=>makeServant(member.characterName)}><UserRound size={16}/></button><button type="button" class="icon-button" title="家を出たシムに移動" aria-label="{member.characterName} を家を出たシムに移動" onclick={()=>moveMember(member.characterName,true)}><LogOut size={16}/></button><button type="button" class="icon-button" title="ファミリーから完全に外す" aria-label="{member.characterName} をファミリーから完全に外す" onclick={()=>{draft.members=draft.members.filter(c=>c.characterName!==member.characterName);onchange();}}><Trash2 size={16}/></button></div><ReorderHandle index={i} group="members" label={member.characterName} onreorder={(from,to)=>{draft.members=reorder(draft.members ?? [],from,to);onchange();}}/></div>
  {:else}<small>所属するシムはまだいません。</small>{/each}
  <div class="section-label">家を出たシム</div>
  {#each draft.formerMembers ?? [] as member, i (member.characterName)}
    <div class="list-row" data-reorder-group="formerMembers" data-reorder-index={i}><span>{member.displayName || member.characterName}<small>{member.characterName}</small></span><div class="row-actions"><button type="button" class="icon-button" title="ファミリーに戻す" aria-label="{member.characterName} をファミリーに戻す" onclick={()=>moveMember(member.characterName,false)}><Undo2 size={16}/></button><button type="button" class="icon-button" title="ファミリーから完全に外す" aria-label="{member.characterName} をファミリーから外す" onclick={()=>{draft.formerMembers=draft.formerMembers?.filter(c=>c.characterName!==member.characterName);onchange();}}><Trash2 size={16}/></button></div><ReorderHandle index={i} group="formerMembers" label={member.characterName} onreorder={(from,to)=>{draft.formerMembers=reorder(draft.formerMembers ?? [],from,to);onchange();}}/></div>
  {:else}<small>家を出たシムはまだいません。</small>{/each}
  <div class="section-label">使用人</div>
  {#each draft.servants ?? [] as servant, i (servant.characterName)}
    <div class="list-row" data-reorder-group="servants" data-reorder-index={i}><span>{servant.displayName || servant.characterName}<small>{servant.characterName}</small></span><div class="row-actions"><button type="button" class="icon-button" title="ファミリーに戻す" aria-label="{servant.characterName} をファミリーに戻す" onclick={()=>restoreServant(servant.characterName)}><Undo2 size={16}/></button><button type="button" class="icon-button" title="使用人から削除" aria-label="{servant.characterName} を使用人から削除" onclick={()=>removeServant(servant.characterName)}><Trash2 size={16}/></button></div><ReorderHandle index={i} group="servants" label={servant.characterName} onreorder={(from,to)=>{draft.servants=reorder(draft.servants ?? [],from,to);onchange();}}/></div>
  {:else}<small>使用人はいません。</small>{/each}
  </div>
  <div class="section-label">ペット</div>
  {#each draft.pets ?? [] as pet, i (pet)}
    <div class="list-row" data-reorder-group="pets" data-reorder-index={i}><input aria-label="{pet} の名前" value={pet} onkeydown={e=>{if(e.key==='Enter'){e.preventDefault();renamePet(pet,e.currentTarget.value);e.currentTarget.blur();}}} onblur={e=>renamePet(pet,e.currentTarget.value)}/><button type="button" class="icon-button" aria-label="{pet} を削除" onclick={()=>removePet(pet)}><Trash2 size={16}/></button><ReorderHandle index={i} group="pets" label={pet} onreorder={(from,to)=>{draft.pets=reorder(draft.pets ?? [],from,to);onchange();}}/></div>
    <ImageField value={draft.petImages?.[pet]} label={pet+' の画像'} onchange={v=>{draft.petImages={...draft.petImages,[pet]:v};onchange();}}/>
  {:else}<small>ペットはまだいません。</small>{/each}
  <div class="list-add"><input aria-label="追加するペットの名前" bind:value={petName} placeholder="ペットの名前"/><button type="button" class="icon-button framed" aria-label="ペットを追加" disabled={!petName.trim()} onclick={addPet}><Plus size={18}/></button></div>
  <div class="form-submit"><button class="button primary" type="submit"><Check size={17}/>{isNew?'ファミリーを追加':'変更を反映'}</button></div>
</form>
