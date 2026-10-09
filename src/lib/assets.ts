const statusFiles = import.meta.glob('../../assets/status_icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const occultFiles = import.meta.glob('../../assets/occult_icons/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const statusNames: Record<string, string> = {
  married: 'married', love_marriage: 'love marriage', marriage_of_convenience: 'marriage of convenience',
  engaged: 'engaged', dating: 'dating', brokenup: 'ex',
  divorced: 'divorce', widowed: 'widower', bestfriend: 'besties',
  summser_fling: 'summer fling', friendzone_right: 'friendzone right', friendzone_left: 'friendzone left',
  flirting: 'flirting', family: 'family'
};
const occultNames: Record<string, string> = {
  fairy: 'faily', faily: 'faily', warewolf: 'werewolf', werewolve: 'werewolf',
  spellcaster: 'witch', witch: 'witch', plant_sim: 'plantsim'
};
export const statusIcon = (name: string) => statusFiles[`../../assets/status_icons/${statusNames[name] ?? name}.png`];
export const occultIcon = (name: string) => occultFiles[`../../assets/occult_icons/${occultNames[name] ?? name}.png`];
