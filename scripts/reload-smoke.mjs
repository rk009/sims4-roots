import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const output=resolve(`test-results/reload-${Date.now()}`);
await mkdir(output,{recursive:true});
const exe=resolve(output,'sims4-roots.exe'), source=resolve(output,'families.json');
await copyFile(resolve('src-tauri/target/release/sims4-roots.exe'),exe);
const fixture=name=>JSON.stringify([{familyName:name,world:'Test',members:[{characterName:'Test Sim'}]}]);
await writeFile(source,fixture('External startup'));
await writeFile(resolve(output,'characters.json'),JSON.stringify([{characterName:'Test Sim'}]));
let child,browser,page;
async function start(){
  child=spawn(exe,[],{windowsHide:true,cwd:output,env:{...process.env,WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS:'--remote-debugging-port=9223'}});
  browser=undefined;
  for(let i=0;i<60;i++){try{browser=await chromium.connectOverCDP('http://127.0.0.1:9223');break;}catch{await new Promise(r=>setTimeout(r,500));}}
  if(!browser)throw new Error('WebView2 startup failed');
  page=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('tauri'));
  await expect(page.locator('.busy-overlay')).toHaveCount(0);
}
async function stop(){
  await page?.evaluate(()=>window.__TAURI_INTERNALS__.invoke('plugin:window|destroy',{label:'main'})).catch(()=>{});
  await browser?.close().catch(()=>{});
  for(let i=0;i<20&&child?.exitCode===null;i++)await new Promise(r=>setTimeout(r,100));
  if(child?.exitCode===null)child.kill();
}
async function dialog(path){
  await new Promise((done,reject)=>{
    const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',resolve('scripts/choose-native-file.ps1'),'-AppProcessId',String(child.pid),...(path?['-FilePath',path]:['-ConfirmOnly'])];
    const p=spawn('powershell.exe',args,{windowsHide:true});let error='';p.stderr.on('data',d=>error+=d);p.on('error',reject);p.on('exit',code=>code===0?done():reject(new Error(error)));
  });
}
const heading=name=>expect(page.getByRole('heading',{name,exact:true})).toBeVisible();
try {
  await start();await heading('External startup');
  await writeFile(source,fixture('External refresh'));
  await page.getByRole('button',{name:'再読み込み',exact:true}).click();await heading('External refresh');
  await writeFile(source,fixture('Page restart'));
  await page.reload();await heading('Page restart');
  await page.getByRole('button',{name:'表示設定',exact:true}).click();
  await page.getByRole('button',{name:'サンセット',exact:true}).click();
  await expect(page.locator('.local-status')).toContainText('下書き保存済み');
  await writeFile(source,fixture('Protected external'));
  await page.reload();await heading('Page restart');
  await page.getByRole('button',{name:'再読み込み',exact:true}).click();await dialog();await heading('Protected external');
  const chosenDir=resolve(output,'chosen');await mkdir(chosenDir);await writeFile(resolve(chosenDir,'characters.json'),JSON.stringify([{characterName:'Test Sim'}]));
  const chosen=resolve(chosenDir,'families.json');await writeFile(chosen,fixture('Chosen file'));
  await page.getByRole('button',{name:'JSONを開く',exact:true}).click();await dialog(chosen);await heading('Chosen file');
  await expect(page.locator('.local-status')).toContainText('下書き保存済み');
  await stop();await writeFile(chosen,fixture('Restart latest file'));await start();await heading('Restart latest file');
  await expect(page.locator('.file-name')).toHaveAttribute('title',chosen);
  await writeFile(chosen,'{ invalid JSON');
  await page.getByRole('button',{name:'再読み込み',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();await heading('Restart latest file');
  await page.screenshot({path:resolve(output,'reload-verified.png')});
  console.log('Passed: disk startup, explicit reload, clean refresh, dirty draft protection, confirmed discard, remembered path across process restart, invalid JSON preservation.');
} finally {await stop();}
