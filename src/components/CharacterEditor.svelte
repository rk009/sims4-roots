<script lang="ts">
  import { untrack } from 'svelte';
  import { Plus, Trash2, Check, UserRound, Heart, GitFork, PawPrint } from '@lucide/svelte';
  import ImageField from './ImageField.svelte';
  import ReorderHandle from './ReorderHandle.svelte';
  import { reorder } from '../lib/reorder';
  import { clone, familyTitle, occults, statuses, splitNames, title, type Character, type Family, type Status } from '../lib/model';
  let { character, characters, families, isNew, onsave, onchange }: { character: Character; characters: Character[]; families: Family[]; isNew: boolean; onsave: (c: Character)=>void; onchange: ()=>void } = $props();
  let draft = $state<Character>(untrack(()=>clone(character)));
  let twins = $state(untrack(()=>(character.twins ?? []).join(', ')));
  let pets = $state(untrack(()=>(character.pets ?? []).join(', ')));
  let error = $state('');
  let relationQuery = $state('');
  let names = $derived([...new Set(characters.map(c=>c.characterName))]);
  let matchingRelations = $derived(characters.filter(c=>c.characterName!==draft.characterName && !draft.partners?.some(p=>p.characterName===c.characterName) && `${c.displayName ?? ''} ${c.characterName}`.toLocaleLowerCase().includes(relationQuery.trim().toLocaleLowerCase())));
  function addRelation(name: string) {
    if(!matchingRelations.some(c=>c.characterName===name))return;
    draft.partners=[...(draft.partners ?? []),{characterName:name,status:'married'}];
    relationQuery='';onchange();
  }
  function submit(e: SubmitEvent) {
    e.preventDefault(); error='';
    if (!draft.characterName.trim()) { error='識別名を入力してください。'; return; }
    if ([draft.father, draft.mother, draft.adoptiveFather, draft.adoptiveMother].includes(draft.characterName)) { error='本人を親に設定することはできません。'; return; }
    const partners = (draft.partners ?? []).filter(p=>p.characterName.trim()).map(p=>({...p,characterName:p.characterName.trim()}));
    if (partners.some(p=>p.characterName===draft.characterName)) {error='本人をパートナーに設定することはできません。';return;}
    const data = clone({...draft, characterName:draft.characterName.trim(), isDead:draft.isDead===true, father:draft.father?.trim() ?? '', mother:draft.mother?.trim() ?? '', adoptiveFather:draft.adoptiveFather?.trim() ?? '', adoptiveMother:draft.adoptiveMother?.trim() ?? '', twins:splitNames(twins), partners});
    delete (data as Character).brothers;
    if (data.brotherNumber === undefined || data.brotherNumber === null) delete data.brotherNumber;
    onsave(data);
  }
</script>
<form class="editor-form character-editor" onsubmit={submit} oninput={onchange} onchange={onchange}>
  <div class="section-label"><UserRound size={15}/>基本情報</div>
  <ImageField value={draft.image} label="キャラクター画像" monochrome={draft.isDead} onchange={v=>{draft.image=v;onchange();}}/>
  <label><span class="field-title">識別名 <span class="required">*</span></span><input required bind:value={draft.characterName} placeholder="Jonathan Joestar"/></label>
  <label>表示名<input bind:value={draft.displayName} placeholder="ジョナサン・ジョースター"/></label>
  <div class="form-row occult-row"><label>オカルト<select bind:value={draft.occult}>{#each Object.entries(occults) as [key,name]}<option value={key}>{name}</option>{/each}</select></label>
  <label class="check-label"><input type="checkbox" bind:checked={draft.star}/>スター</label><label class="check-label"><input type="checkbox" bind:checked={draft.isDead}/>故人</label></div>
  <label>メイン世帯<select aria-label="メイン世帯" bind:value={draft.mainFamily}><option value="">未設定</option>{#each families as family}<option value={family.familyName}>{familyTitle(family)}</option>{/each}{#if draft.mainFamily && !families.some(f=>f.familyName===draft.mainFamily)}<option value={draft.mainFamily}>{draft.mainFamily}（未登録）</option>{/if}</select></label>
  <div class="section-label"><GitFork size={15}/>家族のつながり</div>
  <datalist id="character-names">{#each names as name}<option value={name}></option>{/each}</datalist>
  <label>父親<input list="character-names" bind:value={draft.father} placeholder="未設定"/></label>
  <label>母親<input list="character-names" bind:value={draft.mother} placeholder="未設定"/></label>
  <label>養父<input list="character-names" bind:value={draft.adoptiveFather} placeholder="未設定"/></label>
  <label>養母<input list="character-names" bind:value={draft.adoptiveMother} placeholder="未設定"/></label>
  <small>親が不明な兄弟・姉妹は、父親または母親に同じ「noparents_識別名」を入力してください。</small>
  <div class="form-row sibling-row"><label>兄弟順<input type="number" min="0" step="1" bind:value={draft.brotherNumber} placeholder="例: 1"/></label><label>双子<input bind:value={twins} placeholder="識別名をカンマ区切り"/></label></div>
  <div class="section-label"><Heart size={15}/>パートナー・親友</div>
  <input class="member-search" aria-label="追加するパートナー・親友を検索" placeholder="表示名・識別名で検索して追加" bind:value={relationQuery} oninput={event=>event.stopPropagation()} onkeydown={event=>{if(event.key==='Enter' && relationQuery.trim()){event.preventDefault();if(matchingRelations.length)addRelation(matchingRelations[0].characterName);}}}/>
  {#if relationQuery.trim()}
    <div class="member-search-results" aria-label="パートナー・親友の検索結果">
      {#each matchingRelations.slice(0,12) as person (person.characterName)}
        <button type="button" class="member-search-result" onclick={()=>addRelation(person.characterName)}><span>{title(person)}<small>{person.characterName}</small></span><Plus size={17}/></button>
      {:else}<p>該当するシムはいません。</p>{/each}
      {#if matchingRelations.length>12}<p>ほか {matchingRelations.length-12} 人。名前をさらに入力して絞り込んでください。</p>{/if}
    </div>
  {/if}
  <div class="relation-list">
    {#each draft.partners ?? [] as p, i}
      {@const related = characters.find(c=>c.characterName===p.characterName)}
      <div class="list-row relation-row" data-reorder-group="partners" data-reorder-index={i}>
        <div class="relation-identity"><span>{related ? title(related) : p.characterName}</span><small>{p.characterName}</small></div>
        <select aria-label="関係ステータス {i+1}" title={statuses[p.status]} bind:value={p.status}>{#each Object.entries(statuses) as [key,name]}<option value={key as Status}>{name}</option>{/each}</select>
        <button type="button" class="icon-button" aria-label="関係 {i+1} を削除" onclick={()=>{draft.partners=draft.partners?.filter((_,j)=>j!==i);onchange();}}><Trash2 size={15}/></button>
        <ReorderHandle index={i} group="partners" label={p.characterName || `パートナー ${i+1}`} onreorder={(from,to)=>{draft.partners=reorder(draft.partners ?? [],from,to);onchange();}}/>
      </div>
    {/each}
  </div>
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
  <div class="form-submit"><button class="button primary" type="submit"><Check size={17}/>{isNew ? 'シムを追加' : '変更を反映'}</button><small>追加・変更を確定すると、JSONファイルにも保存されます。</small></div>
</form>
