<script lang="ts">
  import { UserRound } from '@lucide/svelte';
  import { safeImage, title, type Character } from '../lib/model';
  import { occultIcon } from '../lib/assets';
  import starIcon from '../../assets/icons/Star.png?url';
  let { character, small = false }: { character: Character; small?: boolean } = $props();
  let image = $derived(safeImage(character.image));
  let icon = $derived(occultIcon(character.occult ?? 'person'));
  let color = $derived(['sage','rose','sand','blue'][Array.from(character.characterName).reduce((n,c)=>n+c.charCodeAt(0),0)%4]);
</script>
<span class="portrait {color}" class:small>
  {#if image}<img class="sim-photo" class:monochrome={character.isDead===true} src={image} alt={title(character)} draggable="false" />
  {:else}<UserRound size={small ? 30 : 46} strokeWidth={1.1}/>{/if}
  {#if character.star}<img class="star-badge" src={starIcon} alt="スターシム" title="スターシム"/>{/if}
  {#if icon}<img class="occult-badge" src={icon} alt={character.occult} title={character.occult}/>{/if}
</span>
