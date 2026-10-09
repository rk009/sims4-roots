import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, copyFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const output = resolve('test-results/native');
await mkdir(output,{recursive:true});
const exe=resolve(output,'sims4-roots.exe');
await copyFile(resolve('src-tauri/target/release/sims4-roots.exe'),exe);
const child=spawn(exe,[],{windowsHide:true,cwd:output,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
async function chooseFile(path){
  await new Promise((done,reject)=>{
    const picker=spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/choose-native-file.ps1'),'-AppProcessId',String(child.pid),'-FilePath',path],{windowsHide:true,stdio:'pipe'});
    let output='';picker.stdout.on('data',d=>output+=d);picker.stderr.on('data',d=>output+=d);
    picker.on('error',reject);picker.on('exit',code=>code===0?done():reject(new Error(output)));
  });
}
let browser, page;
try {
  const until=Date.now()+30000;
  while(Date.now()<until){
    try {browser=await chromium.connectOverCDP('http://127.0.0.1:9223');break;}catch{await new Promise(r=>setTimeout(r,500));}
  }
  if(!browser)throw new Error('Native WebView2 debugging endpoint did not start');
  const pages=browser.contexts().flatMap(c=>c.pages());
  page=pages.find(p=>p.url().includes('tauri'))??pages[0];
  if(!page)throw new Error('Native app page not found');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('heading',{name:'ジョースター家',exact:true}).waitFor();
  await page.locator('.busy-overlay').waitFor({state:'hidden'});
  assert(await page.evaluate(()=>!!window.__TAURI_INTERNALS__));
  await page.screenshot({path:resolve(output,'native-window.png')});
  await page.getByRole('button',{name:'表示設定',exact:true}).click();
  await page.getByRole('button',{name:'サンセット',exact:true}).click();
  await page.getByRole('button',{name:'パネルを閉じる',exact:true}).click();
  await page.getByRole('button',{name:'全体を表示',exact:true}).click();
  await page.screenshot({path:resolve(output,'native-tree.png')});
  await page.getByRole('button',{name:'JSONを保存',exact:true}).click();
  console.log('JSON save requested; application errors:',await page.locator('.error-banner').allTextContents());
  const jsonPath=resolve(output,'families.json');
  await chooseFile(jsonPath);
  await page.locator('.busy-overlay').waitFor({state:'hidden'});
  const saved=JSON.parse(await readFile(jsonPath,'utf8'));
  assert.equal(saved[0].theme,'sunset');
  const people=JSON.parse(await readFile(resolve(output,'characters.json'),'utf8'));assert(people.some(c=>c.characterName==='Jonathan Joestar'));
  await page.getByRole('button',{name:'画像を書き出す',exact:true}).click();
  const pngPath=resolve(output,`exported-${Date.now()}.png`);
  await chooseFile(pngPath);
  await page.locator('.busy-overlay').waitFor({state:'hidden'});
  const png=await readFile(pngPath);assert.equal(png.subarray(1,4).toString(),'PNG');
  await page.getByRole('button',{name:'JSONを開く',exact:true}).click();
  await chooseFile(jsonPath);
  await page.locator('.busy-overlay').waitFor({state:'hidden'});
  assert.equal(await page.locator('.error-banner').count(),0);
  assert.deepEqual(errors,[]);
  console.log('Native WebView2 startup, appearance editing, actual JSON save/open and PNG export passed.');
  await page.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:'main'})).catch(()=>{});
} finally {
  if(page)await page.screenshot({path:resolve(output,'native-final.png')}).catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  if(child.exitCode===null)child.kill();
}
