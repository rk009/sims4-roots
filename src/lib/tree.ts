import { isUnknownParent, resolve, type Status, type Character, type Family, type Partner } from './model';
export interface TreeNode { key: string; character: Character; partners: Partner[]; external: boolean; former: boolean; missing: boolean; x: number; y: number; width: number; height: number; topInset: number; left: number; level: number }
export interface TreeLine { d: string; renderD?: string; sibling?: boolean; twin?: boolean; adoptive?: boolean; partnerLink?: boolean }
export function partnerStackLayout(count: number) {
  const height = Math.max(100, count * 50 + Math.max(0, count - 1) * 8);
  return { height, top: (100 - height) / 2 };
}
export function layoutTree(families: Family[], family: Family) {
  const nodes: TreeNode[] = [];
  const byName = new Map<string, TreeNode>();
  const warnings: string[] = [];
  const children = [...family.members,...(family.formerMembers ?? [])];
  const sharesChild = (a:string,b:string) => children.some(child=>{
    const parents=[child.father,child.mother,child.adoptiveFather,child.adoptiveMother];
    return parents.includes(a) && parents.includes(b);
  });
  const compactNames = new Set<string>();
  for(const member of [...family.members,...(family.formerMembers ?? [])]){
    if((member.partners?.length ?? 0)<3)continue;
    for(const partner of member.partners ?? []){
      const person=[...family.members,...(family.formerMembers ?? [])].find(c=>c.characterName===partner.characterName);
      if(!person || sharesChild(member.characterName,person.characterName))continue;
      const hasParents=[person.father,person.mother,person.adoptiveFather,person.adoptiveMother].some(name=>name&&!isUnknownParent(name));
      const hasChildren=children.some(child=>[child.father,child.mother,child.adoptiveFather,child.adoptiveMother].includes(person.characterName));
      if(!hasParents && !hasChildren)compactNames.add(person.characterName);
    }
  }
  function add(c: Character, external: boolean, missing = false, former = false) {
    const left=0;
    const node: TreeNode = { key: `${nodes.length}:${c.characterName}`, character: c, partners: [], external, former, missing, x: 0, y: 0, left, width: 116, height: 160, topInset: 0, level: 0 };
    nodes.push(node);
    if (!byName.has(c.characterName)) byName.set(c.characterName, node);
    return node;
  }
  for (const c of family.members) if(!compactNames.has(c.characterName)) add(c, false);
  for (const c of family.formerMembers ?? []) if (!compactNames.has(c.characterName) && !byName.has(c.characterName)) add(c, false, false, true);
  // Include ancestors even when stored in a different family. Unknown non-empty parents
  // remain visible placeholders; an empty parent never becomes a node or an edge.
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].external) continue;
    const c = nodes[i].character;
    const refs = [c.father, c.mother, c.adoptiveFather, c.adoptiveMother];
    for (const name of refs) if (name && !isUnknownParent(name) && !byName.has(name)) {
      const found = resolve(families, family, name);
      add(found ?? { characterName: name }, true, !found);
    }
  }
  // A co-parent can belong to another family. Give that partner a portrait
  // only when their child is a visible member or former member of this family.
  for(const c of [...family.members,...(family.formerMembers ?? [])]){
    if((c.partners?.length ?? 0)<3)continue;
    for(const partner of c.partners ?? [])if(sharesChild(c.characterName,partner.characterName)&&!byName.has(partner.characterName)){
      const found=resolve(families,family,partner.characterName);
      add(found ?? {characterName:partner.characterName},true,!found);
    }
  }
  const couples: {a:TreeNode;b:TreeNode;status:Status;gapPartner?:TreeNode;gapWith?:TreeNode;linkTo?:TreeNode;linkOrder?:number}[]=[];
  for(const c of [...family.members, ...(family.formerMembers ?? [])])for(const p of c.partners ?? []){
    const a=byName.get(c.characterName), b=byName.get(p.characterName);
    const needsVisibleChild=(a?.character.partners?.length ?? 0)>=3 || (b?.character.partners?.length ?? 0)>=3;
    if(a && b && a!==b && (!needsVisibleChild || sharesChild(c.characterName,p.characterName)) && !couples.some(pair=>(pair.a===b && pair.b===a)||(pair.a===a && pair.b===b)))couples.push({a,b,status:p.status});
  }
  for (const node of nodes) {
    node.partners = node.external ? [] : node.character.partners?.filter(p => !byName.has(p.characterName) || ((node.character.partners?.length ?? 0)>=3 && !sharesChild(node.character.characterName,p.characterName))) ?? [];
    const stack = partnerStackLayout(node.partners.length);
    node.width = node.left + 116 + (node.partners.length ? 80 : 0);
    node.height = Math.max(160, stack.top + stack.height);
    node.topInset = Math.max(0, -stack.top);
  }
  const edges: [TreeNode, TreeNode, boolean][] = [];
  function reaches(from: TreeNode, to: TreeNode, seen = new Set<string>()): boolean {
    if (from === to) return true;
    if (seen.has(from.key)) return false;
    seen.add(from.key);
    return edges.filter(([p]) => p === from).some(([, c]) => reaches(c, to, seen));
  }
  for (const child of nodes) {
    if (child.external) continue;
    for (const [adoptive, names] of [
      [false, [child.character.father, child.character.mother]],
      [true, [child.character.adoptiveFather, child.character.adoptiveMother]]
    ] as const) for (const name of new Set(names)) if (name && !isUnknownParent(name)) {
      const parent = byName.get(name)!;
      if (reaches(child, parent)) { warnings.push('親子関係に循環があるため、一部の線を省略しています。'); continue; }
      edges.push([parent, child, adoptive]);
    }
  }
  const groups = new Map(nodes.map(n => [n.key, n.key]));
  const group = (key: string): string => groups.get(key) === key ? key : group(groups.get(key)!);
  function mergePeers(a: TreeNode, b: TreeNode) {
    const ga = group(a.key), gb = group(b.key);
    if (ga === gb) return true;
    const as = nodes.filter(v => group(v.key) === ga), bs = nodes.filter(v => group(v.key) === gb);
    if (as.some(a => bs.some(b => reaches(a,b) || reaches(b,a)))) return false;
    groups.set(gb,ga);return true;
  }
  // Co-parents occupy the same generation unless the input makes them ancestors
  // of one another. This avoids long parent lines cutting through another row.
  for (const c of nodes) {
    for (const adoptive of [false, true]) {
      const parents = edges.filter(([,child,a])=>child===c && a===adoptive).map(([parent])=>parent);
      if (parents.length === 2) mergePeers(parents[0],parents[1]);
    }
  }
  for(const {a,b} of couples)mergePeers(a,b);
  const siblings: [TreeNode, TreeNode][] = [];
  const siblingGroups = new Map<string, TreeNode[]>();
  for(const n of nodes.filter(n=>!n.external))for(const name of new Set([n.character.father,n.character.mother])){
    if(!isUnknownParent(name))continue;
    const members=siblingGroups.get(name!) ?? [];
    members.push(n);siblingGroups.set(name!,members);
  }
  for(const members of siblingGroups.values())for(let i=1;i<members.length;i++){
    const a=members[i-1],b=members[i];
    if(!reaches(a,b) && !reaches(b,a) && mergePeers(a,b))siblings.push([a,b]);
  }
  // Topological ranks on the collapsed sibling graph, with a bounded fallback.
  const ranks = new Map(nodes.map(n => [group(n.key), 0]));
  for (let i = 0; i < ranks.size; i++) {
    let changed = false;
    for (const [p, c] of edges) {
      const gp = group(p.key), gc = group(c.key);
      if (gp !== gc && ranks.get(gc)! <= ranks.get(gp)!) { ranks.set(gc, ranks.get(gp)! + 1); changed = true; }
    }
    if (!changed) break;
    if (i === ranks.size - 1) { warnings.push('兄弟・親子の関係に矛盾があります。世代の配置を確認してください。'); }
  }
  for (const n of nodes) n.level = Math.min(ranks.get(group(n.key))!, nodes.length);
  const levels = [...new Set(nodes.map(n => n.level))].sort((a,b) => a-b);
  let y = 78;
  const rowPositions = new Map<TreeNode, number>();
  const rows = levels.map(level => {
    const row = nodes.filter(n => n.level === level);
    const familyKey = (n: TreeNode) => (n.character.father || n.character.mother || n.character.adoptiveFather || n.character.adoptiveMother) ? [n.character.father || n.character.adoptiveFather || '', n.character.mother || n.character.adoptiveMother || ''].sort().join('|') : group(n.key);
    const parentPosition = (n: TreeNode) => {
      const parents = edges.filter(([,child,adoptive]) => child===n && !adoptive).map(([parent])=>rowPositions.get(parent)).filter((position):position is number=>position!==undefined);
      return parents.length ? parents.reduce((sum,position)=>sum+position,0)/parents.length : undefined;
    };
    row.sort((a,b) => {
      const aParent=parentPosition(a), bParent=parentPosition(b);
      if(aParent!==undefined && bParent!==undefined && aParent!==bParent)return aParent-bParent;
      return familyKey(a).localeCompare(familyKey(b)) || (a.character.brotherNumber ?? 999) - (b.character.brotherNumber ?? 999) || nodes.indexOf(a)-nodes.indexOf(b);
    });
    const claimedPartners=new Set<TreeNode>();
    for(const person of [...family.members,...(family.formerMembers ?? [])]){
      const main=byName.get(person.characterName);
      if(!main || main.level!==level || claimedPartners.has(main))continue;
      const manyPartners=(main.character.partners?.length ?? 0)>=3;
      const pairs=(main.character.partners ?? [])
        .filter(partner=>!manyPartners || sharesChild(main.character.characterName,partner.characterName))
        .map(partner=>couples.find(({a,b})=>(a===main&&b.character.characterName===partner.characterName)||(b===main&&a.character.characterName===partner.characterName)))
        .filter((pair):pair is typeof couples[number]=>!!pair);
      const partners=pairs.map(pair=>pair.a===main?pair.b:pair.a).filter(partner=>row.includes(partner)&&!claimedPartners.has(partner));
      if(!partners.length)continue;
      const first=partners[0];
      row.splice(row.indexOf(first),1);row.splice(row.indexOf(main)+1,0,first);
      claimedPartners.add(first);
      if(manyPartners){
        let leftNeighbor=main;
        for(const partner of partners.slice(1)){
          row.splice(row.indexOf(partner),1);row.splice(row.indexOf(leftNeighbor),0,partner);
          claimedPartners.add(partner);
          leftNeighbor=partner;
        }
        for(const [index,partner] of partners.entries()){
          const pair=pairs.find(({a,b})=>(a===main&&b===partner)||(b===main&&a===partner));
          if(pair){
            pair.gapPartner=partner;
            pair.gapWith=index<2?main:partners[index-1];
            const configuredIndex=main.character.partners?.findIndex(p=>p.characterName===partner.character.characterName) ?? -1;
            if(configuredIndex>=2){pair.linkTo=main;pair.linkOrder=configuredIndex-2;}
          }
        }
        continue;
      }
      for(const partner of partners.slice(1)){
        if(!edges.some(([parent,child])=>parent===partner && edges.some(([other,otherChild])=>other===main&&otherChild===child)))continue;
        row.splice(row.indexOf(partner),1);row.splice(row.indexOf(main),0,partner);
        claimedPartners.add(partner);
      }
    }
    row.forEach((n,index)=>rowPositions.set(n,index));
    const gapAfter = (n:TreeNode,next:TreeNode) => n.partners.length && couples.some(({a,b})=>a===n&&b===next) ? 72 : 48;
    const width = row.reduce((s,n,index)=>s+n.width+(index<row.length-1?gapAfter(n,row[index+1]):0),0);
    const rowY = y + Math.max(...row.map(n => n.topInset));
    y = rowY + Math.max(...row.map(n => n.height)) + 44;
    return { row, width, y: rowY, gapAfter };
  });
  const width = Math.max(900, ...rows.map(r => r.width + 120)) + ((family.pets?.length || family.servants?.length) ? 180 : 90);
  for (const r of rows) {
    let x = (width - r.width) / 2;
    for (const [index,n] of r.row.entries()) { n.x = x; n.y = r.y; x += n.width + (index<r.row.length-1?r.gapAfter(n,r.row[index+1]):0); }
  }
  const center = (n: TreeNode) => n.x + n.left + 50;
  // Relationship icons use the same 100px character slot for every node.
  // A small external portrait sits inside that slot without moving the icon.
  const slotLeft = (n: TreeNode) => n.x+n.left;
  const slotRight = (n: TreeNode) => n.partners.length ? slotLeft(n)+110+78 : slotLeft(n)+100;
  const bondX = (a: TreeNode, b: TreeNode) => {
    const [left,right] = a.x<b.x ? [a,b] : [b,a];
    return (slotRight(left)+slotLeft(right))/2;
  };
  const isTwin = (a: TreeNode, b: TreeNode) => a.character.twins?.includes(b.character.characterName) || b.character.twins?.includes(a.character.characterName);
  const pairId = (a: TreeNode, b: TreeNode) => [a.key,b.key].sort().join('|');
  const seenTwins = new Set<string>();
  const bonds: {a:TreeNode;b:TreeNode;status:Status;x:number;y:number;linkTo?:TreeNode;linkOrder?:number}[] = couples.filter(({a,b})=>a.level===b.level).map(({a,b,status,gapPartner,gapWith,linkTo,linkOrder})=>({
    a,b,status,linkTo,linkOrder,
    x:gapPartner&&gapWith ? bondX(gapPartner,gapWith) : bondX(a,b),
    y:a.y+50
  }));
  const lines: TreeLine[] = [];
  for(const bond of bonds){
    if(!bond.linkTo)continue;
    const target=bond.linkTo;
    const railY=target.y-14-Math.min(2,bond.linkOrder ?? 0)*4;
    const endX=target.x+target.left+12+8*(bond.linkOrder ?? 0);
    const endY=target.y-3;
    lines.push({partnerLink:true,d:`M ${bond.x} ${bond.y-21} V ${railY+5} Q ${bond.x} ${railY} ${bond.x+5} ${railY} H ${endX-5} Q ${endX} ${railY} ${endX} ${railY+5} V ${endY}`});
  }
  const familiesOfChildren = new Map<string, { parents: TreeNode[]; children: TreeNode[]; adoptive: boolean }>();
  for (const child of nodes) {
    for (const adoptive of [true, false]) {
      const parents = edges.filter(([,c,a]) => c === child && a === adoptive).map(([p]) => p);
      if (!parents.length) continue;
      const key = parents.map(p=>p.key).sort().join('|') + ':' + child.level + ':' + adoptive;
      const entry = familiesOfChildren.get(key) ?? { parents, children: [], adoptive };
      entry.children.push(child); familiesOfChildren.set(key, entry);
    }
  }
  for (const { parents, children, adoptive } of familiesOfChildren.values()) {
    let anchor: {x:number;y:number}|undefined;
    if(parents.length===2){
      let bond=bonds.find(p=>parents.includes(p.a)&&parents.includes(p.b));
      if(!bond){const [a,b]=parents;bond={a,b,status:a.character.partners?.find(p=>p.characterName===b.character.characterName)?.status ?? 'married',x:bondX(a,b),y:a.y+50};bonds.push(bond);}
      anchor={x:bond.x,y:bond.y+21};
    }
    const parentStartY = anchor?.y ?? parents[0].y + 145;
    const childEndY = Math.min(...children.map(c => c.y - 8));
    const junctionY = (parentStartY + childEndY) / 2;
    const xs = [...(anchor?[anchor.x]:parents.map(center)), ...children.map(center)];
    lines.push({ d: `M ${Math.min(...xs)} ${junctionY} H ${Math.max(...xs)}`, adoptive });
    for (let i=0; i<children.length; i++) for (let j=i+1; j<children.length; j++) {
      const a=children[i], b=children[j];
      if (!isTwin(a,b)) continue;
      seenTwins.add(pairId(a,b));
      lines.push({ d: `M ${Math.min(center(a),center(b))} ${junctionY+6} H ${Math.max(center(a),center(b))}`, twin: true, adoptive });
    }
    if(anchor)lines.push({d: `M ${anchor.x} ${anchor.y} V ${junctionY}`, adoptive});
    for (const p of anchor?[]:parents) lines.push({ d: `M ${center(p)} ${p.y + 145} V ${junctionY}`, adoptive });
    for (const c of children) lines.push({ d: `M ${center(c)} ${junctionY} V ${c.y - 8}`, adoptive });
  }
  const seenSibling = new Set<string>();
  for (const [a,b] of siblings) {
    const id = pairId(a,b);
    if (seenSibling.has(id) || a.level !== b.level) continue;
    if (isTwin(a,b)) continue;
    seenSibling.add(id);
    lines.push({ d: `M ${center(a)} ${a.y - 8} V ${a.y - 25} H ${center(b)} V ${b.y - 8}`, sibling: true });
  }
  for (const a of nodes) for (const name of a.character.twins ?? []) {
    const b = byName.get(name);
    if (!b || a === b || a.level !== b.level || reaches(a,b) || reaches(b,a)) continue;
    const id = pairId(a,b);
    if (seenTwins.has(id)) continue;
    seenTwins.add(id);
    for (const offset of [25,31]) lines.push({ d: `M ${center(a)} ${a.y - 8} V ${a.y - offset} H ${center(b)} V ${b.y - 8}`, sibling: true, twin: true });
  }
  lines.sort((a,b) => Number(b.adoptive) - Number(a.adoptive));
  const siblingSpans = lines.filter(line=>line.sibling).flatMap(line=>{
    const match=line.d.match(/H\s*([\d.]+)/);
    const start=line.d.match(/M\s*([\d.]+)\s*([\d.]+)\s*V\s*([\d.]+)/);
    return match && start ? [{left:Math.min(+start[1],+match[1]),right:Math.max(+start[1],+match[1]),y:+start[3],halfGap:5}] : [];
  });
  for (const line of lines) {
    if (line.sibling) continue;
    const vertical=line.d.match(/^M\s*([\d.]+)\s*([\d.]+)\s*V\s*([\d.]+)$/);
    if (!vertical) continue;
    const x=+vertical[1], top=Math.min(+vertical[2],+vertical[3]), bottom=Math.max(+vertical[2],+vertical[3]);
    const gaps=siblingSpans
      .filter(span=>x>span.left+4 && x<span.right-4 && span.y>top+span.halfGap && span.y<bottom-span.halfGap)
      .map(span=>({start:span.y-span.halfGap,end:span.y+span.halfGap}))
      .sort((a,b)=>a.start-b.start);
    if (!gaps.length) continue;
    const visible:string[]=[];
    let start=top;
    for (const gap of gaps) {
      if (gap.start>start) visible.push(`M ${x} ${start} V ${gap.start}`);
      start=Math.max(start,gap.end);
    }
    if (start<bottom) visible.push(`M ${x} ${start} V ${bottom}`);
    line.renderD=visible.join(' ');
  }
  return { nodes, lines, bonds, width, height: Math.max(280, y - 20, 120+((family.pets?.length ?? 0)+(family.servants?.length ?? 0))*160), generations: levels.length, warnings: [...new Set(warnings)] };
}
