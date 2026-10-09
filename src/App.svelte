<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { isTauri } from '@tauri-apps/api/core';
  import { PawPrint, Plus, Trash2, Settings2, Download, Save, ZoomIn, ZoomOut, Scan, X, GitFork, UsersRound, MapPin, Check, AlertTriangle, Pencil, Sprout, RotateCcw, LoaderCircle, Image, CircleHelp, UserRound } from '@lucide/svelte';
  import TreeCharacter from './components/TreeCharacter.svelte';
  import CharacterEditor from './components/CharacterEditor.svelte';
  import FamilyEditor from './components/FamilyEditor.svelte';
  import WorldEditor from './components/WorldEditor.svelte';
  import ImageField from './components/ImageField.svelte';
  import seed from '../release/conf/characters.json?raw';
  import familySeed from '../release/conf/families.json?raw';
  import logo from '../assets/app-icon.svg?url';
  import { clone, parseFamilies, parseWorkspace, splitWorkspace, upgradeDraft, diagnostics, replaceCharacter, replaceFamily, addCharacter, deleteCharacter, resolve, safeImage, statuses, title, familyTitle, type Character, type Family } from './lib/model';
  import { layoutTree } from './lib/tree';
  import { statusIcon } from './lib/assets';
  import { readDraft, clearDraft, readSelectedFamily, writeDraft, writeSelectedFamily, saveJson, savePng, confirmAction, startupJson, reloadJson, bundledWorlds, loadWorlds, saveWorlds, type World } from './lib/storage';
  import { toBlob } from 'html-to-image';
  let families = $state<Family[]>(parseWorkspace(seed,familySeed));
  let extraCharacters = $state<Character[]>([]);
  let worlds = $state<World[]>(bundledWorlds);
  let selected = $state(0); let ready = $state(false); let dirty = $state(false);
  let filePath = $state(''); let draftState = $state('準備中'); let busy = $state('');
  let toast = $state(''); let failure = $state('');
  let pane = $state<'worlds'|'world'|'characters'|'character'|'family'|'settings'|'issues'|'help'|null>(null);
  let editFamily = $state(0); let editIndex = $state(-1); let editCharacter = $state<Character>({characterName:''});
  let characterReturnToList = $state(false); let managerQuery = $state('');
  let worldIndex=$state(-1); let editWorld=$state<World>({world:''});
  let newFamily = $state(false); let editorKey = $state(0); let editorDirty = $state(false);
  let zoom = $state(1); let canvas = $state<HTMLDivElement>(); let viewport = $state<HTMLDivElement>();
  let draggedFamily = $state<number|null>(null); let dropFamily = $state<number|null>(null); let dropAfter = $state(false);
  let familyTabs = $state<HTMLDivElement>();
  let familyPointer: {id:number;from:number;x:number;y:number}|null = null;
  let suppressFamilyClick = false;
  let pan: {x:number;y:number;left:number;top:number}|null = null;
  let panning = $state(false); let toastTimer: ReturnType<typeof setTimeout>;
  let family = $derived(families[selected]);
  let characters = $derived([...new Map([...extraCharacters,...families.flatMap(f=>[...(f.catalog ?? []),...f.members,...(f.formerMembers ?? [])])].map(c=>[c.characterName,c] as const)).values()]);
  let visibleCharacters = $derived(characters.filter(c=>`${title(c)} ${c.characterName}`.toLowerCase().includes(managerQuery.trim().toLowerCase())));
  let worldImage=$derived(worlds.find(world=>world.world===family?.world)?.image);
  let tree = $derived(family ? layoutTree(families,family) : null);
  let issues = $derived([...diagnostics(families),...(tree?.warnings??[])]);
  const themes: Record<string,{name:string;background:string;lightText:boolean}> = {
    dusk:{name:'トワイライト',background:'linear-gradient(135deg,#444d67,#777b92 52%,#bba3b0)',lightText:true},
    sunset:{name:'サンセット',background:'radial-gradient(ellipse at 5% 90%, #a77780 0, transparent 65%), linear-gradient(125deg,#bd9b92,#a99076)',lightText:true},
    sky:{name:'アクアマリン',background:'radial-gradient(ellipse at 18% 18%, #7da99a 0, transparent 58%), radial-gradient(ellipse at 84% 78%, #7399a5 0, transparent 55%), #98b7ae',lightText:true},
    meadow:{name:'セージ',background:'radial-gradient(ellipse at 22% 20%, #d9e6d1 0, transparent 52%), radial-gradient(ellipse at 80% 80%, #dbd1bb 0, transparent 55%), #e8e9db',lightText:false}
  };
  let backdrop = $derived(safeImage(family?.background) ? `url("${safeImage(family?.background)}") center / cover no-repeat` : (themes[family?.theme ?? 'meadow'] ?? themes.meadow).background);
  let useLightText = $derived(!!(themes[family?.theme ?? 'meadow']?.lightText && !family?.background));
  function notify(text: string) {toast=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast='',4500);}
  function fail(e: unknown) {failure=e instanceof Error?e.message:String(e);}
  async function persist(workspace?: ReturnType<typeof splitWorkspace>) {
    draftState='保存中';
    try {await writeDraft({families,selected,dirty,filePath,extraCharacters},workspace ?? splitWorkspace(families,extraCharacters));draftState='下書き保存済み';} catch(e) {draftState='下書き保存失敗';fail(e);}
  }
  function changed() {dirty=true;void persist();}
  async function canLeaveEditor() {return !editorDirty || await confirmAction('まだ反映していない編集があります。編集を破棄して移動しますか？');}
  async function closePane() {if(await canLeaveEditor()){pane=pane==='character'&&characterReturnToList?'characters':pane==='world'?'worlds':null;editorDirty=false;}}
  async function showPane(next: typeof pane) {if(await canLeaveEditor()){pane=next;editorDirty=false;}}
  async function chooseFamily(index:number) {
    if(!await canLeaveEditor())return;
    selected=index;pane=null;editorDirty=false;void writeSelectedFamily(index).catch(fail);await tick();resetView();
  }
  function dragFamilyStart(event: PointerEvent, index: number) {
    if(event.button!==0)return;
    familyPointer={id:event.pointerId,from:index,x:event.clientX,y:event.clientY};
    if(event.currentTarget instanceof HTMLElement)event.currentTarget.setPointerCapture(event.pointerId);
  }
  function dragFamilyMove(event: PointerEvent) {
    if(!familyPointer || event.pointerId!==familyPointer.id)return;
    if(draggedFamily===null && Math.hypot(event.clientX-familyPointer.x,event.clientY-familyPointer.y)<5)return;
    draggedFamily=familyPointer.from;
    event.preventDefault();
    if(familyTabs){
      const bounds=familyTabs.getBoundingClientRect();
      if(event.clientY<bounds.top+24)familyTabs.scrollTop-=10;
      else if(event.clientY>bounds.bottom-24)familyTabs.scrollTop+=10;
    }
    const bounds=familyTabs!.getBoundingClientRect();
    if(event.clientX<bounds.left || event.clientX>bounds.right || event.clientY<bounds.top || event.clientY>bounds.bottom){dropFamily=null;return;}
    const tabs=Array.from(familyTabs!.querySelectorAll('.family-tab'));
    const slot=tabs.findIndex(tab=>{const rect=tab.getBoundingClientRect();return event.clientY<rect.top+rect.height/2;});
    dropFamily=slot===0?0:slot<0?tabs.length-1:slot-1;
    dropAfter=slot!==0;
  }
  function dragFamilyEnd(event: PointerEvent) {
    if(!familyPointer || event.pointerId!==familyPointer.id)return;
    const from=draggedFamily, index=dropFamily, after=dropAfter;
    familyPointer=null;draggedFamily=null;dropFamily=null;dropAfter=false;
    if(from===null || index===null)return;
    suppressFamilyClick=true;
    setTimeout(()=>suppressFamilyClick=false,0);
    const current=families[selected], editing=families[editFamily];
    const reordered=[...families];
    const [moved]=reordered.splice(from,1);
    const destination=index+(after?1:0)-(from<index+(after?1:0)?1:0);
    reordered.splice(destination,0,moved);
    if(destination===from)return;
    families=reordered;
    selected=reordered.indexOf(current);
    editFamily=reordered.indexOf(editing);
    changed();
  }
  function cancelFamilyDrag() {familyPointer=null;draggedFamily=null;dropFamily=null;dropAfter=false;}
  function clickFamily(index:number) {if(suppressFamilyClick)return;void chooseFamily(index);}
  async function edit(c?:Character, fi=selected, fromManager=false) {
    if(!await canLeaveEditor())return;
    let targetFamily=fi, index=c?families[fi]?.members.indexOf(c) ?? -1:-1;
    if(c && index<0 && extraCharacters.some(person=>person.characterName===c.characterName)){targetFamily=-1;index=-5;}
    else if(c && index<0) {
      targetFamily=families.findIndex(f=>f.members.includes(c)||f.formerMembers?.includes(c));
      if(targetFamily>=0)index=families[targetFamily].members.indexOf(c);else targetFamily=fi;
    }
    if(c && index<0 && families[targetFamily]?.formerMembers?.some(person=>person.characterName===c.characterName))index=-4;
    if(c && index<0 && index!==-4 && index!==-5)index=families.some(f=>f.catalog?.some(person=>person.characterName===c.characterName))?-2:-3;
    editFamily=targetFamily;editIndex=fromManager && !c?-3:index;characterReturnToList=fromManager;
    editCharacter=clone(c??{characterName:'',displayName:'',occult:'person',star:false,father:'',mother:'',partners:[],pets:[]});
    if(editCharacter.occult==='faily')editCharacter.occult='fairy';
    if(['warewolf','werewolve'].includes(editCharacter.occult??''))editCharacter.occult='werewolf';
    editorDirty=false;editorKey++;pane='character';
  }
  async function editHouse(create=false) {
    if(!await canLeaveEditor())return;
    newFamily=create;editFamily=selected;editorKey++;editorDirty=false;pane='family';
  }
  async function openWorld(index=-1) {
    if(!await canLeaveEditor())return;
    worldIndex=index;editWorld=clone(index<0?{world:'',image:''}:worlds[index]);editorKey++;editorDirty=false;pane='world';
  }
  async function saveWorld(value:World) {
    try {
      const name=value.world.trim();
      if(!name)throw new Error('ワールド名を入力してください。');
      if(worlds.some((world,index)=>index!==worldIndex&&world.world===name))throw new Error('このワールド名は既に使われています。');
      const next=clone(worlds);
      if(worldIndex<0)next.push({...value,world:name});
      else next[worldIndex]={...value,world:name};
      await saveWorlds(next);
      if(worldIndex>=0&&worlds[worldIndex].world!==name){families=families.map(f=>f.world===worlds[worldIndex].world?{...f,world:name}:f);changed();}
      worlds=next;pane='worlds';editorDirty=false;notify('ワールドを保存しました');
    }catch(e){fail(e);}
  }
  async function removeWorld(index:number) {
    if(!await confirmAction(`${worlds[index].world} を削除しますか？`))return;
    try {const name=worlds[index].world;const next=worlds.filter((_,i)=>i!==index);await saveWorlds(next);worlds=next;families=families.map(f=>f.world===name?{...f,world:''}:f);changed();notify('ワールドを削除しました');}catch(e){fail(e);}
  }
  async function removeFamily() {
    if(!family || busy || !await canLeaveEditor())return;
    if(!await confirmAction(`${familyTitle(family)} を削除しますか？所属するシムのデータは残ります。`))return;
    const remaining=families.filter((_,index)=>index!==selected);
    if(!remaining.length){extraCharacters=[...new Map([...(family.catalog??[]),...family.members,...(family.formerMembers??[])].map(person=>[person.characterName,person] as const)).values()];}
    families=remaining;
    selected=Math.min(selected,Math.max(0,families.length-1));
    pane=null;editorDirty=false;changed();await tick();resetView();
  }
  async function saveCharacter(c:Character) {
    try {
      if(editIndex===-5){
        if(extraCharacters.some(person=>person.characterName===c.characterName&&person.characterName!==editCharacter.characterName))throw new Error('この識別名はすでに使われています。');
        extraCharacters=extraCharacters.map(person=>person.characterName===editCharacter.characterName?clone(c):person);
      }else if(editIndex===-3&&!families.length){
        if(characters.some(person=>person.characterName===c.characterName))throw new Error('この識別名はすでに使われています。');
        extraCharacters=[...extraCharacters,clone(c)];
      }else families=editIndex===-3?addCharacter(families,c):replaceCharacter(families,editFamily,editIndex,c,editCharacter.characterName);
      editorDirty=false;pane=characterReturnToList?'characters':null;dirty=true;
      await save();
      if(dirty)await persist();
    }catch(e){fail(e);}
  }
  async function removeCharacter(name:string) {
    if(!await confirmAction(`${name} を削除しますか？ファミリー所属と他のシムからの参照も削除されます。`))return;
    families=deleteCharacter(families,name);extraCharacters=extraCharacters.filter(person=>person.characterName!==name);changed();notify('シムを削除しました');
  }
  function saveFamily(f:Family) {
    try {
      if(newFamily){
        if(families.some(old=>old.familyName===f.familyName))throw new Error('このファミリー識別名は既に使われています。');
        const catalog=[...new Map([...extraCharacters,...(f.catalog??[])].map(person=>[person.characterName,person] as const)).values()];
        families=[...families,{...f,...(catalog.length?{catalog}: {})}];extraCharacters=[];selected=families.length-1;
      } else families=replaceFamily(families,editFamily,f);
      pane=null;editorDirty=false;changed();notify('ファミリーを保存しました');void tick().then(resetView);
    }catch(e){fail(e);}
  }
  async function save() {
    if(busy)return;
    if(editorDirty){notify('先に右ペインの「変更を反映」を押してください');return;}
    busy='JSONを保存中';
    try {const saved=await saveJson(families,filePath||undefined,extraCharacters);if(saved){filePath=saved.path;dirty=false;await persist(saved.workspace);notify('JSONファイルを保存しました');}}
    catch(e){fail(e);}finally{busy='';}
  }
  async function reload() {
    if(busy || !await canLeaveEditor())return;
    if(dirty && !await confirmAction('JSONに未保存の変更を破棄して、ファイルから再読み込みしますか？'))return;
    busy='JSONを再読み込み中';
    try {
      worlds=await loadWorlds();
      const data=filePath?await reloadJson(filePath):await startupJson();
      if(data){const previous=family?.familyName;families=data.families;extraCharacters=families.length?[]:data.characters;filePath=data.path;selected=Math.max(0,families.findIndex(f=>f.familyName===previous));pane=null;editorDirty=false;dirty=false;await persist();await tick();resetView();notify('最新のJSONを再読み込みしました');}
    }catch(e){fail(e);}finally{busy='';}
  }
  async function exportImage() {
    if(!canvas || busy)return;busy='家系図を画像にしています';
    try {
      await document.fonts.ready;
      const images=Array.from(canvas.querySelectorAll('img'));await Promise.all(images.map(i=>i.decode().catch(()=>{})));
      const ratio=Math.min(1,8192/Math.max(tree!.width,tree!.height),Math.sqrt(32_000_000/(tree!.width*tree!.height)));
      const blob=await toBlob(canvas,{pixelRatio:ratio,cacheBust:false,skipFonts:true,width:tree!.width,height:tree!.height,style:{transform:'none',margin:'0'},filter:node=>!(node instanceof HTMLElement && node.dataset.export==='hide')});
      if(!blob)throw new Error('画像を生成できませんでした。');
      if(await savePng(blob,`${family.familyName.replace(/[<>:"/\\|?*]/g,'_')}-家系図.png`))notify('家系図をPNGで書き出しました');
    }catch(e){fail(e);}finally{busy='';}
  }
  function fit() {if(viewport && tree){zoom=Math.min(1,Math.max(.15,Math.min((viewport.clientWidth-48)/tree.width,(viewport.clientHeight-48)/tree.height)));viewport.scrollTo(0,0);}}
  function resetView() {if(viewport && tree){zoom=Math.min(1,Math.max(.6,(viewport.clientWidth-48)/tree.width));void tick().then(()=>{if(viewport)viewport.scrollTo(Math.max(0,(viewport.scrollWidth-viewport.clientWidth)/2),0);});}}
  function adjustZoom(delta:number) {zoom=Math.min(2,Math.max(.15,Math.round((zoom+delta)*100)/100));}
  function startPan(e:PointerEvent) {
    if((e.target as HTMLElement).closest('button') || e.button!==0)return;
    if(!viewport)return;
    pan={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};panning=true;viewport.setPointerCapture(e.pointerId);
  }
  function movePan(e:PointerEvent) {if(pan&&viewport){viewport.scrollLeft=pan.left-(e.clientX-pan.x);viewport.scrollTop=pan.top-(e.clientY-pan.y);}}
  function changeAppearance(key:'theme'|'background',value:string) {families=families.map((f,i)=>i===selected?{...f,[key]:value,...(key==='theme'?{background:''}:{})}:f);changed();}
  function shortcut(e:KeyboardEvent) {if((e.ctrlKey||e.metaKey)&&e.key==='s'){e.preventDefault();void save();}if(e.key==='Escape'&&pane)void closePane();}
  onMount(()=>{
    let unlisten:(()=>void)|undefined;
    let disposed=false;
    if(isTauri())void import('@tauri-apps/api/window').then(async({getCurrentWindow})=>{
      const window=getCurrentWindow();
      const stop=await window.onCloseRequested(async event=>{
        event.preventDefault();
        if(busy){notify('処理が終わってから閉じてください');return;}
        if(!ready || !await canLeaveEditor())return;
        await persist();
        if(draftState!=='下書き保存失敗')await window.destroy();
      });
      if(disposed)stop();else unlisten=stop;
    }).catch(fail);
    void (async()=>{
      try {
        const draft=await readDraft();
        const lastSelected=await readSelectedFamily();
        if(draft&&!isTauri()){families='characters' in draft ? parseWorkspace(JSON.stringify(draft.characters),JSON.stringify(draft.families)) : upgradeDraft(parseFamilies(JSON.stringify(draft.families)));extraCharacters=draft.extraCharacters??[];selected=Math.max(0,Math.min(lastSelected??draft.selected,families.length-1));dirty=draft.dirty;filePath=draft.filePath??'';}
        const disk=await startupJson();
        if(disk&&!isTauri()){
          if(!draft?.dirty){filePath=disk.path;families=disk.families;selected=Math.max(0,Math.min(selected,families.length-1));dirty=false;}
          else {if(filePath!==disk.path)filePath='';notify('未保存の下書きを復元しました。外部の変更は「再読み込み」で反映できます');}
        }
        if(!draft && lastSelected!==undefined&&!isTauri())selected=Math.max(0,Math.min(lastSelected,families.length-1));
        if(isTauri()){
          if(!disk){families=[];extraCharacters=[];selected=0;dirty=false;filePath='';await clearDraft();}
          else{
            const normalizePath=(path:string|undefined)=>(path??'').replace(/\\/g,'/').replace(/\/+$/,'').toLowerCase();
            const sameFile=!!draft?.filePath&&normalizePath(draft.filePath)===normalizePath(disk.path);
            if(draft?.dirty&&sameFile){families='characters' in draft?parseWorkspace(JSON.stringify(draft.characters),JSON.stringify(draft.families)):upgradeDraft(parseFamilies(JSON.stringify(draft.families)));extraCharacters=draft.extraCharacters??[];selected=Math.max(0,Math.min(lastSelected??draft.selected,families.length-1));dirty=true;filePath=disk.path;}
            else{families=disk.families;extraCharacters=families.length?[]:disk.characters;selected=sameFile?Math.max(0,Math.min(lastSelected??draft?.selected??0,families.length-1)):0;dirty=false;filePath=disk.path;if(draft&&!sameFile)await clearDraft();}
          }
        }
        worlds=await loadWorlds();
      }
      catch(e){fail(e);}
      ready=true;draftState='下書き保存済み';await tick();resetView();
    })();
    return ()=>{disposed=true;unlisten?.();clearTimeout(toastTimer);};
  });
</script>

<svelte:window onkeydown={shortcut} onbeforeunload={e=>{if(editorDirty){e.preventDefault();e.returnValue='';}}}/>

<div class="app-shell" aria-busy={!ready}>
  <aside class="family-rail" aria-label="ファミリー">
    <img class="app-logo" src={logo} alt="Sims4 Roots"/>
    <span class="rail-divider"></span>
    <div class="family-tabs" bind:this={familyTabs}>{#each families as f,i}<button class="family-tab" class:active={selected===i} class:dragging={draggedFamily===i} class:drop-before={dropFamily===i&&!dropAfter&&draggedFamily!==i} class:drop-after={dropFamily===i&&dropAfter&&draggedFamily!==i} onpointerdown={event=>dragFamilyStart(event,i)} onpointermove={dragFamilyMove} onpointerup={dragFamilyEnd} onpointercancel={cancelFamilyDrag} onclick={()=>clickFamily(i)} title={familyTitle(f)} aria-label={familyTitle(f)} aria-pressed={selected===i}>
      {#if safeImage(f.image)}<img src={safeImage(f.image)} alt="" draggable="false"/>{:else}<span>{familyTitle(f).replace(/家$/,'').slice(0,1)}</span>{/if}
      <span class="rail-tooltip">{familyTitle(f)}</span>
    </button>{/each}<button class="rail-add" onclick={()=>editHouse(true)} title="ファミリーを追加" aria-label="ファミリーを追加"><Plus size={21}/></button></div>
    <button class="rail-help" onclick={()=>showPane('help')} title="使い方" aria-label="使い方"><CircleHelp size={21}/></button>
    <span class="rail-version">v0.1</span>
  </aside>
  <div class="main-shell">
    <header class="topbar">
      <div class="wordmark">Sims4 Roots<span>THE STORIES WE CONNECT</span></div>
      <div class="top-actions"><button class="button plain" onclick={reload} disabled={!!busy} title={filePath || 'JSONファイルから再読み込み'} aria-label="再読み込み"><RotateCcw size={16}/><span>再読み込み</span></button><button class="button secondary" onclick={()=>save()} disabled={!!busy}><Save size={16}/><span>JSONを保存</span>{#if dirty}<span class="dirty-dot"></span>{/if}</button><button class="button primary manager-button" onclick={()=>showPane('worlds')}><MapPin size={16}/><span>ワールド一覧</span></button><button class="button primary manager-button" onclick={()=>showPane('characters')}><UsersRound size={16}/><span>シム一覧</span></button></div>
    </header>
    <main class="workspace">
      <div class="family-header">
        <div><div class="family-title"><h1>{family ? familyTitle(family) : 'あなたの物語を、ここから。'}</h1></div>
          <div class="family-meta"><span><MapPin size={14}/>{family?.world || 'ワールド未設定'}</span><span><UsersRound size={14}/>{family?.members.length??0} 人のシム{family?.formerMembers?.length ? ` · 家を出たシム ${family.formerMembers.length} 人` : ''}</span><span><GitFork size={14}/>{tree?.generations??0} 世代</span></div>
        </div>
        <div class="family-actions"><button class="icon-button framed" aria-label="画像を書き出す" title="画像を書き出す" onclick={exportImage} disabled={!tree?.nodes.length||!!busy}><Download size={19}/></button><button class="icon-button framed" aria-label="表示設定" title="表示設定" onclick={()=>showPane('settings')} disabled={!family}><Settings2 size={19}/></button>{#if family}<button class="icon-button framed" title="ファミリーを編集" aria-label="ファミリーを編集" onclick={()=>editHouse()}><Pencil size={16}/></button><button class="icon-button framed family-delete" title="ファミリーを削除" aria-label="ファミリーを削除" onclick={removeFamily}><Trash2 size={16}/></button>{/if}</div>
      </div>
      <div class="canvas-frame">
        <div class="canvas-label"><GitFork size={14}/><span>FAMILY TREE</span><span class="canvas-label-line"></span><span>{family ? familyTitle(family) : 'Sims4 Roots'}</span></div>
        {#if family && tree?.nodes.length}
          <!-- svelte-ignore a11y_no_noninteractive_tabindex (scrollable canvas supports native keyboard scrolling) -->
          <div class="tree-viewport" class:panning bind:this={viewport} role="region" aria-label="家系図。ドラッグで移動" tabindex="0" onpointerdown={startPan} onpointermove={movePan} onpointerup={()=>{pan=null;panning=false;}} onpointercancel={()=>{pan=null;panning=false;}}>
            <div class="canvas-spacer" style:width="{tree.width*zoom}px" style:height="{tree.height*zoom}px">
              <div class="tree-canvas" class:dark={useLightText} bind:this={canvas} style:width="{tree.width}px" style:height="{tree.height}px" style:transform="scale({zoom})" style:background={backdrop}>
                <div class="export-heading"><span class="tree-display-name">{familyTitle(family)}</span></div>
                {#if family.world}<div class="tree-world"><button title="{family.world} を編集" aria-label="{family.world} を編集" onclick={()=>{const index=worlds.findIndex(world=>world.world===family.world);if(index>=0)void openWorld(index);else void showPane('worlds');}}><span class="world-portrait">{#if safeImage(worldImage)}<img src={safeImage(worldImage)} alt=""/>{:else}<MapPin size={22}/>{/if}</span></button><span class="tree-display-name">{family.world}</span></div>{/if}
                <div class="export-title">SIMS4 ROOTS</div>
                <svg class="tree-lines" xmlns="http://www.w3.org/2000/svg" width={tree.width} height={tree.height} aria-hidden="true">{#each tree.lines as line}<path d={line.renderD ?? line.d} class:adoptive={line.adoptive} class:partner-link={line.partnerLink} fill="none" stroke={line.partnerLink?(useLightText?'#faf8f4':'#294536'):'#ffffff'} stroke-width={line.partnerLink?2.5:3} stroke-dasharray={line.partnerLink?'1 7':line.adoptive?'5 7':undefined} stroke-linejoin="round" stroke-linecap="round" style={line.partnerLink?`stroke:${useLightText?'#faf8f4':'#294536'};stroke-width:2.5;stroke-dasharray:1 7;opacity:.8;filter:none`:undefined}/>{/each}</svg>
                {#each tree.bonds as bond}<img class="couple-status" style:left="{bond.x-21}px" style:top="{bond.y-21}px" src={statusIcon(bond.status)} alt={statuses[bond.status]} title={statuses[bond.status]}/>{/each}
                <div class="family-side-icons">
                  {#each family.servants ?? [] as servant (servant.characterName)}<button class="servant" title={title(servant)} aria-label={title(servant)} onclick={()=>edit(servant)}><span class="servant-portrait">{#if safeImage(servant.image)}<img src={safeImage(servant.image)} alt={title(servant)}/>{:else}<UserRound size={22}/>{/if}</span><span class="character-name servant-name">{title(servant)}</span></button>{/each}
                  {#each family.pets ?? [] as pet}<button class="pet" title={pet} onclick={()=>editHouse()}><span class="pet-portrait">{#if safeImage(family.petImages?.[pet])}<img src={safeImage(family.petImages?.[pet])} alt={pet}/>{:else}<PawPrint size={22}/>{/if}</span><span class="character-name pet-name">{pet}</span></button>{/each}
                </div>
                {#each tree.nodes as node (node.key)}<TreeCharacter {node} {families} {family} selected={pane==='character'?editCharacter.characterName:undefined} onselect={c=>edit(c)} onfamilyselect={index=>void chooseFamily(index)}/>{/each}
              </div>
            </div>
          </div>
        {:else}<div class="empty-state"><Sprout size={48} strokeWidth={1}/><h2>ひとりのシムから、広がる物語。</h2><p>上部のシム一覧でシムを作成し、ファミリー編集で所属を追加してください。</p>{#if !family}<button class="button primary" onclick={()=>editHouse(true)}><Plus size={16}/>ファミリーを作成</button>{/if}</div>{/if}
        <div class="canvas-bottom"><span><span class="hint-dot"></span>ドラッグで移動 · シムをクリックして編集</span><div class="zoom-controls"><button aria-label="縮小" title="縮小" onclick={()=>adjustZoom(-.1)}><ZoomOut size={17}/></button><span>{Math.round(zoom*100)}%</span><button aria-label="拡大" title="拡大" onclick={()=>adjustZoom(.1)}><ZoomIn size={17}/></button><i></i><button aria-label="全体を表示" title="全体を表示" onclick={fit}><Scan size={17}/></button></div></div>
      </div>
      <footer class="workspace-footer"><div class="status-legend">{#each Object.entries(statuses) as [key,name]}<span><img src={statusIcon(key)} alt=""/>{name}</span>{/each}</div><span class="local-status"><Check size={13}/>{draftState}</span></footer>
    </main>
    <div class="filebar"><span class="file-name" title={filePath || 'ファイル未選択'}><span class:unsaved={dirty} class="file-dot"></span>{filePath ? 'characters.json + families.json' : '内蔵サンプル / characters.json + families.json'}{dirty?' · JSONに未保存':''}</span>{#if issues.length}<button onclick={()=>showPane('issues')}><AlertTriangle size={13}/>{issues.length} 件の確認事項</button>{/if}<span class="filebar-end">SIMS4 ROOTS · LOCAL WORKSPACE</span></div>
  </div>
  {#if pane}<aside class="detail-pane" aria-label="編集パネル">
    <header class="pane-header"><div><span class="eyebrow">{pane==='settings'?'MAKE IT YOURS':pane==='issues'?'DATA CHECK':'YOUR FAMILY STORY'}</span><h2>{pane==='worlds'?'ワールド一覧':pane==='world'?(worldIndex<0?'ワールドを追加':'ワールドを編集'):pane==='characters'?'シム一覧':pane==='character'?(editIndex===-1||editIndex===-3?'シムを追加':'シムを編集'):pane==='family'?(newFamily?'ファミリーを追加':'ファミリーを編集'):pane==='settings'?'表示設定':pane==='issues'?'データの確認':'使い方'}</h2></div><button class="icon-button" aria-label="パネルを閉じる" onclick={closePane}><X size={20}/></button></header>
    <div class="pane-body">
      {#if pane==='worlds'}<div class="character-manager"><div class="manager-actions"><button class="button primary" onclick={()=>openWorld()}><Plus size={16}/>ワールドを追加</button></div><div class="manager-count">{worlds.length} 件のワールド</div>{#each worlds as world,i (world.world)}<div class="list-row manager-row world-row"><span class="world-list-thumb">{#if safeImage(world.image)}<img src={safeImage(world.image)} alt=""/>{:else}<MapPin size={18}/>{/if}</span><span>{world.world}</span><button class="icon-button" aria-label="{world.world} を編集" onclick={()=>openWorld(i)}><Pencil size={16}/></button><button class="icon-button" aria-label="{world.world} を削除" onclick={()=>removeWorld(i)}><Trash2 size={16}/></button></div>{/each}</div>
      {:else if pane==='world'}{#key editorKey}<WorldEditor world={editWorld} isNew={worldIndex<0} onsave={saveWorld} onchange={()=>editorDirty=true}/>{/key}
      {:else if pane==='characters'}<div class="character-manager"><div class="manager-actions"><input aria-label="一覧内のシムを検索" placeholder="シムを検索" bind:value={managerQuery}/><button class="button primary" onclick={()=>edit(undefined,selected,true)}><Plus size={16}/>シムを追加</button></div><div class="manager-count">{visibleCharacters.length} 人のシム</div>{#each visibleCharacters as person (person.characterName)}<div class="list-row manager-row"><span>{title(person)}<small>{person.characterName}</small></span><button class="icon-button" aria-label="{person.characterName} を編集" onclick={()=>edit(person,selected,true)}><Pencil size={16}/></button><button class="icon-button" aria-label="{person.characterName} を削除" onclick={()=>removeCharacter(person.characterName)}><Trash2 size={16}/></button></div>{:else}<p class="muted">該当するシムはいません。</p>{/each}</div>
      {:else if pane==='character'}{#key editorKey}<CharacterEditor character={editCharacter} {characters} {families} isNew={editIndex===-1||editIndex===-3} onsave={saveCharacter} onchange={()=>editorDirty=true}/>{/key}
      {:else if pane==='family'}{#key editorKey}<FamilyEditor family={newFamily?{familyName:'',displayName:'',world:'',members:[],formerMembers:[],theme:'dusk'}:families[editFamily]} {characters} worlds={worlds.map(world=>world.world)} isNew={newFamily} onsave={saveFamily} onchange={()=>editorDirty=true}/>{/key}
      {:else if pane==='settings' && family}<div class="editor-form"><div class="section-label"><Image size={15}/>家系図の背景</div><p class="muted">このファミリーの背景をカスタマイズ。</p><div class="theme-grid">{#each Object.entries(themes) as [key,theme]}<button class:chosen={family.theme===key||(!themes[family.theme ?? '']&&key==='meadow')} class:light-text={theme.lightText} style:background={theme.background} onclick={()=>changeAppearance('theme',key)}>{theme.name}</button>{/each}</div><ImageField value={family.background} large label="背景画像を選択" onchange={v=>changeAppearance('background',v)}/><button class="button secondary" onclick={()=>{changeAppearance('theme','dusk');}}><RotateCcw size={15}/>背景をリセット</button></div>
      {:else if pane==='issues'}<div class="issues"><p class="muted">元データは自動修正しません。識別名や参照先を、シムの編集画面で確認できます。</p>{#each issues as issue}<div class="issue"><AlertTriangle size={16}/><p>{issue}</p></div>{:else}<p>確認が必要な項目はありません。</p>{/each}</div>
      {:else if pane==='help'}<div class="help-content"><h3>物語をつなぐ、あなただけの家系図。</h3><p>左のアイコンでファミリーを切り替えます。シムや右側のパートナーをクリックすると、右ペインで編集できます。</p><h4>保存について</h4><p>反映した変更は、このPCの下書きに自動保存されます。「JSONを保存」でファイルへ書き込みます。同じフォルダーの characters.json と families.json に保存します。Ctrl+Sで保存します。</p><h4>親子と兄弟</h4><p>親の識別名から線をつなぎます。片親が未設定なら、設定された親からだけ接続します。親が不明な場合の兄弟関係は点線で表示します。兄弟順の小さい順に並びます。</p><h4>写真と画像出力</h4><p>シム・ペット・ファミリー・背景に画像を設定できます。画像はJSONに埋め込まれます。「画像を書き出す」は、画面外も含む家系図全体をPNGにします。</p><h4>未登録の人物</h4><p>名前だけの人物もプレースホルダーで表示され、クリックで追加できます。ペットの写真はファミリーの編集画面で設定します。</p></div>{/if}
    </div>
  </aside>{/if}
</div>
{#if toast}<div class="toast" role="status"><Check size={17}/>{toast}</div>{/if}
{#if busy||!ready}<div class="busy-overlay" role="status"><LoaderCircle class="spin" size={24}/>{busy||'ワークスペースを開いています'}</div>{/if}
{#if failure}<div class="error-banner" role="alert"><AlertTriangle size={19}/><span>{failure}</span><button aria-label="エラーを閉じる" onclick={()=>failure=''}><X size={18}/></button></div>{/if}
