<script lang="ts">
  import Portrait from './Portrait.svelte';
  import { familyTitle, resolve, statuses, title, type Character, type Family } from '../lib/model';
  import { partnerStackLayout, type TreeNode } from '../lib/tree';
  import { statusIcon } from '../lib/assets';
  import leavingIcon from '../../assets/icons/leaving.png?url';
  let { node, families, family, selected, onselect, onfamilyselect }: { node: TreeNode; families: Family[]; family: Family; selected?: string; onselect: (c: Character) => void; onfamilyselect:(index:number)=>void } = $props();
  let c = $derived(node.character);
  let partners = $derived(node.partners);
  let partnerStack = $derived(partnerStackLayout(partners.length));
  let mainFamilyIndex = $derived(families.findIndex(f=>f.familyName===c.mainFamily));
</script>
<div class="tree-character" class:external={node.external} style:left="{node.x}px" style:top="{node.y}px" style:width="{node.width}px" style:height="{node.height}px">
  <button class="main-character" class:selected={selected === c.characterName} style:left="{node.left}px" style:top={node.external ? '25px' : '0px'} onclick={()=>onselect(c)} title={c.characterName}>
    <Portrait character={c} small={node.external}/>
    <span class="character-name">{title(c)}</span>
    {#if node.missing}<span class="character-caption">未登録</span>{/if}
  </button>
  {#if node.former}
    <button class="leaving-link" style:left="{node.left + 82}px" disabled={mainFamilyIndex<0} title={mainFamilyIndex<0?'メイン世帯を設定してください':`${familyTitle(families[mainFamilyIndex])}の家系図へ移動`} aria-label={mainFamilyIndex<0?`${title(c)}のメイン世帯は未設定`:`${title(c)}のメイン世帯 ${familyTitle(families[mainFamilyIndex])}へ移動`} onclick={()=>{if(mainFamilyIndex>=0)onfamilyselect(mainFamilyIndex);}}><img class="leaving-badge" src={leavingIcon} alt=""/></button>
  {/if}
  {#if partners.length}<div class="partner-grid" style:left="{node.left + 110}px" style:top="{partnerStack.top}px" style:height="{partnerStack.height}px" style:justify-content={partners.length === 1 ? 'center' : 'space-between'}>
    {#each partners as partner}
      {@const person = resolve(families,family,partner.characterName) ?? {characterName:partner.characterName}}
      <button class="partner" title="{title(person)} · {statuses[partner.status]}" onclick={()=>onselect(person)} aria-label="{title(person)}（{statuses[partner.status]}）">
        <img class="relation-icon" src={statusIcon(partner.status)} alt={statuses[partner.status]} title={statuses[partner.status]}/>
        <Portrait character={person} small/>
      </button>
    {/each}
  </div>{/if}
</div>
