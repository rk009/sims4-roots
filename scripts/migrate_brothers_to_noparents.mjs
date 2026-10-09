import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const path = fileURLToPath(new URL('../release/conf/characters.json', import.meta.url));
const text = readFileSync(path, 'utf8');
const characters = JSON.parse(text.replace(/("(?:[^"\\]|\\.)*")|,(\s*[}\]])/g, (_match, quoted, end) => quoted ?? end));
const byName = new Map(characters.map(character => [character.characterName, character]));
const parents = new Map(characters.map(character => [character.characterName, character.characterName]));
function root(name) {
  const parent = parents.get(name);
  if (parent === name) return name;
  const result = root(parent);
  parents.set(name, result);
  return result;
}
const linked = new Set();
for (const character of characters) for (const sibling of character.brothers ?? []) {
  if (!byName.has(sibling)) throw new Error(`Unknown sibling: ${sibling}`);
  linked.add(character.characterName);
  linked.add(sibling);
  parents.set(root(sibling), root(character.characterName));
}
const groups = new Map();
for (const character of characters) if (linked.has(character.characterName)) {
  const key = root(character.characterName);
  const group = groups.get(key) ?? [];
  group.push(character);
  groups.set(key, group);
}
let index = 0;
for (const group of groups.values()) {
  const identifier = `noparents_siblings_${++index}`;
  for (const character of group) {
    if (!character.father) character.father = identifier;
    else if (!character.mother) character.mother = identifier;
    else throw new Error(`No empty parent field: ${character.characterName}`);
  }
}
for (const character of characters) delete character.brothers;
writeFileSync(path, JSON.stringify(characters, null, 2) + '\n', 'utf8');
console.log(`Migrated ${[...groups.values()].reduce((count,group)=>count+group.length,0)} characters in ${groups.size} sibling groups.`);
