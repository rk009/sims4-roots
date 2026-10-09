export const statuses = { married: '結婚', love_marriage: '恋愛結婚', marriage_of_convenience: '見合い結婚', engaged: '婚約', dating: '恋人', brokenup: '破局', divorced: '離婚', widowed: '死別', bestfriend: '親友', summser_fling: 'ひと夏の恋', friendzone_right: '片思い', friendzone_left: '想われ人', flirting: '浮気', family: 'その他' } as const;
export type Status = keyof typeof statuses;
export const occults = { person: '人間', ghost: 'ゴースト', alien: 'エイリアン', vampire: 'ヴァンパイア', spellcaster: '魔法使い', werewolf: 'ウェアウルフ', mermaid: '人魚', fairy: '妖精', servo: 'サーボ', plant_sim: '植物シム', sulanimana: 'スラニ・マナ' } as const;
export interface Partner { characterName: string; status: Status }
export interface Character {
  characterName: string; displayName?: string; mainFamily?: string; occult?: string; star?: boolean; isDead?: boolean;
  father?: string; mother?: string; adoptiveFather?: string; adoptiveMother?: string; brotherNumber?: number;
  twins?: string[]; children?: string[]; pets?: string[]; partners?: Partner[];
  image?: string; petImages?: Record<string, string>; [key: string]: unknown;
}
export interface Family { familyName: string; displayName?: string; world: string; members: Character[]; formerMembers?: Character[]; servants?: Character[]; catalog?: Character[]; pets?: string[]; petImages?: Record<string,string>; image?: string; background?: string; theme?: string; [key: string]: unknown }
// The workspace can contain megabytes of base64 images. Copy its arrays and
// objects while retaining immutable string values instead of serializing them.
export const clone = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(item => clone(item)) as T;
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, clone(item)])) as T;
  return value;
};
function cloneFamilies(families:Family[]): Family[] {
  const copies=clone(families.map(({catalog,...family})=>family));
  const catalogs=new Map<Character[],Character[]>();
  return copies.map((family,index)=>{
    const source=families[index].catalog;
    if(!source)return family;
    if(!catalogs.has(source))catalogs.set(source,clone(source));
    return {...family,catalog:catalogs.get(source)!};
  });
}
export const title = (c: Character) => c.displayName || c.characterName;
export const familyTitle = (f: Family) => f.displayName?.trim() || f.familyName;
export const isUnknownParent = (name?: string) => !!name && name.startsWith('noparents_') && name.length > 'noparents_'.length;
export function parseFamilies(text: string): Family[] {
  let data: unknown;
  try { data = parseJson(text); } catch { throw new Error('JSONの書式が正しくありません。括弧やカンマを確認してください。'); }
  if (!Array.isArray(data)) throw new Error('JSONの一番外側はファミリーの配列にしてください。');
  const familyNames=new Set<string>();
  for (const [i, f] of data.entries()) {
    if (!f || typeof f.familyName !== 'string' || !f.familyName.trim() || !Array.isArray(f.members)) throw new Error(`${i + 1}番目のファミリーには familyName と members 配列が必要です。`);
    if (familyNames.has(f.familyName)) throw new Error(`ファミリーの識別名「${f.familyName}」が重複しています。`);
    familyNames.add(f.familyName);
    if (f.displayName !== undefined && typeof f.displayName !== 'string') throw new Error(`${f.familyName}: displayName は文字列にしてください。`);
    if (f.world !== undefined && typeof f.world !== 'string') throw new Error('world は文字列にしてください。');
    f.world ??= '';
    for (const k of ['image', 'background', 'theme']) if (f[k] !== undefined && typeof f[k] !== 'string') throw new Error(`${f.familyName}: ${k} は文字列にしてください。`);
    if (f.formerMembers !== undefined && !Array.isArray(f.formerMembers)) throw new Error(`${f.familyName}: formerMembers は配列にしてください。`);
    if (f.servants !== undefined && !Array.isArray(f.servants)) throw new Error(`${f.familyName}: servants must be an array`);
    for (const c of [...f.members, ...(f.formerMembers ?? []), ...(f.servants ?? [])]) {
      if (!c || typeof c.characterName !== 'string' || !c.characterName.trim()) throw new Error(`${f.familyName}: characterName が必要です。`);
      for (const key of ['displayName', 'mainFamily', 'occult', 'father', 'mother', 'adoptiveFather', 'adoptiveMother', 'image']) if (c[key] !== undefined && typeof c[key] !== 'string') throw new Error(`${c.characterName}: ${key} は文字列にしてください。`);
      if (c.star !== undefined && typeof c.star !== 'boolean') throw new Error(`${c.characterName}: star は true / false にしてください。`);
      if (c.isDead !== undefined && typeof c.isDead !== 'boolean') throw new Error(`${c.characterName}: isDead は true / false にしてください。`);
      if (c.brotherNumber !== undefined && (!Number.isInteger(c.brotherNumber) || c.brotherNumber < 0)) throw new Error(`${c.characterName}: brotherNumber は0以上の整数にしてください。`);
      for (const key of ['twins', 'pets', 'children']) if (c[key] !== undefined && (!Array.isArray(c[key]) || c[key].some((s: unknown) => typeof s !== 'string'))) throw new Error(`${c.characterName}: ${key} は文字列の配列にしてください。`);
      if (c.partners !== undefined && (!Array.isArray(c.partners) || c.partners.some((p: Partner) => !p || typeof p.characterName !== 'string' || !(p.status in statuses)))) throw new Error(`${c.characterName}: 関係ステータスが不正です。`);
      if (c.petImages !== undefined && (!c.petImages || typeof c.petImages !== 'object' || Array.isArray(c.petImages) || Object.values(c.petImages).some(v => typeof v !== 'string'))) throw new Error(`${c.characterName}: petImages が不正です。`);
    }
  }
  return data;
}
export function resolve(families: Family[], family: Family, name: string): Character | undefined {
  return [...family.members, ...(family.formerMembers ?? []), ...(family.servants ?? [])].find(c => c.characterName === name) ?? families.flatMap(f => [...f.members, ...(f.formerMembers ?? []), ...(f.servants ?? [])]).find(c => c.characterName === name) ?? families.flatMap(f => f.catalog ?? []).find(c => c.characterName === name);
}
export function diagnostics(families: Family[]): string[] {
  const messages: string[] = [];
  const counts = new Map<string, number>();
  for (const f of families) for (const c of [...f.members, ...(f.formerMembers ?? []), ...(f.servants ?? [])]) counts.set(c.characterName, (counts.get(c.characterName) ?? 0) + 1);
  for(const f of families)for(const c of f.catalog ?? [])if(!counts.has(c.characterName))counts.set(c.characterName,1);
  for (const [name, count] of counts) if (count > 1 && !families.some(f=>f.catalog)) messages.push(`「${name}」が${count}件あります。同じファミリーの人物を優先して参照します。`);
  for (const f of families) for (const c of [...f.members, ...(f.formerMembers ?? []), ...(f.servants ?? [])]) {
    if(f.catalog && !f.catalog.some(p=>p.characterName===c.characterName))messages.push(c.characterName+' は characters.json に未登録です。');
    const refs = [c.father, c.mother, c.adoptiveFather, c.adoptiveMother, ...(c.twins ?? []), ...(c.children ?? []), ...(c.partners ?? []).map(p => p.characterName)].filter(ref=>ref && !isUnknownParent(ref)) as string[];
    for (const ref of new Set(refs)) if (!counts.has(ref)) messages.push(`${title(c)} → 「${ref}」は未登録です。`);
    if ([c.father, c.mother, c.adoptiveFather, c.adoptiveMother].includes(c.characterName)) messages.push(`${title(c)}の親が本人になっています。`);
    if (c.mainFamily && !families.some(home=>home.familyName===c.mainFamily)) messages.push(`${title(c)}のメイン世帯「${c.mainFamily}」は未登録です。`);
  }
  return [...new Set(messages)];
}
export function replaceFamily(families: Family[], index: number, value: Family): Family[] {
  const name=value.familyName.trim();
  if (!name) throw new Error('ファミリーの識別名を入力してください。');
  if (families.some((family,i)=>i!==index && family.familyName===name)) throw new Error('このファミリー識別名は既に使われています。');
  const oldName=families[index].familyName;
  const result=cloneFamilies(families);
  const catalog=result[index].catalog;
  const {catalog:ignored,...editable}=value;
  result[index]={...clone(editable),familyName:name,catalog};
  if(oldName!==name){
    const visited=new Set<Character>();
    for(const family of result)for(const person of [...family.members,...(family.formerMembers ?? []),...(family.catalog ?? [])]){
      if(visited.has(person))continue;
      visited.add(person);
      if(person.mainFamily===oldName)person.mainFamily=name;
    }
  }
  return result;
}
export function replaceCharacter(families: Family[], fi: number, ci: number, value: Character, catalogName?: string): Family[] {
  const result = cloneFamilies(families);
  const oldName = ci === -2 ? catalogName : ci === -4 ? catalogName : result[fi].members[ci]?.characterName;
  const newName = value.characterName.trim();
  if (!newName) throw new Error('識別名を入力してください。');
  if (result.some((f, i) => [...f.members, ...(f.formerMembers ?? [])].some((c, j) => !(i === fi && j === ci) && c.characterName === newName)) && newName !== oldName) throw new Error('この識別名は既に使われています。別の名前にしてください。');
  if (ci === -1) result[fi].members.push({ ...value, characterName: newName });
  else if(ci >= 0) result[fi].members[ci] = { ...value, characterName: newName };
  else if(ci === -4) result[fi].formerMembers = result[fi].formerMembers?.map(c=>c.characterName===oldName ? {...value,characterName:newName} : c);
  if (oldName && oldName !== newName) {
    const ambiguous = !families.some(f=>f.catalog) && families.flatMap(f => f.members).filter(c => c.characterName === oldName).length > 1;
    for (const [i, f] of result.entries()) {
      if (ambiguous && i !== fi) continue;
      f.formerMembers = f.formerMembers?.map((c:Character):Character=>c.characterName===oldName ? {...c,characterName:newName} : c);
      f.servants = f.servants?.map((c:Character):Character=>c.characterName===oldName?{...c,characterName:newName}:c);
      for (const c of [...f.members, ...(f.formerMembers ?? []), ...(f.servants ?? []), ...(f.catalog ?? [])] as Character[]) {
        if (c.characterName === oldName && f.catalog) c.characterName = newName;
        if (c.father === oldName) c.father = newName;
        if (c.mother === oldName) c.mother = newName;
        if (c.adoptiveFather === oldName) c.adoptiveFather = newName;
        if (c.adoptiveMother === oldName) c.adoptiveMother = newName;
        for (const key of ['twins', 'children'] as const) if (c[key]) c[key] = c[key]!.map(n => n === oldName ? newName : n);
        if (c.partners) c.partners = c.partners.map(p => ({ ...p, characterName: p.characterName === oldName ? newName : p.characterName }));
      }
    }
  }
  if (result.some(f=>f.catalog)) {
    const personal = personalData({...value, characterName:newName});
    for (const f of result) {
      f.catalog = (f.catalog ?? []).filter(c=>c.characterName!==oldName && c.characterName!==newName);
      f.catalog.push(personal);
      f.members = f.members.map(c=>c.characterName===newName || c.characterName===oldName ? clone(personal) : c);
      f.formerMembers = f.formerMembers?.map(c=>c.characterName===newName || c.characterName===oldName ? clone(personal) : c);
      f.servants = f.servants?.map(c=>c.characterName===newName || c.characterName===oldName ? clone(personal) : c);
    }
  }
  return result;
}
export function safeImage(value?: string): string | undefined {
  return value && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(value) ? value : undefined;
}
export const splitNames = (s: string) => [...new Set(s.split(/[,、\n]/).map(v => v.trim()).filter(Boolean))];

// Accept the trailing commas used by the hand-edited configuration without touching strings.
export function parseJson(text:string): any {
  return JSON.parse(text.replace(/^\uFEFF/,'').replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (match, quoted, end)=>quoted ?? end));
}
function personalData(c:Character): Character {
  const data=clone(c);
  data.isDead=c.isDead===true;
  for(const k of ['pets','petImages','_familyData','brothers']) delete data[k];
  if(data.partners) data.partners=data.partners.map(relation=>{
    const {member,members,...partner}=relation as Partner & {member?:boolean;members?:boolean};
    return partner;
  });
  return data;
}
export function parseCharacterList(charactersText:string): Character[] {
  const characters=parseJson(charactersText);
  if(!Array.isArray(characters))throw new Error('characters.json はキャラクターの配列にしてください。');
  parseFamilies(JSON.stringify([{familyName:'characters.json',members:characters}]));
  const names=new Set<string>();
  for(const character of characters){
    if(names.has(character.characterName))throw new Error(`characters.json: duplicate identifier ${character.characterName}`);
    names.add(character.characterName);
  }
  return characters as Character[];
}

export function parseWorkspace(charactersText:string, familiesText:string): Family[] {
  const characters=parseJson(charactersText), raw=parseJson(familiesText);
  if(!Array.isArray(characters)) throw new Error('characters.json はキャラクターの配列にしてください。');
  parseFamilies(JSON.stringify([{familyName:'characters.json',members:characters}]));
  const names=new Set<string>();
  for(const c of characters){if(names.has(c.characterName))throw new Error('characters.json: 識別名が重複しています: '+c.characterName);names.add(c.characterName);}
  if(!Array.isArray(raw))throw new Error('families.json はファミリーの配列にしてください。');
  const byName=new Map<string,Character>(characters.map((c:Character)=>[c.characterName,c]));
  for(const f of raw)for(const entry of [...(f.members ?? []), ...(f.formerMembers ?? []), ...(f.servants ?? [])]){
    if(typeof entry==='string')continue;
    const c=byName.get(entry.characterName);
    if(!c)continue;
    if(c.brotherNumber===undefined && entry.brotherNumber!==undefined)c.brotherNumber=entry.brotherNumber;
    if(c.twins===undefined && entry.twins!==undefined)c.twins=entry.twins;
  }
  const result=parseFamilies(JSON.stringify(raw.map(f=>{
    const entries:string[]=f.members?.map((entry:string|Character)=>typeof entry==='string'?entry:entry.characterName) ?? [];
    const names=[...new Set(entries)];
    for(const entry of f.members ?? [])if(typeof entry!=='string')for(const partner of entry.partners ?? []){
      const p=partner as Partner & {member?:boolean;members?:boolean};
      if((p.member===true || p.members===true) && !names.includes(p.characterName))names.push(p.characterName);
    }
    const formerNames:string[]=[...new Set<string>((f.formerMembers ?? []).map((entry:string|Character)=>typeof entry==='string'?entry:entry.characterName))].filter(name=>!names.includes(name));
    const servantNames:string[]=[...new Set<string>((f.servants ?? []).map((entry:string|Character)=>typeof entry==='string'?entry:entry.characterName))].filter(name=>!names.includes(name)&&!formerNames.includes(name));
    return {...f,members:names.map(name=>clone(byName.get(name) ?? {characterName:name})),formerMembers:formerNames.map(name=>clone(byName.get(name) ?? {characterName:name})),servants:servantNames.map(name=>clone(byName.get(name) ?? {characterName:name}))};
  })));
  for(const family of result)family.catalog=characters;
  return result;
}
export function upgradeDraft(families:Family[]): Family[] {
  const result=cloneFamilies(families);
  for(const f of result){
    const names=new Set([...f.members,...(f.formerMembers ?? [])].map(c=>c.characterName));
    const added=new Set<string>();
    const members:Character[]=[];
    for(const c of f.members){
      members.push(c);
      for(const relation of c.partners ?? []){
        const p=relation as Partner & {member?:boolean;members?:boolean};
        if((p.member===true || p.members===true) && !names.has(p.characterName) && !added.has(p.characterName)){
          members.push(clone(resolve(result,f,p.characterName) ?? {characterName:p.characterName}));
          added.add(p.characterName);
        }
      }
    }
    f.members=members;
  }
  const seenCatalogs=new Set<Character[]>();
  for(const f of result){
    for(const c of [...f.members,...(f.formerMembers ?? [])])if(c.partners)c.partners=personalData(c).partners;
    if(f.catalog && !seenCatalogs.has(f.catalog)){
      seenCatalogs.add(f.catalog);
      for(const c of f.catalog)if(c.partners)c.partners=personalData(c).partners;
    }
  }
  return result;
}
export function splitWorkspace(families:Family[], extraCharacters:Character[] = []) {
  families=upgradeDraft(families);
  const catalog=new Map<string,Character>();
  const seenCatalogs=new Set<Character[]>();
  for(const character of extraCharacters)catalog.set(character.characterName,personalData(character));
  for(const f of families)if(f.catalog && !seenCatalogs.has(f.catalog)){
    seenCatalogs.add(f.catalog);
    for(const c of f.catalog)catalog.set(c.characterName,personalData(c));
  }
  for(const f of families)for(const c of [...f.members,...(f.formerMembers ?? []),...(f.servants ?? [])])catalog.set(c.characterName,personalData(c));
  return {characters:[...catalog.values()],families:families.map(({catalog:storedCatalog,members,formerMembers,servants,...f})=>({...f,members:members.map(c=>c.characterName),...(formerMembers?.length ? {formerMembers:formerMembers.map(c=>c.characterName)} : {}),...(servants?.length ? {servants:servants.map(c=>c.characterName)} : {})}))};
}
export function addCharacter(families:Family[], value:Character): Family[] {
  const name=value.characterName.trim();
  if(!name)throw new Error('識別名を入力してください。');
  if(families.some(f=>[...f.members,...(f.formerMembers ?? []),...(f.catalog ?? [])].some(c=>c.characterName===name)))throw new Error('この識別名は既に使われています。');
  const result=cloneFamilies(families);
  for(const f of result)f.catalog=[...(f.catalog ?? []),personalData({...value,characterName:name})];
  return result;
}
export function deleteCharacter(families:Family[], name:string): Family[] {
  const result=cloneFamilies(families);
  for(const f of result){
    f.members=f.members.filter(c=>c.characterName!==name);
    f.formerMembers=f.formerMembers?.filter(c=>c.characterName!==name);
    f.servants=f.servants?.filter(c=>c.characterName!==name);
    if(f.catalog)f.catalog=f.catalog.filter(c=>c.characterName!==name);
    for(const c of [...f.members,...(f.formerMembers ?? []),...(f.catalog ?? [])]){
      if(c.father===name)c.father='';
      if(c.mother===name)c.mother='';
      if(c.adoptiveFather===name)c.adoptiveFather='';
      if(c.adoptiveMother===name)c.adoptiveMother='';
      for(const key of ['twins','children'] as const)if(c[key])c[key]=c[key]!.filter(ref=>ref!==name);
      if(c.partners)c.partners=c.partners.filter(p=>p.characterName!==name);
    }
  }
  return result;
}
