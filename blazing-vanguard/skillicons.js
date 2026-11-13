'use strict';
/* skillicons.js — skill art: Fire Emblem tile icons cropped into sprites/skills/<hero>_<i>.png (8 actives) and <hero>_p_<i>.png (4 passives) */
const SKI = {
  skills(key) { return Array.from({ length: 8 }, (_, i) => `sprites/skills/${key}_${i}.png`); },
  passives(key) { return Array.from({ length: 4 }, (_, i) => `sprites/skills/${key}_p_${i}.png`); },
};
