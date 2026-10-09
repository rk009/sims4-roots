import { describe, it, expect } from 'vitest';
import { layoutTree } from './tree';
import { diagnostics, parseFamilies, replaceCharacter, type Family, type Character } from './model';
const family = (members: Character[]): Family => ({ familyName:'Test', world:'', members });
describe('family tree relationships',()=>{
  it('places partners with visible children and stacks those whose children are outside the family',()=>{
    const f=family([
      {characterName:'Joseph',partners:[{characterName:'Tomoko',status:'dating'},{characterName:'Suzi',status:'divorced'},{characterName:'Caesar',status:'married'},{characterName:'No child',status:'dating'}]},
      {characterName:'Caesar'},
      {characterName:'Josuke',father:'Joseph',mother:'Tomoko',adoptiveFather:'Joseph',adoptiveMother:'Caesar'}
    ]);
    const other=family([
      {characterName:'Suzi'},
      {characterName:'Holy',father:'Joseph',mother:'Suzi'},
      {characterName:'No child'}
    ]);
    const tree=layoutTree([f,other],f);
    const node=(name:string)=>tree.nodes.find(n=>n.character.characterName===name)!;
    const bond=(name:string)=>tree.bonds.find(b=>[b.a,b.b].some(n=>n.character.characterName===name))!;
    expect(node('Caesar').x).toBeLessThan(node('Joseph').x);
    expect(node('Suzi')).toBeUndefined();
    expect(node('Tomoko').x).toBeGreaterThan(node('Joseph').x);
    expect(node('No child')).toBeUndefined();
    expect(node('Joseph').partners.map(p=>p.characterName)).toEqual(['Suzi','No child']);
    expect(bond('Suzi')).toBeUndefined();
    expect(bond('Caesar').x).toBeGreaterThan(node('Caesar').x+100);
    expect(bond('Caesar').x).toBeLessThan(node('Joseph').x);
    const caesarLink=tree.lines.find(line=>line.partnerLink)!;
    expect(caesarLink.d).toMatch(new RegExp(`^M ${bond('Caesar').x} ${bond('Caesar').y-21} V `));
    expect(caesarLink.d).toContain(`V ${node('Joseph').y-3}`);
    expect(caesarLink.d).toContain(`H ${node('Joseph').x+node('Joseph').left+7}`);
    expect(tree.lines.filter(line=>line.partnerLink)).toHaveLength(1);
    expect(bond('Tomoko').x).toBeGreaterThan(node('Joseph').x+100);
    expect(bond('Tomoko').x).toBeLessThan(node('Tomoko').x);
    expect(tree.lines.some(line=>line.d.startsWith(`M ${bond('Tomoko').x} ${bond('Tomoko').y+21} V `))).toBe(true);
  });
  it('keeps a co-parent beside the member when their child has left the family',()=>{
    const f={...family([
      {characterName:'Joseph',partners:[{characterName:'Tomoko',status:'dating'},{characterName:'Suzi',status:'divorced'},{characterName:'No child',status:'dating'}]},
      {characterName:'Josuke',father:'Joseph',mother:'Tomoko'}
    ]),formerMembers:[{characterName:'Holy',father:'Joseph',mother:'Suzi'}]};
    const other=family([{characterName:'Suzi'}]);
    const tree=layoutTree([f,other],f);
    const node=(name:string)=>tree.nodes.find(n=>n.character.characterName===name)!;
    expect(node('Suzi').x).toBeLessThan(node('Joseph').x);
    expect(node('Holy').former).toBe(true);
    expect(node('Joseph').partners.map(p=>p.characterName)).toEqual(['No child']);
  });
  it('places a later partner with children to the left and keeps that child nearby',()=>{
    const f=family([
      {characterName:'Jonathan',partners:[{characterName:'First',status:'married'},{characterName:'Erina',status:'married'}]},
      {characterName:'First'}, {characterName:'Erina'},
      {characterName:'First child',father:'Jonathan',mother:'First'},
      {characterName:'George',father:'Jonathan',mother:'Erina'}
    ]);
    const tree=layoutTree([f],f);
    const node=(name:string)=>tree.nodes.find(n=>n.character.characterName===name)!;
    expect(node('Erina').x+node('Erina').width).toBeLessThan(node('Jonathan').x);
    expect(node('Jonathan').x+node('Jonathan').width).toBeLessThan(node('First').x);
    expect(node('George').x).toBeLessThan(node('First child').x);
    const bond=tree.bonds.find(b=>[b.a,b.b].some(n=>n.character.characterName==='Erina'))!;
    expect(bond.x).toBeGreaterThan(node('Erina').x+node('Erina').width);
    expect(bond.x).toBeLessThan(node('Jonathan').x);
  });
  it('keeps the first partner on the right when the later co-parent belongs to another family',()=>{
    const f=family([
      {characterName:'Jonathan',partners:[{characterName:'Dio',status:'married'},{characterName:'Erina',status:'brokenup'}]},
      {characterName:'Dio',partners:[{characterName:'Jonathan',status:'married'}]},
      {characterName:'Dio child',father:'Jonathan',mother:'Dio'},
      {characterName:'George',father:'Jonathan',mother:'Erina'}
    ]);
    const other=family([{characterName:'Erina',partners:[{characterName:'Jonathan',status:'brokenup'}]}]);
    const tree=layoutTree([f,other],f);
    const node=(name:string)=>tree.nodes.find(n=>n.character.characterName===name)!;
    expect(node('Erina').x).toBeLessThan(node('Jonathan').x);
    expect(node('Jonathan').x).toBeLessThan(node('Dio').x);
    expect(node('George').x).toBeLessThan(node('Dio child').x);
    const bond=tree.bonds.find(b=>[b.a,b.b].some(n=>n.character.characterName==='Erina'))!;
    const jonathanPortraitLeft=node('Jonathan').x+node('Jonathan').left;
    expect(jonathanPortraitLeft-bond.x).toBe(32);
    expect(bond.status).toBe('brokenup');
  });
  it('keeps the child line icon at a fixed distance from a member mother with an external father',()=>{
    const f=family([{characterName:'Mother'},{characterName:'Child',father:'Father',mother:'Mother'}]);
    const other=family([{characterName:'Father'}]);
    const tree=layoutTree([f,other],f);
    const mother=tree.nodes.find(n=>n.character.characterName==='Mother')!;
    const father=tree.nodes.find(n=>n.character.characterName==='Father')!;
    const bond=tree.bonds.find(b=>[b.a,b.b].includes(mother))!;
    const expected=mother.x+mother.left+(father.x<mother.x?-32:132);
    expect(bond.x).toBe(expected);
    const memberGap=father.x<mother.x ? mother.x-bond.x-21 : bond.x-21-(mother.x+100);
    const externalGap=father.x<mother.x ? bond.x-21-(father.x+70) : father.x+30-(bond.x+21);
    expect(externalGap).toBeGreaterThan(memberGap);
  });
  it('keeps the relationship icon clear of smaller partners on the right',()=>{
    const f=family([
      {characterName:'Joseph',partners:[{characterName:'Caesar',status:'married'},{characterName:'Tomoko',status:'dating'},{characterName:'Suzi',status:'divorced'}]},
      {characterName:'Caesar'}, {characterName:'Child',father:'Joseph',mother:'Tomoko',adoptiveFather:'Joseph',adoptiveMother:'Caesar'}
    ]);
    const tree=layoutTree([f,family([{characterName:'Tomoko'}])],f);
    const joseph=tree.nodes.find(n=>n.character.characterName==='Joseph')!;
    const caesar=tree.nodes.find(n=>n.character.characterName==='Caesar')!;
    const bond=tree.bonds.find(b=>b.b.character.characterName==='Caesar')!;
    expect(joseph.partners.map(p=>p.characterName)).toEqual(['Suzi']);
    expect(bond.x-21).toBeGreaterThanOrEqual(joseph.x+joseph.left+110+78);
    expect(caesar.x-(joseph.x+joseph.width)).toBe(72);
    expect(bond.x).toBe((joseph.x+joseph.left+110+78+caesar.x+caesar.left)/2);
    expect(bond.x-21-(joseph.x+joseph.left+110+78)).toBe(19);
  });
  it('draws adoptive connections below biological connections',()=>{
    const f=family([{characterName:'Father'},{characterName:'Adoptive father'},{characterName:'Child',father:'Father',adoptiveFather:'Adoptive father'}]);
    const tree=layoutTree([f],f);
    expect(tree.nodes).toHaveLength(3);
    expect(tree.lines.some(line=>line.adoptive)).toBe(true);
    expect(tree.lines.some(line=>!line.adoptive)).toBe(true);
    expect(tree.lines.map(line=>Boolean(line.adoptive)).lastIndexOf(true)).toBeLessThan(tree.lines.findIndex(line=>!line.adoptive));
  });
  it('routes shared father through both birth and adoptive parent pairs',()=>{
    const f=family([
      {characterName:'Father',partners:[{characterName:'Birth mother',status:'dating'},{characterName:'Adoptive mother',status:'married'}]},
      {characterName:'Birth mother'}, {characterName:'Adoptive mother'},
      {characterName:'Child',father:'Father',mother:'Birth mother',adoptiveFather:'Father',adoptiveMother:'Adoptive mother'}
    ]);
    const tree=layoutTree([f],f);
    const bond=(name:string)=>tree.bonds.find(b=>[b.a.character.characterName,b.b.character.characterName].includes(name))!;
    const birth=bond('Birth mother'), adoptive=bond('Adoptive mother');
    expect(tree.lines.some(line=>!line.adoptive && line.d===`M ${birth.x} ${birth.y+21} V ${(birth.y+21+tree.nodes.find(n=>n.character.characterName==='Child')!.y-8)/2}`)).toBe(true);
    expect(tree.lines.some(line=>line.adoptive && line.d.startsWith(`M ${adoptive.x} ${adoptive.y+21} V `))).toBe(true);
    expect(tree.lines.filter(line=>line.d.endsWith(`V ${tree.nodes.find(n=>n.character.characterName==='Child')!.y-8}`))).toHaveLength(2);
  });
  it('keeps adoptive co-parents together and joins their lines before the child',()=>{
    const f=family([{characterName:'Grandparent'},{characterName:'Adoptive father',father:'Grandparent'},{characterName:'Adoptive mother'},{characterName:'Father'},{characterName:'Mother'},{characterName:'Child',father:'Father',mother:'Mother',adoptiveFather:'Adoptive father',adoptiveMother:'Adoptive mother'}]);
    const tree=layoutTree([f],f);
    const node=(name:string)=>tree.nodes.find(n=>n.character.characterName===name)!;
    expect(node('Adoptive father').level).toBe(node('Adoptive mother').level);
    expect(node('Child').level).toBeGreaterThan(node('Adoptive father').level);
    expect(tree.lines.filter(line=>line.adoptive && line.d.endsWith(`V ${node('Child').y - 8}`))).toHaveLength(1);
  });
  it('connects a single known parent without inventing an empty parent',()=>{
    const f=family([{characterName:'A'},{characterName:'B',father:'A',mother:''}]);const t=layoutTree([f],f);
    expect(t.nodes).toHaveLength(2);expect(t.nodes.find(n=>n.character.characterName==='B')!.level).toBe(1);expect(t.lines).toHaveLength(3);
  });
  it('centers the widest row within the final canvas width',()=>{
    for(const pets of [[],['Dog']]){
      const f={...family([{characterName:'A'},{characterName:'B'},{characterName:'C'}]),pets};
      const tree=layoutTree([f],f);
      const left=Math.min(...tree.nodes.map(node=>node.x));
      const right=Math.max(...tree.nodes.map(node=>node.x+node.width));
      expect(left).toBeCloseTo(tree.width-right);
    }
  });
  it('groups siblings by a shared unknown-parent identifier without drawing a parent',()=>{
    const f=family([{characterName:'B',father:'noparents_group1',brotherNumber:2},{characterName:'A',father:'noparents_group1',brotherNumber:1}]);const t=layoutTree([f],f);
    expect(t.nodes).toHaveLength(2);expect(t.nodes[0].y).toBe(t.nodes[1].y);expect(t.nodes[1].x).toBeLessThan(t.nodes[0].x);expect(t.lines.some(l=>l.sibling)).toBe(true);
  });
  it('does not add siblings who are outside the selected family',()=>{
    const f=family([{characterName:'A',mother:'noparents_group1'}]);
    const other=family([{characterName:'B',mother:'noparents_group1'}]);
    const t=layoutTree([f,other],f);
    expect(t.nodes.map(n=>n.character.characterName)).toEqual(['A']);
    expect(t.lines.some(l=>l.sibling)).toBe(false);
  });
  it('keeps a known parent line while grouping siblings by an unknown parent identifier',()=>{
    const f=family([{characterName:'Mother'},{characterName:'A',father:'noparents_shared',mother:'Mother'},{characterName:'B',father:'noparents_shared',mother:'Mother'}]);
    const tree=layoutTree([f],f);
    expect(tree.nodes).toHaveLength(3);
    expect(tree.nodes.find(n=>n.character.characterName==='A')!.level).toBe(1);
    expect(tree.lines.some(line=>line.sibling)).toBe(true);
    expect(diagnostics([f])).toEqual([]);
  });
  it('doubles only the sibling branch between twins with shared parents',()=>{
    const f=family([{characterName:'Parent'},{characterName:'A',father:'Parent',twins:['B']},{characterName:'B',father:'Parent',twins:['A']}]);
    const t=layoutTree([f],f);
    expect(t.lines.filter(l=>l.twin)).toHaveLength(1);
    expect(t.lines.find(l=>l.twin)?.d).toMatch(/^M .* H /);
    expect(t.lines.filter(l=>l.sibling)).toHaveLength(0);
  });
  it('links both parents and keeps wide relationship cards separated',()=>{
    const f=family([{characterName:'A',partners:Array.from({length:7},(_,i)=>({characterName:`p${i}`,status:'dating' as const}))},{characterName:'B'},{characterName:'C',father:'A',mother:'B'}]);const t=layoutTree([f],f);
    const row=t.nodes.filter(n=>n.level===0).sort((a,b)=>a.x-b.x);expect(row[0].x+row[0].width).toBeLessThan(row[1].x);expect(t.nodes.find(n=>n.character.characterName==='C')!.level).toBe(1);
  });
  it('handles cyclic ancestry with a warning and finite coordinates',()=>{
    const f=family([{characterName:'A',father:'B'},{characterName:'B',father:'A'}]);const t=layoutTree([f],f);expect(t.warnings.length).toBeGreaterThan(0);expect(t.nodes.every(n=>Number.isFinite(n.y))).toBe(true);
  });
  it('resolves ancestors from another family and creates unknown named placeholders',()=>{
    const f=family([{characterName:'C',father:'A',mother:'Unknown'}]);const t=layoutTree([f,family([{characterName:'A'}])],f);expect(t.nodes).toHaveLength(3);expect(t.nodes.find(n=>n.character.characterName==='Unknown')?.missing).toBe(true);
  });
  it('stops at the parents from another family',()=>{
    const f=family([{characterName:'Child',father:'Parent'}]);
    const other=family([{characterName:'Parent',father:'Grandfather',mother:'Grandmother'}]);
    const t=layoutTree([f,other],f);
    expect(t.nodes.map(n=>n.character.characterName)).toEqual(['Child','Parent']);
    expect(t.nodes.find(n=>n.character.characterName==='Parent')?.external).toBe(true);
    expect(t.lines).toHaveLength(3);
  });
  it('aligns co-parents and their unknown-parent siblings in the same generation',()=>{
    const f=family([{characterName:'Grandparent'},{characterName:'A',father:'Grandparent'},{characterName:'B',father:'noparents_group2'},{characterName:'Sibling',mother:'noparents_group2'},{characterName:'Child',father:'A',mother:'B'}]);
    const t=layoutTree([f],f), rank=(s:string)=>t.nodes.find(n=>n.character.characterName===s)!.level;
    expect(rank('A')).toBe(1);expect(rank('B')).toBe(1);expect(rank('Sibling')).toBe(1);expect(rank('Child')).toBe(2);
  });
});
describe('JSON and edits',()=>{
  it('rejects invalid relation statuses and malformed arrays',()=>{
    expect(()=>parseFamilies(JSON.stringify([family([{characterName:'A',partners:[{characterName:'B',status:'bad' as never}]}])]))).toThrow();
    expect(()=>parseFamilies('{"members":[]}')).toThrow();
  });
  it('preserves extension properties and updates references when renaming',()=>{
    const f=family([{characterName:'A',notes:'keep'},{characterName:'B',father:'A',partners:[{characterName:'A',status:'married'}]}]);const result=replaceCharacter([f],0,0,{...f.members[0],characterName:'Z'});
    expect(result[0].members[0].notes).toBe('keep');expect(result[0].members[1].father).toBe('Z');expect(result[0].members[1].partners![0].characterName).toBe('Z');expect(f.members[0].characterName).toBe('A');
  });
  it('does not rewrite another family when an existing name is ambiguous',()=>{
    const a=family([{characterName:'A'},{characterName:'C',father:'A'}]), b=family([{characterName:'A'},{characterName:'D',father:'A'}]);const r=replaceCharacter([a,b],0,0,{characterName:'Z'});expect(r[0].members[1].father).toBe('Z');expect(r[1].members[1].father).toBe('A');
  });
});
