import { invoke, isTauri } from '@tauri-apps/api/core';
import { clone, parseCharacterList, parseJson, parseWorkspace, splitWorkspace, type Character, type Family } from './model';
import worldSeed from '../../release/conf/worlds.json';
export interface Snapshot { families: Family[]; selected: number; dirty: boolean; filePath?: string; extraCharacters?: Character[] }
export type StoredSnapshot = Omit<Snapshot,'families'> & ReturnType<typeof splitWorkspace>;
export interface World { world: string; image?: string; [key: string]: unknown }
export const bundledWorlds: World[] = worldSeed.map(entry => ({...entry}));
export async function loadWorlds(): Promise<World[]> {
  const text = isTauri() ? await invoke<string | null>('startup_worlds') : localStorage.getItem('sims4-roots-worlds');
  if (text === null) return clone(bundledWorlds);
  let entries: unknown;
  try { entries = parseJson(text); } catch { throw new Error('worlds.json の書式が正しくありません。'); }
  if (!Array.isArray(entries) || entries.some(entry => !entry || typeof entry.world !== 'string' || !entry.world.trim() || (entry.image !== undefined && typeof entry.image !== 'string'))) throw new Error('worlds.json は world と任意の image を持つ配列にしてください。');
  if (new Set(entries.map(entry => entry.world.trim())).size !== entries.length) throw new Error('worlds.json のワールド名が重複しています。');
  return entries.map(entry => ({...entry,world:entry.world.trim()}));
}
export async function saveWorlds(worlds: World[]): Promise<void> {
  const text=JSON.stringify(worlds,null,2)+'\n';
  if(isTauri()) await invoke('save_worlds',{text});
  else localStorage.setItem('sims4-roots-worlds',text);
}
export async function startupJson() {
  if (!isTauri()) return null;
  const result = await invoke<[string,string,string] | null>('startup_json');
  return result ? { path:result[0], characters:parseCharacterList(result[1]), families:parseWorkspace(result[1],result[2]) } : null;
}
export async function reloadJson(path: string) {
  if (!isTauri()) return null;
  const { readTextFile } = await import('@tauri-apps/plugin-fs');
  const paths = pairPaths(path);
  const charactersText=await readTextFile(paths.characters), familiesText=await readTextFile(paths.families);
  return { path:paths.families, characters:parseCharacterList(charactersText), families:parseWorkspace(charactersText,familiesText) };
}
let dbPromise: Promise<IDBDatabase> | undefined;
function database() {
  return dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('sims4-roots', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('workspace');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readDraft(): Promise<Snapshot | StoredSnapshot | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('workspace').objectStore('workspace').get('draft');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function clearDraft(): Promise<void> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite');
    tx.objectStore('workspace').clear();
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
    tx.onabort=()=>reject(tx.error ?? new Error('下書きを初期化できませんでした。'));
  });
}
export async function readSelectedFamily(): Promise<number | undefined> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const request=db.transaction('workspace').objectStore('workspace').get('selectedFamily');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}
export async function writeSelectedFamily(index:number): Promise<void> {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('workspace','readwrite');
    tx.objectStore('workspace').put(index,'selectedFamily');
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  });
}
export async function writeDraft(value: Snapshot, workspace?: ReturnType<typeof splitWorkspace>) {
  const db = await database();
  const compact:StoredSnapshot={selected:value.selected,dirty:value.dirty,filePath:value.filePath,extraCharacters:clone(value.extraCharacters ?? []),...(workspace ?? splitWorkspace(value.families,value.extraCharacters))};
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    const store=tx.objectStore('workspace');
    store.put(compact, 'draft');
    store.put(value.selected, 'selectedFamily');
    tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('下書き保存が中断されました。'));
  });
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function pairPaths(path:string) {
  const directory=path.slice(0,Math.max(path.lastIndexOf('/'),path.lastIndexOf('\\'))+1);
  return {characters:directory+'characters.json',families:directory+'families.json'};
}
export async function saveJson(families: Family[], existingPath?: string, extraCharacters:Character[] = []): Promise<{path:string; workspace:ReturnType<typeof splitWorkspace>} | null> {
  const data=splitWorkspace(families,extraCharacters);
  const charactersText=JSON.stringify(data.characters,null,2)+'\n', familiesText=JSON.stringify(data.families,null,2)+'\n';
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeTextFile } = await import('@tauri-apps/plugin-fs');
    const defaultPath=await invoke<string>('default_json_path');
    const path = existingPath || await save({ defaultPath, filters: [{ name: 'JSON', extensions: ['json'] }] });
    if (!path) return null;
    await invoke('authorize_json_pair', {path});
    const paths=pairPaths(path);
    await writeTextFile(paths.characters,charactersText);
    await writeTextFile(paths.families,familiesText);
    return {path:paths.families,workspace:data};
  }
  download(new Blob([charactersText], {type:'application/json'}),'characters.json');
  download(new Blob([familiesText], {type:'application/json'}),'families.json'); return {path:'families.json',workspace:data};
}
export async function savePng(blob: Blob, name: string): Promise<boolean> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    const { writeFile } = await import('@tauri-apps/plugin-fs');
    const path = await save({ defaultPath: name, filters: [{ name: 'PNG', extensions: ['png'] }] });
    if (!path) return false;
    await writeFile(path, new Uint8Array(await blob.arrayBuffer()));
  } else download(blob, name);
  return true;
}
export async function confirmAction(message: string) {
  if (isTauri()) return (await import('@tauri-apps/plugin-dialog')).confirm(message, { title: 'Sims4 Roots', kind: 'warning' });
  return window.confirm(message);
}
export async function imageData(file: File, maxSize = 400): Promise<string> {
  if (!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)) throw new Error('PNG / JPEG / WebP / GIF を選んでください。');
  if (file.size > 25 * 1024 * 1024) throw new Error('画像は25MB以下にしてください。');
  const url = URL.createObjectURL(file);
  try {
    const img = new Image(); img.src = url; await img.decode();
    const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(img.width * scale)); canvas.height = Math.max(1, Math.round(img.height * scale));
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  } finally { URL.revokeObjectURL(url); }
}
