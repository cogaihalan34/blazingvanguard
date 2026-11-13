'use strict';
/* d2.js — Diablo II style item system: bases (normal/exceptional/elite), affixes, magic/rare/set/unique,
   inventory grid, equipment slots, attributes and derived combat stats.
   Numbers follow Diablo II closely but are approximations; every table here is plain data and easy to edit. */

const SLOTS = ['head', 'amulet', 'rhand', 'torso', 'lhand', 'gloves', 'belt', 'boots', 'ring1', 'ring2'];
const SLOT_LABEL = { head: 'Head', amulet: 'Amulet', rhand: 'Right Hand', torso: 'Torso', lhand: 'Left Hand', gloves: 'Gloves', belt: 'Belt', boots: 'Boots', ring1: 'Ring', ring2: 'Ring' };
const TYPE_SLOT = { helm: 'head', armor: 'torso', gloves: 'gloves', boots: 'boots', belt: 'belt', ring: 'ring', amulet: 'amulet', shield: 'lhand', bolts: 'lhand', scythe: 'rhand', sword: 'rhand', xbow: 'rhand' };
const TYPE_NAME = { helm: 'Helm', armor: 'Body Armor', gloves: 'Gloves', boots: 'Boots', belt: 'Belt', ring: 'Ring', amulet: 'Amulet', shield: 'Shield', bolts: 'Bolts', scythe: 'Polearm', sword: 'Sword', xbow: 'Crossbow' };
const WEAPON_TYPES = new Set(['scythe', 'sword', 'xbow']);
const ARMOR_TYPES = new Set(['helm', 'armor', 'gloves', 'boots', 'belt', 'shield']);
const TIER_NAME = ['Normal', 'Exceptional', 'Elite'];
const INV_W = 10, INV_H = 5;

/* ---------- base items: [code, name, type, tier, qlvl, reqStr, reqDex, w, h, a, b, extra] ---------- */
const BASE_ROWS = [
  // helms (def)
  ['cap', 'Cap', 'helm', 0, 1, 0, 0, 2, 2, 3, 5], ['skp', 'Skull Cap', 'helm', 0, 5, 15, 0, 2, 2, 8, 11], ['hlm', 'Helm', 'helm', 0, 11, 26, 0, 2, 2, 15, 18],
  ['fhl', 'Full Helm', 'helm', 0, 15, 41, 0, 2, 2, 23, 26], ['msk', 'Mask', 'helm', 0, 19, 23, 0, 2, 2, 9, 27], ['bhm', 'Bone Helm', 'helm', 0, 22, 25, 0, 2, 2, 33, 36],
  ['ghm', 'Great Helm', 'helm', 0, 23, 63, 0, 2, 2, 30, 35], ['crn', 'Crown', 'helm', 0, 29, 55, 0, 2, 2, 25, 45],
  ['xap', 'War Hat', 'helm', 1, 34, 20, 0, 2, 2, 45, 53, { lvl: 22 }], ['xkp', 'Sallet', 'helm', 1, 37, 43, 0, 2, 2, 52, 62, { lvl: 25 }], ['xlm', 'Casque', 'helm', 1, 42, 59, 0, 2, 2, 63, 72, { lvl: 25 }],
  ['xsk', 'Death Mask', 'helm', 1, 48, 55, 0, 2, 2, 54, 86, { lvl: 25 }], ['xh9', 'Grim Helm', 'helm', 1, 50, 58, 0, 2, 2, 60, 125, { lvl: 25 }], ['xhm', 'Winged Helm', 'helm', 1, 51, 115, 0, 2, 2, 85, 98, { lvl: 25 }], ['xrn', 'Grand Crown', 'helm', 1, 55, 103, 0, 2, 2, 78, 113, { lvl: 25 }],
  ['uap', 'Shako', 'helm', 2, 58, 50, 0, 2, 2, 98, 141, { lvl: 43 }], ['ukp', 'Hydraskull', 'helm', 2, 63, 84, 0, 2, 2, 101, 145, { lvl: 47 }], ['ulm', 'Armet', 'helm', 2, 68, 109, 0, 2, 2, 105, 149, { lvl: 51 }],
  ['usk', 'Demonhead', 'helm', 2, 74, 102, 0, 2, 2, 101, 154, { lvl: 55 }], ['uhm', 'Spired Helm', 'helm', 2, 79, 192, 0, 2, 2, 114, 159, { lvl: 59 }], ['uh9', 'Bone Visage', 'helm', 2, 84, 106, 0, 2, 2, 100, 157, { lvl: 63 }], ['urn', 'Corona', 'helm', 2, 85, 174, 0, 2, 2, 111, 165, { lvl: 66 }],
  // body armor
  ['qui', 'Quilted Armor', 'armor', 0, 1, 12, 0, 2, 3, 8, 11], ['lea', 'Leather Armor', 'armor', 0, 3, 15, 0, 2, 3, 14, 17], ['hla', 'Hard Leather Armor', 'armor', 0, 5, 20, 0, 2, 3, 21, 24],
  ['stu', 'Studded Leather', 'armor', 0, 8, 27, 0, 2, 3, 32, 35], ['rng', 'Ring Mail', 'armor', 0, 11, 36, 0, 2, 3, 45, 48], ['scl', 'Scale Mail', 'armor', 0, 13, 44, 0, 2, 3, 57, 60],
  ['chn', 'Chain Mail', 'armor', 0, 15, 48, 0, 2, 3, 72, 75], ['brs', 'Breast Plate', 'armor', 0, 18, 30, 0, 2, 3, 65, 68], ['spl', 'Splint Mail', 'armor', 0, 20, 51, 0, 2, 3, 90, 95],
  ['plt', 'Plate Mail', 'armor', 0, 24, 65, 0, 2, 3, 108, 116], ['fld', 'Field Plate', 'armor', 0, 28, 55, 0, 2, 3, 101, 105], ['gth', 'Gothic Plate', 'armor', 0, 32, 70, 0, 2, 3, 128, 135],
  ['ful', 'Full Plate Mail', 'armor', 0, 37, 80, 0, 2, 3, 150, 161], ['aar', 'Ancient Armor', 'armor', 0, 40, 100, 0, 2, 3, 218, 233],
  ['xui', 'Ghost Armor', 'armor', 1, 34, 38, 0, 2, 3, 102, 117, { lvl: 22 }], ['xea', 'Serpentskin Armor', 'armor', 1, 36, 43, 0, 2, 3, 111, 126, { lvl: 24 }], ['xla', 'Demonhide Armor', 'armor', 1, 39, 50, 0, 2, 3, 122, 136, { lvl: 25 }],
  ['xng', 'Linked Mail', 'armor', 1, 42, 74, 0, 2, 3, 158, 172, { lvl: 25 }], ['xhn', 'Mesh Armor', 'armor', 1, 45, 92, 0, 2, 3, 198, 213, { lvl: 25 }], ['xrs', 'Cuirass', 'armor', 1, 47, 65, 0, 2, 3, 188, 202, { lvl: 25 }],
  ['xlt', 'Templar Coat', 'armor', 1, 52, 118, 0, 2, 3, 252, 274, { lvl: 25 }], ['xtp', 'Mage Plate', 'armor', 1, 60, 55, 0, 2, 3, 225, 261, { lvl: 25 }], ['xul', 'Chaos Armor', 'armor', 1, 61, 140, 0, 2, 3, 315, 342, { lvl: 25 }],
  ['uui', 'Dusk Shroud', 'armor', 2, 65, 77, 0, 2, 3, 361, 467, { lvl: 49 }], ['uea', 'Wyrmhide', 'armor', 2, 67, 84, 0, 2, 3, 364, 470, { lvl: 50 }], ['uhn', 'Boneweave', 'armor', 2, 62, 158, 0, 2, 3, 399, 505, { lvl: 47 }],
  ['urs', 'Great Hauberk', 'armor', 2, 75, 118, 0, 2, 3, 395, 501, { lvl: 56 }], ['upl', 'Balrog Skin', 'armor', 2, 76, 165, 0, 2, 3, 410, 517, { lvl: 57 }], ['uth', 'Kraken Shell', 'armor', 2, 81, 174, 0, 2, 3, 434, 543, { lvl: 61 }],
  ['utp', 'Archon Plate', 'armor', 2, 84, 103, 0, 2, 3, 410, 524, { lvl: 63 }], ['uar', 'Sacred Armor', 'armor', 2, 85, 232, 0, 2, 3, 487, 600, { lvl: 66 }],
  // gloves
  ['lgl', 'Leather Gloves', 'gloves', 0, 3, 0, 0, 2, 2, 2, 3], ['vgl', 'Heavy Gloves', 'gloves', 0, 7, 0, 0, 2, 2, 5, 6], ['mgl', 'Chain Gloves', 'gloves', 0, 12, 25, 0, 2, 2, 8, 9],
  ['tgl', 'Light Gauntlets', 'gloves', 0, 20, 45, 0, 2, 2, 9, 11], ['hgl', 'Gauntlets', 'gloves', 0, 27, 60, 0, 2, 2, 12, 15],
  ['xlg', 'Demonhide Gloves', 'gloves', 1, 33, 20, 0, 2, 2, 28, 35, { lvl: 21 }], ['xvg', 'Sharkskin Gloves', 'gloves', 1, 39, 20, 0, 2, 2, 33, 39, { lvl: 25 }], ['xmg', 'Heavy Bracers', 'gloves', 1, 45, 58, 0, 2, 2, 37, 44, { lvl: 29 }],
  ['xtg', 'Battle Gauntlets', 'gloves', 1, 49, 88, 0, 2, 2, 39, 47, { lvl: 31 }], ['xhg', 'War Gauntlets', 'gloves', 1, 54, 110, 0, 2, 2, 43, 53, { lvl: 34 }],
  ['ulg', 'Bramble Mitts', 'gloves', 2, 57, 50, 0, 2, 2, 54, 62, { lvl: 42 }], ['uvg', 'Vampirebone Gloves', 'gloves', 2, 63, 50, 0, 2, 2, 56, 65, { lvl: 47 }], ['umg', 'Vambraces', 'gloves', 2, 69, 106, 0, 2, 2, 59, 67, { lvl: 51 }],
  ['utg', 'Crusader Gauntlets', 'gloves', 2, 76, 151, 0, 2, 2, 59, 68, { lvl: 57 }], ['uhg', 'Ogre Gauntlets', 'gloves', 2, 81, 185, 0, 2, 2, 62, 71, { lvl: 60 }],
  // boots
  ['lbt', 'Boots', 'boots', 0, 3, 0, 0, 2, 2, 2, 3], ['vbt', 'Heavy Boots', 'boots', 0, 7, 18, 0, 2, 2, 5, 6], ['mbt', 'Chain Boots', 'boots', 0, 12, 30, 0, 2, 2, 8, 9],
  ['tbt', 'Light Plated Boots', 'boots', 0, 20, 50, 0, 2, 2, 9, 11], ['hbt', 'Greaves', 'boots', 0, 27, 70, 0, 2, 2, 12, 15],
  ['xlb', 'Demonhide Boots', 'boots', 1, 36, 20, 0, 2, 2, 28, 35, { lvl: 24 }], ['xvb', 'Sharkskin Boots', 'boots', 1, 39, 47, 0, 2, 2, 33, 39, { lvl: 27 }], ['xmb', 'Mesh Boots', 'boots', 1, 43, 65, 0, 2, 2, 37, 44, { lvl: 29 }],
  ['xtb', 'Battle Boots', 'boots', 1, 49, 95, 0, 2, 2, 39, 47, { lvl: 31 }], ['xhb', 'War Boots', 'boots', 1, 54, 125, 0, 2, 2, 43, 53, { lvl: 34 }],
  ['ulb', 'Wyrmhide Boots', 'boots', 2, 60, 50, 0, 2, 2, 54, 62, { lvl: 45 }], ['uvb', 'Scarabshell Boots', 'boots', 2, 66, 91, 0, 2, 2, 56, 65, { lvl: 49 }], ['umb', 'Boneweave Boots', 'boots', 2, 72, 118, 0, 2, 2, 59, 67, { lvl: 54 }],
  ['utb', 'Mirrored Boots', 'boots', 2, 81, 163, 0, 2, 2, 59, 68, { lvl: 60 }], ['uhb', 'Myrmidon Greaves', 'boots', 2, 85, 208, 0, 2, 2, 62, 71, { lvl: 65 }],
  // belts (rows = potion rows)
  ['lsh', 'Sash', 'belt', 0, 3, 0, 0, 2, 1, 2, 2, { rows: 2 }], ['lbl', 'Light Belt', 'belt', 0, 7, 0, 0, 2, 1, 3, 3, { rows: 2 }], ['mbl', 'Belt', 'belt', 0, 12, 25, 0, 2, 1, 5, 5, { rows: 3 }],
  ['tbl', 'Heavy Belt', 'belt', 0, 20, 45, 0, 2, 1, 6, 6, { rows: 3 }], ['hbl', 'Plated Belt', 'belt', 0, 27, 60, 0, 2, 1, 8, 11, { rows: 4 }],
  ['zlb', 'Demonhide Sash', 'belt', 1, 36, 20, 0, 2, 1, 29, 34, { rows: 2, lvl: 24 }], ['zvb', 'Sharkskin Belt', 'belt', 1, 39, 20, 0, 2, 1, 31, 36, { rows: 2, lvl: 27 }], ['zmb', 'Mesh Belt', 'belt', 1, 43, 58, 0, 2, 1, 35, 40, { rows: 3, lvl: 29 }],
  ['ztb', 'Battle Belt', 'belt', 1, 49, 88, 0, 2, 1, 37, 42, { rows: 3, lvl: 31 }], ['zhb', 'War Belt', 'belt', 1, 54, 110, 0, 2, 1, 41, 52, { rows: 4, lvl: 34 }],
  ['ulc', 'Spiderweb Sash', 'belt', 2, 61, 50, 0, 2, 1, 55, 62, { rows: 2, lvl: 46 }], ['uvc', 'Vampirefang Belt', 'belt', 2, 68, 50, 0, 2, 1, 56, 63, { rows: 2, lvl: 51 }], ['umc', 'Mithril Coil', 'belt', 2, 75, 106, 0, 2, 1, 58, 65, { rows: 3, lvl: 56 }],
  ['utc', 'Troll Belt', 'belt', 2, 82, 151, 0, 2, 1, 59, 66, { rows: 3, lvl: 62 }], ['uhc', 'Colossus Girdle', 'belt', 2, 85, 185, 0, 2, 1, 61, 71, { rows: 4, lvl: 67 }],
  // shields (Althea) — block = shield block %
  ['buc', 'Buckler', 'shield', 0, 1, 12, 0, 2, 2, 4, 6, { block: 0 }], ['sml', 'Small Shield', 'shield', 0, 5, 22, 0, 2, 2, 8, 10, { block: 5 }], ['lrg', 'Large Shield', 'shield', 0, 11, 34, 0, 2, 3, 12, 14, { block: 12 }],
  ['kit', 'Kite Shield', 'shield', 0, 15, 47, 0, 2, 3, 16, 18, { block: 8 }], ['spk', 'Spiked Shield', 'shield', 0, 11, 30, 0, 2, 3, 15, 25, { block: 10 }], ['bsh', 'Bone Shield', 'shield', 0, 19, 25, 0, 2, 3, 10, 30, { block: 20 }],
  ['tow', 'Tower Shield', 'shield', 0, 22, 75, 0, 2, 3, 22, 25, { block: 24 }], ['gts', 'Gothic Shield', 'shield', 0, 30, 60, 0, 2, 4, 30, 35, { block: 16 }],
  ['xuc', 'Defender', 'shield', 1, 34, 38, 0, 2, 2, 41, 49, { block: 0, lvl: 22 }], ['xml', 'Round Shield', 'shield', 1, 37, 53, 0, 2, 2, 47, 55, { block: 5, lvl: 25 }], ['xrg', 'Scutum', 'shield', 1, 42, 71, 0, 2, 3, 53, 61, { block: 12, lvl: 25 }],
  ['xit', 'Dragon Shield', 'shield', 1, 45, 91, 0, 2, 3, 59, 67, { block: 8, lvl: 25 }], ['xsh', 'Grim Shield', 'shield', 1, 48, 58, 0, 2, 3, 50, 150, { block: 20, lvl: 25 }], ['xow', 'Pavise', 'shield', 1, 50, 133, 0, 2, 3, 68, 78, { block: 24, lvl: 25 }],
  ['uuc', 'Heater', 'shield', 2, 58, 77, 0, 2, 2, 95, 110, { block: 0, lvl: 43 }], ['uml', 'Luna', 'shield', 2, 61, 100, 0, 2, 2, 108, 123, { block: 5, lvl: 45 }], ['urg', 'Hyperion', 'shield', 2, 64, 127, 0, 2, 3, 119, 135, { block: 12, lvl: 48 }],
  ['uit', 'Monarch', 'shield', 2, 72, 156, 0, 2, 3, 133, 148, { block: 8, lvl: 54 }], ['ush', 'Troll Nest', 'shield', 2, 76, 156, 0, 2, 3, 158, 173, { block: 20, lvl: 57 }], ['uow', 'Aegis', 'shield', 2, 79, 219, 0, 2, 3, 145, 161, { block: 24, lvl: 59 }],
  // polearms & scythes (Althea, two-handed) — dmg
  ['bar', 'Bardiche', 'scythe', 0, 5, 40, 0, 2, 4, 1, 27, { twoH: 1, wsm: 10 }], ['vou', 'Voulge', 'scythe', 0, 11, 50, 0, 2, 4, 6, 21, { twoH: 1 }], ['scy', 'Scythe', 'scythe', 0, 15, 41, 41, 2, 4, 8, 20, { twoH: 1, wsm: -10 }],
  ['pax', 'Poleaxe', 'scythe', 0, 21, 62, 0, 2, 4, 18, 39, { twoH: 1, wsm: 10 }], ['hal', 'Halberd', 'scythe', 0, 29, 75, 47, 2, 4, 12, 45, { twoH: 1 }], ['wsc', 'War Scythe', 'scythe', 0, 34, 80, 80, 2, 4, 15, 36, { twoH: 1, wsm: -10 }],
  ['9b7', 'Lochaber Axe', 'scythe', 1, 33, 80, 0, 2, 4, 6, 58, { twoH: 1, wsm: 10, lvl: 21 }], ['9vo', 'Bill', 'scythe', 1, 37, 95, 0, 2, 4, 14, 53, { twoH: 1, lvl: 25 }], ['9s8', 'Battle Scythe', 'scythe', 1, 40, 82, 82, 2, 4, 18, 45, { twoH: 1, wsm: -10, lvl: 25 }],
  ['9pa', 'Partizan', 'scythe', 1, 35, 113, 0, 2, 4, 34, 75, { twoH: 1, wsm: 10, lvl: 23 }], ['9h9', 'Bec-de-Corbin', 'scythe', 1, 51, 133, 91, 2, 4, 13, 85, { twoH: 1, lvl: 25 }], ['9wc', 'Grim Scythe', 'scythe', 1, 55, 140, 140, 2, 4, 30, 70, { twoH: 1, wsm: -10, lvl: 25 }],
  ['7o7', 'Ogre Axe', 'scythe', 2, 60, 195, 75, 2, 4, 28, 145, { twoH: 1, lvl: 45 }], ['7vo', 'Colossus Voulge', 'scythe', 2, 64, 210, 55, 2, 4, 17, 165, { twoH: 1, wsm: 10, lvl: 48 }], ['7s8', 'Thresher', 'scythe', 2, 71, 152, 118, 2, 4, 12, 141, { twoH: 1, wsm: -10, lvl: 53 }],
  ['7pa', 'Cryptic Axe', 'scythe', 2, 79, 165, 103, 2, 4, 33, 150, { twoH: 1, wsm: 10, lvl: 59 }], ['7h7', 'Great Poleaxe', 'scythe', 2, 84, 179, 99, 2, 4, 46, 127, { twoH: 1, lvl: 63 }], ['7wc', 'Giant Thresher', 'scythe', 2, 85, 188, 140, 2, 4, 40, 114, { twoH: 1, wsm: -10, lvl: 66 }],
  // swords (Althea, one-handed)
  ['ssd', 'Short Sword', 'sword', 0, 1, 0, 0, 1, 3, 2, 7], ['scm', 'Scimitar', 'sword', 0, 2, 0, 21, 1, 3, 2, 6, { wsm: -20 }], ['sbr', 'Sabre', 'sword', 0, 4, 25, 25, 1, 3, 3, 8, { wsm: -10 }],
  ['flc', 'Falchion', 'sword', 0, 11, 33, 0, 1, 3, 9, 17], ['crs', 'Crystal Sword', 'sword', 0, 11, 43, 0, 2, 3, 5, 15], ['bsd', 'Broad Sword', 'sword', 0, 15, 48, 0, 2, 3, 7, 14, { wsm: 10 }],
  ['lsd', 'Long Sword', 'sword', 0, 20, 55, 39, 2, 3, 3, 19, { wsm: -10 }], ['wsd', 'War Sword', 'sword', 0, 27, 71, 45, 1, 3, 8, 20],
  ['9ss', 'Gladius', 'sword', 1, 30, 25, 0, 1, 3, 8, 22, { lvl: 18 }], ['9sm', 'Cutlass', 'sword', 1, 34, 25, 52, 1, 3, 8, 21, { wsm: -30, lvl: 21 }], ['9sb', 'Shamshir', 'sword', 1, 38, 58, 58, 1, 3, 10, 24, { wsm: -10, lvl: 23 }],
  ['9fc', 'Tulwar', 'sword', 1, 42, 70, 42, 1, 3, 16, 35, { lvl: 25 }], ['9ls', 'Rune Sword', 'sword', 1, 49, 103, 79, 2, 3, 10, 42, { wsm: -10, lvl: 25 }], ['9wd', 'Ancient Sword', 'sword', 1, 55, 127, 88, 1, 3, 18, 43, { lvl: 25 }],
  ['7ss', 'Falcata', 'sword', 2, 56, 150, 88, 1, 3, 31, 59, { lvl: 42 }], ['7sm', 'Ataghan', 'sword', 2, 61, 138, 95, 1, 3, 26, 46, { wsm: -20, lvl: 45 }], ['7fc', 'Hydra Edge', 'sword', 2, 69, 142, 105, 1, 3, 28, 68, { lvl: 51 }],
  ['7cr', 'Phase Blade', 'sword', 2, 73, 25, 136, 2, 3, 31, 35, { wsm: -30, lvl: 54 }], ['7bs', 'Conquest Sword', 'sword', 2, 78, 142, 112, 2, 3, 37, 53, { lvl: 58 }], ['7wd', 'Mythical Sword', 'sword', 2, 85, 147, 124, 1, 3, 40, 50, { lvl: 66 }],
  // crossbows (Eleanor, two-handed)
  ['lxb', 'Light Crossbow', 'xbow', 0, 6, 21, 27, 2, 3, 6, 9, { twoH: 1, wsm: -10 }], ['mxb', 'Crossbow', 'xbow', 0, 15, 40, 33, 2, 4, 9, 20, { twoH: 1 }],
  ['hxb', 'Heavy Crossbow', 'xbow', 0, 24, 60, 40, 2, 4, 14, 26, { twoH: 1, wsm: 10 }], ['rxb', 'Repeating Crossbow', 'xbow', 0, 33, 40, 50, 2, 3, 6, 12, { twoH: 1, wsm: -40 }],
  ['8lx', 'Arbalest', 'xbow', 1, 34, 52, 61, 2, 3, 14, 27, { twoH: 1, wsm: -10, lvl: 22 }], ['8mx', 'Siege Crossbow', 'xbow', 1, 40, 80, 70, 2, 4, 20, 42, { twoH: 1, lvl: 25 }],
  ['8hx', 'Ballista', 'xbow', 1, 47, 110, 80, 2, 4, 33, 55, { twoH: 1, wsm: 10, lvl: 25 }], ['8rx', 'Chu-Ko-Nu', 'xbow', 1, 54, 80, 95, 2, 3, 14, 32, { twoH: 1, wsm: -60, lvl: 25 }],
  ['6lx', 'Pellet Bow', 'xbow', 2, 57, 83, 155, 2, 3, 23, 50, { twoH: 1, wsm: -10, lvl: 42 }], ['6mx', 'Gorgon Crossbow', 'xbow', 2, 67, 117, 105, 2, 4, 25, 61, { twoH: 1, lvl: 50 }],
  ['6hx', 'Colossus Crossbow', 'xbow', 2, 75, 163, 77, 2, 4, 32, 91, { twoH: 1, wsm: 10, lvl: 57 }], ['6rx', 'Demon Crossbow', 'xbow', 2, 84, 141, 98, 2, 3, 26, 40, { twoH: 1, wsm: -60, lvl: 63 }],
  // ammo & jewelry
  ['cbl', 'Bolts', 'bolts', 0, 1, 0, 0, 1, 3, 0, 0], ['rin', 'Ring', 'ring', 0, 1, 0, 0, 1, 1, 0, 0], ['amu', 'Amulet', 'amulet', 0, 1, 0, 0, 1, 1, 0, 0],
];
const BASE = {};
for (const r of BASE_ROWS) {
  const [code, name, type, tier, q, str, dex, w, h, a, b, ex] = r;
  BASE[code] = Object.assign({ code, name, type, tier, q, str, dex, w, h, lo: a, hi: b, lvl: 0, wsm: 0, twoH: 0 }, ex || {});
}

/* ---------- affixes: [name, p|s, stat, min, max, ilvl, groups] ----------
   groups: W weapon  Q bolts  H helm  A body armor  S shield  G gloves  B boots  L belt  R ring  N amulet */
const AFFIX_ROWS = [
  ['Sturdy', 'p', 'ed', 10, 20, 1, 'HASGBL'], ['Strong', 'p', 'ed', 21, 30, 6, 'HASGBL'], ['Glorious', 'p', 'ed', 31, 40, 14, 'HASGBL'], ['Blessed', 'p', 'ed', 41, 50, 18, 'HASGBL'],
  ['Saintly', 'p', 'ed', 51, 65, 25, 'HASGBL'], ['Holy', 'p', 'ed', 66, 80, 35, 'HAS'], ['Godly', 'p', 'ed', 81, 100, 50, 'HAS'],
  ['Jagged', 'p', 'edmg', 10, 20, 1, 'W'], ['Deadly', 'p', 'edmg', 21, 30, 5, 'W'], ['Vicious', 'p', 'edmg', 31, 40, 11, 'W'], ['Brutal', 'p', 'edmg', 41, 50, 18, 'W'],
  ['Massive', 'p', 'edmg', 51, 65, 25, 'W'], ['Savage', 'p', 'edmg', 66, 80, 35, 'W'], ['Merciless', 'p', 'edmg', 81, 100, 45, 'W'], ['Ferocious', 'p', 'edmg', 101, 200, 55, 'W'], ['Cruel', 'p', 'edmg', 201, 300, 65, 'W'],
  ['Bronze', 'p', 'ar', 10, 20, 1, 'WGRNQ'], ['Iron', 'p', 'ar', 21, 40, 6, 'WGRNQ'], ['Steel', 'p', 'ar', 41, 60, 12, 'WGRNQ'], ['Silver', 'p', 'ar', 61, 80, 18, 'WGRN'],
  ['Gold', 'p', 'ar', 81, 100, 25, 'WGRN'], ['Platinum', 'p', 'ar', 101, 120, 32, 'WRN'], ['Meteoric', 'p', 'ar', 121, 150, 40, 'WRN'], ['Strange', 'p', 'ar', 151, 250, 50, 'W'],
  ["Lizard's", 'p', 'mana', 1, 5, 1, 'HRN'], ["Snake's", 'p', 'mana', 6, 10, 5, 'HRN'], ["Serpent's", 'p', 'mana', 11, 20, 12, 'HRN'], ["Drake's", 'p', 'mana', 21, 30, 20, 'HRN'],
  ["Dragon's", 'p', 'mana', 31, 40, 30, 'RN'], ["Wyrm's", 'p', 'mana', 41, 60, 40, 'RN'], ["Great Wyrm's", 'p', 'mana', 61, 90, 55, 'N'],
  ['Crimson', 'p', 'fr', 5, 10, 1, 'HASGBLRN'], ['Burgundy', 'p', 'fr', 11, 20, 10, 'HASGBLRN'], ['Garnet', 'p', 'fr', 21, 30, 20, 'HASBRN'], ['Ruby', 'p', 'fr', 31, 40, 30, 'ASN'],
  ['Azure', 'p', 'cr', 5, 10, 1, 'HASGBLRN'], ['Lapis', 'p', 'cr', 11, 20, 10, 'HASGBLRN'], ['Cobalt', 'p', 'cr', 21, 30, 20, 'HASBRN'], ['Sapphire', 'p', 'cr', 31, 40, 30, 'ASN'],
  ['Orange', 'p', 'lr', 5, 10, 1, 'HASGBLRN'], ['Coral', 'p', 'lr', 11, 20, 10, 'HASGBLRN'], ['Amber', 'p', 'lr', 21, 30, 20, 'HASBRN'], ['Topaz', 'p', 'lr', 31, 40, 30, 'ASN'],
  ['Beryl', 'p', 'pr', 5, 10, 1, 'HASGBLRN'], ['Jade', 'p', 'pr', 11, 20, 10, 'HASGBLRN'], ['Viridian', 'p', 'pr', 21, 30, 20, 'HASBRN'], ['Emerald', 'p', 'pr', 31, 40, 30, 'ASN'],
  ['Shimmering', 'p', 'allres', 3, 7, 10, 'HASRN'], ['Rainbow', 'p', 'allres', 8, 11, 20, 'HASRN'], ['Scintillating', 'p', 'allres', 12, 15, 30, 'HASN'], ['Prismatic', 'p', 'allres', 16, 25, 45, 'SN'], ['Chromatic', 'p', 'allres', 21, 30, 60, 'N'],
  ['Hierophant\'s', 'p', 'skills', 1, 1, 30, 'NHW'], ['Arch-Angel\'s', 'p', 'skills', 2, 2, 60, 'N'],
  ['of Strength', 's', 'str', 1, 2, 1, 'WHASGBLRN'], ['of Might', 's', 'str', 3, 5, 5, 'WHASGBLRN'], ['of the Ox', 's', 'str', 6, 9, 12, 'WHASGBLRN'], ['of the Giant', 's', 'str', 10, 15, 20, 'WASGBLRN'],
  ['of the Titan', 's', 'str', 16, 20, 30, 'WASLRN'], ['of Atlas', 's', 'str', 21, 30, 50, 'WAN'],
  ['of Dexterity', 's', 'dex', 1, 2, 1, 'WGBRNQ'], ['of Skill', 's', 'dex', 3, 5, 5, 'WGBRNQ'], ['of Accuracy', 's', 'dex', 6, 9, 12, 'WGBRNQ'], ['of Precision', 's', 'dex', 10, 15, 20, 'WGBRN'],
  ['of Perfection', 's', 'dex', 16, 20, 30, 'WGRN'], ['of Nirvana', 's', 'dex', 21, 30, 50, 'WN'],
  ['of Vita', 's', 'vit', 1, 2, 1, 'HASLRN'], ['of Life', 's', 'vit', 3, 5, 5, 'HASLRN'], ['of Vigor', 's', 'vit', 6, 9, 12, 'HASLRN'], ['of Vitality', 's', 'vit', 10, 15, 20, 'ASLRN'],
  ['of the Hulk', 's', 'vit', 16, 20, 30, 'ASLN'], ['of the Behemoth', 's', 'vit', 21, 30, 50, 'AN'],
  ['of Energy', 's', 'ene', 1, 2, 1, 'HARN'], ['of the Mind', 's', 'ene', 3, 5, 5, 'HARN'], ['of Brilliance', 's', 'ene', 6, 9, 12, 'HARN'], ['of Sorcery', 's', 'ene', 10, 15, 20, 'HARN'],
  ['of Wizardry', 's', 'ene', 16, 20, 30, 'RN'], ['of Enlightenment', 's', 'ene', 21, 30, 50, 'N'],
  ['of the Jackal', 's', 'life', 1, 5, 1, 'HASGBLRN'], ['of the Fox', 's', 'life', 6, 10, 5, 'HASGBLRN'], ['of the Wolf', 's', 'life', 11, 20, 12, 'HASGBLRN'], ['of the Tiger', 's', 'life', 21, 30, 20, 'HASBLRN'],
  ['of the Mammoth', 's', 'life', 31, 40, 30, 'HASLN'], ['of the Colossus', 's', 'life', 41, 60, 45, 'ASN'], ['of the Squid', 's', 'life', 61, 80, 60, 'AS'], ['of the Whale', 's', 'life', 81, 100, 75, 'A'],
  ['of Craftsmanship', 's', 'maxdmg', 1, 2, 1, 'WQ'], ['of Quality', 's', 'maxdmg', 3, 4, 5, 'WQ'], ['of Maiming', 's', 'maxdmg', 5, 7, 12, 'WQ'], ['of Slaying', 's', 'maxdmg', 8, 10, 20, 'WQ'],
  ['of Gore', 's', 'maxdmg', 11, 15, 30, 'WQ'], ['of Carnage', 's', 'maxdmg', 16, 20, 45, 'W'],
  ['of Readiness', 's', 'ias', 10, 10, 5, 'WG'], ['of Alacrity', 's', 'ias', 20, 20, 15, 'WG'], ['of Swiftness', 's', 'ias', 30, 30, 25, 'W'], ['of Quickness', 's', 'ias', 40, 40, 40, 'W'],
  ['of the Leech', 's', 'll', 3, 5, 9, 'WGRN'], ['of the Locust', 's', 'll', 6, 9, 25, 'WRN'], ['of the Lamprey', 's', 'll', 10, 12, 45, 'W'],
  ['of the Bat', 's', 'ml', 3, 5, 9, 'WGRN'], ['of the Vampire', 's', 'ml', 6, 9, 25, 'WRN'],
  ['of Pacing', 's', 'frw', 10, 10, 5, 'B'], ['of Haste', 's', 'frw', 20, 20, 15, 'B'], ['of Speed', 's', 'frw', 30, 30, 25, 'B'],
  ['of Balance', 's', 'fhr', 10, 17, 8, 'ASLN'], ['of Stability', 's', 'fhr', 20, 30, 22, 'ASLN'],
  ['of Chance', 's', 'mf', 5, 15, 10, 'HBGRN'], ['of Fortune', 's', 'mf', 16, 25, 30, 'HBGRN'],
  ['of Greed', 's', 'gf', 25, 40, 5, 'AHBGRN'], ['of Wealth', 's', 'gf', 41, 80, 25, 'AHBGRN'],
  ['of Regeneration', 's', 'regen', 3, 3, 5, 'ASHRNL'], ['of Regrowth', 's', 'regen', 5, 5, 15, 'ASHRNL'], ['of Revivification', 's', 'regen', 8, 8, 30, 'ASRN'],
  ['of Blocking', 's', 'block', 10, 10, 5, 'S'], ['of Deflecting', 's', 'block', 20, 20, 20, 'S'],
  ['of Flame', 's', 'fire', 2, 6, 3, 'WQGRN'], ['of Fire', 's', 'fire', 6, 14, 15, 'WQGRN'], ['of Burning', 's', 'fire', 14, 40, 35, 'WQ'],
  ['of Frost', 's', 'cold', 1, 4, 3, 'WQGRN'], ['of Icicle', 's', 'cold', 5, 10, 15, 'WQGRN'], ['of Glacier', 's', 'cold', 12, 30, 35, 'WQ'],
  ['of Shock', 's', 'ltng', 1, 8, 3, 'WQGRN'], ['of Lightning', 's', 'ltng', 1, 24, 15, 'WQGRN'], ['of Thunder', 's', 'ltng', 1, 70, 35, 'WQ'],
];
const GROUP_OF_TYPE = { scythe: 'W', sword: 'W', xbow: 'W', bolts: 'Q', helm: 'H', armor: 'A', shield: 'S', gloves: 'G', boots: 'B', belt: 'L', ring: 'R', amulet: 'N' };
const AFFIXES = AFFIX_ROWS.map(([name, kind, stat, min, max, lvl, groups]) => ({ name, kind, stat, min, max, lvl, groups, req: Math.max(1, Math.floor(lvl * .85)) }));
const ELEM = new Set(['fire', 'cold', 'ltng']);

/* ---------- uniques & sets (stats: number or [min,max] rolled on drop) ---------- */
const UNIQUES = [
  { n: "Biggin's Bonnet", b: 'cap', l: 3, s: { ar: 30, maxdmg: 14, ed: 30, life: 15, mana: 15 } },
  { n: 'Tarnhelm', b: 'skp', l: 15, s: { skills: 1, mf: [25, 50], gf: 75 } },
  { n: 'Coif of Glory', b: 'hlm', l: 14, s: { ed: 100, lr: 15, def: 10 } },
  { n: 'Duskdeep', b: 'fhl', l: 17, s: { ed: [30, 50], allres: 15, maxdmg: 8 } },
  { n: 'Wormskull', b: 'bhm', l: 21, s: { ll: 5, ml: 5, pr: 25, skills: 1 } },
  { n: 'Howltusk', b: 'ghm', l: 25, s: { ed: 80, dr: 5, mana: 20 } },
  { n: 'Undead Crown', b: 'crn', l: 29, s: { ll: 5, arp: 50, ed: [30, 60], pr: 50 } },
  { n: 'Peasant Crown', b: 'xap', l: 28, s: { skills: 1, vit: 20, ene: 20, regen: [6, 12], frw: 15, ed: 100 } },
  { n: 'Rockstopper', b: 'xkp', l: 31, s: { fhr: 30, ed: [160, 220], cr: [20, 40], lr: [20, 40], fr: [20, 50] } },
  { n: 'Valkyrie Wing', b: 'xhm', l: 44, s: { skills: [1, 2], frw: 20, fhr: 20, ed: [150, 200] } },
  { n: 'Crown of Thieves', b: 'xrn', l: 49, s: { ll: [9, 12], life: 50, mana: 35, gf: [80, 100], ed: [160, 200], fr: 33 } },
  { n: 'Harlequin Crest', b: 'uap', l: 62, s: { skills: 2, lifelvl: 1.5, str: 2, dex: 2, vit: 2, ene: 2, mf: 50, dr: 10 } },
  { n: "Andariel's Visage", b: 'usk', l: 83, s: { skills: 2, str: [25, 30], ll: [8, 10], ias: 20, ed: [100, 150], pr: 70, fr: -30 } },
  { n: 'Giant Skull', b: 'uh9', l: 65, s: { str: [25, 35], cb: 10, ed: [250, 320] } },
  { n: 'Crown of Ages', b: 'urn', l: 82, s: { skills: 1, allres: [20, 30], fhr: 30, ed: [100, 150], dr: [10, 15] } },
  { n: 'Greyform', b: 'qui', l: 7, s: { def: 20, fr: 20, cr: 20, dex: 10 } },
  { n: "Blinkbat's Form", b: 'lea', l: 12, s: { frw: 10, fhr: 40, def: 25, fire: [3, 6] } },
  { n: 'The Centurion', b: 'hla', l: 14, s: { ar: 50, life: 15, mana: 15, regen: 1, dr: 2 } },
  { n: 'Twitchthroe', b: 'stu', l: 16, s: { ias: 20, fhr: 25, block: 25, str: 10, dex: 10, def: 25 } },
  { n: 'Darkglow', b: 'rng', l: 14, s: { ed: [70, 100], allres: [5, 10], ar: 30 } },
  { n: 'Sparking Mail', b: 'chn', l: 17, s: { lr: 30, ed: [75, 85], ltng: [1, 20] } },
  { n: 'Venom Ward', b: 'brs', l: 20, s: { ed: [60, 100], pr: 90 } },
  { n: 'Boneflesh', b: 'plt', l: 26, s: { ll: 5, ar: 35, ed: [100, 120] } },
  { n: 'Rockfleece', b: 'fld', l: 28, s: { ed: [100, 130], dr: 10, str: 5 } },
  { n: 'Rattlecage', b: 'gth', l: 29, s: { cb: 25, ar: 45, def: 200 } },
  { n: 'Goldskin', b: 'ful', l: 28, s: { ed: [120, 150], allres: 35, gf: [50, 100] } },
  { n: 'Silks of the Victor', b: 'aar', l: 28, s: { ed: [100, 120], ml: 2, skills: 1 } },
  { n: 'Skin of the Vipermagi', b: 'xea', l: 29, s: { skills: 1, allres: [20, 35], ed: [80, 120] } },
  { n: 'Shaftstop', b: 'xhn', l: 38, s: { dr: 30, life: 60, ed: [180, 220] } },
  { n: "Duriel's Shell", b: 'xrs', l: 41, s: { lifelvl: 1, str: 15, ed: [160, 200], cr: 50, allres: 20 } },
  { n: 'Guardian Angel', b: 'xlt', l: 45, s: { block: 20, skills: 1, allres: 15, ed: [180, 200] } },
  { n: "Arkaine's Valor", b: 'upl', l: 85, s: { skills: [1, 2], fhr: 30, vit: [30, 45], ed: [150, 180], dr: [10, 15] } },
  { n: "Tyrael's Might", b: 'uar', l: 84, s: { frw: 20, str: [20, 30], allres: [20, 30], ed: [120, 150] } },
  { n: 'The Hand of Broc', b: 'lgl', l: 5, s: { ll: 3, ml: 3, ed: [10, 20], pr: 10, mana: 20 } },
  { n: 'Bloodfist', b: 'vgl', l: 9, s: { ias: 10, fhr: 30, life: 40, mindmg: 5, ed: [10, 20] } },
  { n: 'Chance Guards', b: 'mgl', l: 15, s: { mf: [25, 40], gf: 200, ar: 25, ed: [20, 30] } },
  { n: 'Magefist', b: 'tgl', l: 23, s: { skills: 1, ed: [20, 30], fire: [1, 6] } },
  { n: 'Frostburn', b: 'hgl', l: 29, s: { manap: 40, ed: [10, 20], cold: [1, 6] } },
  { n: 'Venom Grip', b: 'xlg', l: 29, s: { ll: 5, pr: 30, ed: [140, 160], cb: 5 } },
  { n: 'Lava Gout', b: 'xtg', l: 42, s: { ias: 20, fr: 24, fire: [2, 14], ed: [150, 200] } },
  { n: "Dracul's Grasp", b: 'uvg', l: 76, s: { str: [10, 15], ll: [7, 10], ed: [90, 120], cb: 10 } },
  { n: 'Soul Drainer', b: 'umg', l: 74, s: { ll: [4, 7], ml: [4, 7], ed: [90, 120] } },
  { n: 'Steelrend', b: 'uhg', l: 70, s: { str: [15, 20], edmg: 30, ed: [60, 70] } },
  { n: 'Hotspur', b: 'lbt', l: 5, s: { fr: 45, life: 15, ed: [10, 20], fire: [3, 6] } },
  { n: 'Gorefoot', b: 'vbt', l: 9, s: { frw: 20, ml: 2, ed: [20, 30] } },
  { n: 'Treads of Cthon', b: 'mbt', l: 15, s: { frw: 30, ed: [30, 40], life: 20 } },
  { n: 'Goblin Toe', b: 'tbt', l: 22, s: { cb: 25, ed: [50, 60], dr: 1 } },
  { n: 'Tearhaunch', b: 'hbt', l: 29, s: { frw: 20, str: 5, dex: 5, allres: 10, ed: [60, 80] } },
  { n: 'Waterwalk', b: 'xvb', l: 32, s: { frw: 20, life: 65, dex: 15, ed: [180, 210] } },
  { n: 'War Traveler', b: 'xtb', l: 42, s: { mf: [30, 50], str: 10, vit: 10, frw: 25, ed: [150, 190] } },
  { n: 'Gore Rider', b: 'xhb', l: 47, s: { cb: 10, ds: 15, frw: 30, ed: [160, 200] } },
  { n: 'Sandstorm Trek', b: 'uvb', l: 64, s: { str: [10, 15], vit: [10, 15], fhr: 20, frw: 20, pr: [40, 70], ed: [140, 170] } },
  { n: 'Shadow Dancer', b: 'uhb', l: 71, s: { skills: [1, 2], fhr: 30, dex: [15, 25], frw: 30, ed: [70, 100] } },
  { n: 'Lenymo', b: 'lsh', l: 7, s: { allres: 5, mana: 15 } },
  { n: 'Snakecord', b: 'lbl', l: 12, s: { pr: 50, regen: 5, ed: [20, 30] } },
  { n: 'Nightsmoke', b: 'mbl', l: 20, s: { allres: 10, mana: 20, ed: [30, 50], dr: 3 } },
  { n: 'Goldwrap', b: 'tbl', l: 27, s: { gf: [50, 80], mf: 30, ias: 10, ed: [40, 60] } },
  { n: 'Bladebuckle', b: 'hbl', l: 29, s: { str: 8, dex: 10, fhr: 30, ed: [80, 100] } },
  { n: 'String of Ears', b: 'zlb', l: 29, s: { ll: [6, 8], dr: [10, 15], ed: [150, 180] } },
  { n: "Thundergod's Vigor", b: 'zhb', l: 47, s: { str: 20, vit: 20, ed: [160, 200] } },
  { n: "Verdungo's Hearty Cord", b: 'umc', l: 63, s: { vit: [30, 40], fhr: 10, dr: [10, 15], ed: [90, 140] } },
  { n: 'Arachnid Mesh', b: 'ulc', l: 80, s: { skills: 1, manap: 5, ed: [90, 120] } },
  { n: 'Nagelring', b: 'rin', l: 7, s: { mf: [15, 30], ar: [50, 75] } },
  { n: 'Manald Heal', b: 'rin', l: 15, s: { ml: [4, 7], regen: [5, 8], life: 20 } },
  { n: 'The Stone of Jordan', b: 'rin', l: 29, s: { skills: 1, mana: 20, manap: 25, ltng: [1, 12] } },
  { n: 'Dwarf Star', b: 'rin', l: 45, s: { life: 40, gf: 100, dr: 4 } },
  { n: 'Raven Frost', b: 'rin', l: 45, s: { dex: [15, 20], ar: [150, 250], mana: 40, cold: [15, 45] } },
  { n: "Bul-Kathos' Wedding Band", b: 'rin', l: 58, s: { skills: 1, lifelvl: .5, ll: [3, 5] } },
  { n: 'Carrion Wind', b: 'rin', l: 60, s: { ll: [6, 9], pr: 55, dr: 5 } },
  { n: 'Nokozan Relic', b: 'amu', l: 14, s: { fhr: 20, fr: 50, fire: [3, 6] } },
  { n: 'The Eye of Etlich', b: 'amu', l: 20, s: { skills: 1, ll: [3, 7], cr: [16, 30] } },
  { n: 'The Mahim-Oak Curio', b: 'amu', l: 29, s: { allattr: 10, allres: 10, arp: 10, ed: 10 } },
  { n: "Saracen's Chance", b: 'amu', l: 47, s: { allattr: 12, allres: [15, 25] } },
  { n: "The Cat's Eye", b: 'amu', l: 58, s: { ias: 20, frw: 30, dex: 25 } },
  { n: 'Crescent Moon', b: 'amu', l: 58, s: { ll: [3, 6], ml: [11, 15], lr: 35 } },
  { n: "Highlord's Wrath", b: 'amu', l: 73, s: { skills: 1, ias: 20, ds: [25, 35], lr: 35 } },
  { n: "Mara's Kaleidoscope", b: 'amu', l: 75, s: { skills: 2, allattr: 5, allres: [20, 30] } },
  { n: 'Metalgrid', b: 'amu', l: 85, s: { ar: [400, 450], allres: [25, 35] } },
  { n: "Dimoak's Hew", b: 'bar', l: 8, s: { ias: 20, dex: 15, edmg: 100 } },
  { n: 'Steelgoad', b: 'vou', l: 14, s: { edmg: [60, 80], ar: 30, ds: 30, allres: 5 } },
  { n: 'Soul Harvest', b: 'scy', l: 19, s: { ml: 10, edmg: [50, 90], ar: 45, allres: 20, ene: 5 } },
  { n: 'The Battlebranch', b: 'pax', l: 25, s: { ias: 30, edmg: [50, 70], ar: [50, 100], ll: 7, dex: 10 } },
  { n: 'Woestave', b: 'hal', l: 28, s: { edmg: [20, 40], cold: [2, 6], cb: 15 } },
  { n: 'The Grim Reaper', b: 'wsc', l: 29, s: { ds: 100, edmg: 50, ml: 5, mindmg: 15 } },
  { n: 'The Meat Scraper', b: '9b7', l: 41, s: { edmg: [150, 200], ll: 10, mf: 25 } },
  { n: 'Blackleach Blade', b: '9vo', l: 42, s: { ll: 8, edmg: [100, 140] } },
  { n: 'Husoldal Evo', b: '9h9', l: 44, s: { ias: 20, edmg: [160, 200], regen: 20, ar: [200, 250] } },
  { n: "Grim's Burning Dead", b: '9wc', l: 45, s: { edmg: [140, 180], fire: [131, 232], fr: 45 } },
  { n: 'Bonehew', b: '7o7', l: 64, s: { ias: 50, edmg: [270, 320] } },
  { n: "The Reaper's Toll", b: '7s8', l: 75, s: { edmg: [190, 240], ll: [11, 15], ds: 33, cold: [4, 44] } },
  { n: 'Stormspire', b: '7wc', l: 70, s: { edmg: [150, 250], ltng: [1, 237], ias: 30, str: 10 } },
  { n: 'Tomb Reaver', b: '7pa', l: 84, s: { ias: 60, edmg: [200, 280], mf: [50, 80], allres: [30, 50] } },
  { n: "Rixot's Keen", b: 'ssd', l: 3, s: { edmg: 100, cb: 25, mindmg: 5 } },
  { n: 'Blood Crescent', b: 'scm', l: 7, s: { ias: 15, ll: 15, edmg: [60, 80], allres: 15 } },
  { n: 'Skewer of Krintiz', b: 'sbr', l: 10, s: { edmg: 50, ml: 7, str: 10, dex: 10 } },
  { n: 'Gleamscythe', b: 'flc', l: 13, s: { ias: 20, edmg: [60, 100], cold: [3, 5], mana: 30 } },
  { n: 'Hellplague', b: 'lsd', l: 22, s: { fire: [25, 75], edmg: [70, 80], ll: [5, 8] } },
  { n: "Culwen's Point", b: 'wsd', l: 29, s: { skills: 1, ias: 20, fhr: 20, ar: [60, 80], edmg: [70, 80] } },
  { n: 'Bloodletter', b: '9ss', l: 30, s: { edmg: 140, ll: [8, 12], ias: 20 } },
  { n: 'Djinn Slayer', b: '7sm', l: 65, s: { edmg: [190, 230], fire: [250, 500], ml: [3, 6] } },
  { n: 'Lightsabre', b: '7cr', l: 58, s: { ias: 20, ltng: [1, 200], ll: [5, 7], edmg: [150, 200] } },
  { n: 'Pelta Lunata', b: 'buc', l: 2, s: { ed: [30, 40], str: 2, block: 20 } },
  { n: 'Umbral Disk', b: 'sml', l: 9, s: { ed: [40, 50], dex: 10, life: 20 } },
  { n: 'Stormguild', b: 'lrg', l: 13, s: { ed: [50, 60], lr: 25, ltng: [1, 6] } },
  { n: 'Steelclash', b: 'kit', l: 17, s: { skills: 1, allres: [15, 25], block: 25, ed: [60, 100] } },
  { n: 'Bverrit Keep', b: 'tow', l: 19, s: { str: 5, ed: [80, 120], fr: 75 } },
  { n: 'Wall of the Eyeless', b: 'bsh', l: 20, s: { ll: 3, ml: 5, ed: [30, 40] } },
  { n: 'The Ward', b: 'gts', l: 26, s: { allres: [30, 50], str: 10, ed: [100, 140] } },
  { n: 'Lidless Wall', b: 'xsh', l: 41, s: { skills: 1, manap: 10, ed: [80, 130], ene: 10 } },
  { n: 'Stormshield', b: 'uit', l: 73, s: { dr: 35, block: 25, cr: 60, lr: 25, str: 30 } },
  { n: 'Leadcrow', b: 'lxb', l: 9, s: { edmg: 70, ds: 25, ar: 40, pr: 30 } },
  { n: 'Ichorsting', b: 'mxb', l: 18, s: { ar: 50, dex: 20, edmg: 50 } },
  { n: 'Hellcast', b: 'hxb', l: 27, s: { fire: [15, 35], edmg: [70, 80], ias: 20 } },
  { n: 'Doomslinger', b: 'rxb', l: 28, s: { edmg: [60, 100], ias: 30, life: 15 } },
  { n: 'Langer Briser', b: '8lx', l: 32, s: { edmg: [170, 200], life: 30, mf: [30, 60], ltng: [1, 212] } },
  { n: 'Buriza-Do Kyanon', b: '8hx', l: 41, s: { edmg: [150, 200], cold: [32, 196], ias: 80, dex: 35 } },
  { n: 'Demon Machine', b: '8rx', l: 49, s: { edmg: 123, ar: 632, mana: 36 } },
  { n: 'Gut Siphon', b: '6rx', l: 71, s: { ll: [12, 18], edmg: [160, 220] } },
  { n: 'Hellrack', b: '6hx', l: 76, s: { fire: [63, 324], cold: [63, 324], ltng: [63, 324], edmg: [180, 230], ias: 20 } },
];
const SETS = {
  sigon: { name: "Sigon's Complete Steel", partial: { 2: { def: 100 }, 3: { ll: 10 }, 4: { def: 100 }, 5: { fr: 12 } }, full: { ias: 20, allres: 10, ml: 10 } },
  angelic: { name: 'Angelic Raiment', partial: { 2: { ar: 150 }, 3: { dex: 20 } }, full: { mf: 40, allres: 25, life: 40 } },
  arctic: { name: 'Arctic Gear', partial: { 2: { def: 50 }, 3: { cold: [6, 14] } }, full: { dex: 15, mf: 20, cr: 30, ias: 15 } },
  immortal: { name: "Immortal King", partial: { 2: { ar: 50 }, 3: { ar: 75 }, 4: { ar: 125 }, 5: { ar: 200 } }, full: { skills: 3, allres: 50, ll: 10, edmg: 50 } },
};
const SET_ITEMS = [
  { n: "Sigon's Visor", b: 'ghm', set: 'sigon', l: 6, s: { mana: 30, def: 25 } },
  { n: "Sigon's Shelter", b: 'gth', set: 'sigon', l: 6, s: { ed: 25, lr: 30 } },
  { n: "Sigon's Gage", b: 'hgl', set: 'sigon', l: 6, s: { str: 10, ar: 20 } },
  { n: "Sigon's Sabot", b: 'hbt', set: 'sigon', l: 6, s: { frw: 20, cr: 40 } },
  { n: "Sigon's Wrap", b: 'hbl', set: 'sigon', l: 6, s: { fr: 20, lifelvl: 2 } },
  { n: "Sigon's Guard", b: 'tow', set: 'sigon', l: 6, s: { skills: 1, block: 20 } },
  { n: 'Angelic Sickle', b: 'sbr', set: 'angelic', l: 12, s: { ar: 75, edmg: 50 } },
  { n: 'Angelic Mantle', b: 'rng', set: 'angelic', l: 12, s: { ed: 40, dr: 3 } },
  { n: 'Angelic Halo', b: 'rin', set: 'angelic', l: 12, s: { life: 20, regen: 6 } },
  { n: 'Angelic Wings', b: 'amu', set: 'angelic', l: 12, s: { life: 20, dr: 3 } },
  { n: 'Arctic Furs', b: 'qui', set: 'arctic', l: 2, s: { ed: [275, 325], allres: 10 } },
  { n: 'Arctic Binding', b: 'lbl', set: 'arctic', l: 2, s: { cr: 40, def: 30 } },
  { n: 'Arctic Mitts', b: 'tgl', set: 'arctic', l: 2, s: { ias: 10, life: 20 } },
  { n: 'Arctic Horn', b: 'lxb', set: 'arctic', l: 2, s: { edmg: 50, ar: 50 } },
  { n: "Immortal King's Will", b: 'uhm', set: 'immortal', l: 47, s: { mf: [25, 40], gf: [25, 40], ed: 100 } },
  { n: "Immortal King's Soul Cage", b: 'uar', set: 'immortal', l: 66, s: { skills: 2, pr: 50, ed: 100 } },
  { n: "Immortal King's Detail", b: 'zhb', set: 'immortal', l: 29, s: { str: 25, fr: 31, ed: 100 } },
  { n: "Immortal King's Forge", b: 'xhg', set: 'immortal', l: 30, s: { str: 20, dex: 20, ias: 20 } },
  { n: "Immortal King's Pillar", b: 'xhb', set: 'immortal', l: 31, s: { ar: 110, life: 44, frw: 40 } },
  { n: "Immortal King's Stone Crusher", b: '7o7', set: 'immortal', l: 76, s: { edmg: 200, cb: 40, ds: 35 } },
];
const RARE_PRE = ['Beast', 'Eagle', 'Raven', 'Viper', 'Ghoul', 'Bat', 'Wraith', 'Vulture', 'Shadow', 'Stone', 'Gale', 'Storm', 'Warp', 'Spirit', 'Soul', 'Pain', 'Loath', 'Glyph', 'Doom', 'Blood', 'Dread', 'Grim', 'Bone', 'Death', 'Plague', 'Corpse', 'Rune', 'Havoc', 'Rage', 'Wrath', 'Bramble', 'Kraken', 'Gloom', 'Brimstone', 'Corruption', 'Damnation', 'Empyrian', 'Hailstone', 'Armageddon', 'Cruel', 'Blight', 'Dire', 'Onslaught', 'Victory', 'Fiend', 'Agony', 'Behemoth', 'Chaos', 'Cloud', 'Dragon', 'Order', 'Golem'];
const RARE_SUF = {
  helm: ['Visage', 'Hood', 'Horn', 'Cowl', 'Circlet', 'Crest', 'Veil', 'Mask', 'Brow', 'Casque', 'Corona', 'Dome'],
  armor: ['Shell', 'Coat', 'Jack', 'Mantle', 'Pelt', 'Carapace', 'Suit', 'Wrap', 'Shroud', 'Hide', 'Cloak', 'Husk'],
  gloves: ['Clutches', 'Fist', 'Grip', 'Hand', 'Claw', 'Talon', 'Knuckle', 'Hold', 'Paw', 'Touch'],
  boots: ['Spur', 'Track', 'Blazer', 'Nails', 'Brogues', 'Slippers', 'Stalker', 'Tread', 'Trample', 'Road'],
  belt: ['Lock', 'Coil', 'Strap', 'Chain', 'Clasp', 'Buckle', 'Harness', 'Winding', 'Cord', 'Girdle'],
  ring: ['Band', 'Coil', 'Eye', 'Gyre', 'Grip', 'Hold', 'Loop', 'Nail', 'Spiral', 'Turn', 'Whorl', 'Knuckle'],
  amulet: ['Beads', 'Collar', 'Gorget', 'Heart', 'Necklace', 'Scarab', 'Torc', 'Talisman', 'Noose', 'Emblem', 'Charm', 'Star'],
  shield: ['Aegis', 'Badge', 'Emblem', 'Guard', 'Mark', 'Rock', 'Tower', 'Wall', 'Ward', 'Wing', 'Shield'],
  scythe: ['Bite', 'Song', 'Thirst', 'Scythe', 'Reaver', 'Harvest', 'Cleaver', 'Reap', 'Gnash', 'Mangler'],
  sword: ['Edge', 'Bite', 'Song', 'Thirst', 'Fang', 'Razor', 'Saw', 'Scalpel', 'Sever', 'Splitter'],
  xbow: ['Quarrel', 'Nock', 'Fletch', 'Flight', 'Horn', 'Stinger', 'Volley', 'Barb', 'Bolt', 'Branch'],
  bolts: ['Quarrel', 'Barb', 'Stinger', 'Flight'],
};

/* ---------- stat text, D2 wording ---------- */
const STAT_ORDER = ['skills', 'ias', 'fhr', 'frw', 'edmg', 'mindmg', 'maxdmg', 'fire', 'cold', 'ltng', 'ar', 'arp', 'cb', 'ds', 'll', 'ml', 'ed', 'def', 'block', 'dr', 'allattr', 'str', 'dex', 'vit', 'ene', 'life', 'lifelvl', 'lifep', 'mana', 'manap', 'regen', 'allres', 'fr', 'cr', 'lr', 'pr', 'mf', 'gf'];
const STAT_TXT = {
  skills: v => `+${v} to All Skills`, ias: v => `+${v}% Increased Attack Speed`, fhr: v => `+${v}% Faster Hit Recovery`, frw: v => `+${v}% Faster Run/Walk`,
  edmg: v => `+${v}% Enhanced Damage`, mindmg: v => `+${v} to Minimum Damage`, maxdmg: v => `+${v} to Maximum Damage`,
  fire: v => `Adds ${v[0]}-${v[1]} Fire Damage`, cold: v => `Adds ${v[0]}-${v[1]} Cold Damage`, ltng: v => `Adds ${v[0]}-${v[1]} Lightning Damage`,
  ar: v => `+${v} to Attack Rating`, arp: v => `+${v}% Bonus to Attack Rating`, cb: v => `${v}% Chance of Crushing Blow`, ds: v => `${v}% Deadly Strike`,
  ll: v => `${v}% Life Stolen per Hit`, ml: v => `${v}% Mana Stolen per Hit`, ed: v => `+${v}% Enhanced Defense`, def: v => `+${v} Defense`,
  block: v => `${v}% Increased Chance of Blocking`, dr: v => `Damage Reduced by ${v}%`, allattr: v => `+${v} to All Attributes`,
  str: v => `+${v} to Strength`, dex: v => `+${v} to Dexterity`, vit: v => `+${v} to Vitality`, ene: v => `+${v} to Energy`,
  life: v => `+${v} to Life`, lifelvl: v => `+${v} to Life (per Character Level)`, lifep: v => `Increase Maximum Life ${v}%`,
  mana: v => `+${v} to Mana`, manap: v => `Increase Maximum Mana ${v}%`, regen: v => `Replenish Life +${v}`,
  allres: v => `All Resistances +${v}`, fr: v => `Fire Resist ${v >= 0 ? '+' : ''}${v}%`, cr: v => `Cold Resist +${v}%`, lr: v => `Lightning Resist +${v}%`, pr: v => `Poison Resist +${v}%`,
  mf: v => `${v}% Better Chance of Getting Magic Items`, gf: v => `${v}% Extra Gold from Monsters`,
};
const Q_COLOR = { low: '#7d7d7d', normal: '#d6d0c4', superior: '#d6d0c4', magic: '#6e86ff', rare: '#f2d64b', set: '#3ec46a', unique: '#c89b5a' };

/* ---------- helpers ---------- */
const ri = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
let ITEM_SEQ = 1;
function rollStat(stat, v) {
  if (Array.isArray(v)) {
    if (ELEM.has(stat)) return [v[0], v[1]];
    return ri(v[0], v[1]);
  }
  return v;
}
function addStat(S, k, v) {
  if (ELEM.has(k)) { const c = S[k] || [0, 0]; S[k] = [c[0] + v[0], c[1] + v[1]]; }
  else S[k] = (S[k] || 0) + v;
}

/* ---------- item creation ---------- */
function newItem(code, quality, ilvl) {
  const b = BASE[code];
  const it = { id: ITEM_SEQ++, base: code, q: quality, ilvl, stats: {}, x: -1, y: -1, name: b.name, lvlreq: b.lvl || 0 };
  if (ARMOR_TYPES.has(b.type)) it.bdef = ri(b.lo, b.hi);
  return it;
}
function finalizeItem(it) {
  const b = BASE[it.base], s = it.stats;
  const qmul = it.q === 'low' ? .75 : 1;
  if (ARMOR_TYPES.has(b.type)) {
    const bd = it.q === 'unique' || it.q === 'set' ? b.hi : it.bdef;
    it.def = Math.floor(bd * qmul * (1 + (s.ed || 0) / 100)) + (s.def || 0);
    it.defMod = !!(s.ed || s.def);
  }
  if (WEAPON_TYPES.has(b.type)) {
    const e = 1 + (s.edmg || 0) / 100;
    const mn = Math.floor(b.lo * qmul * e) + (s.mindmg || 0), mx = Math.max(mn + 1, Math.floor(b.hi * qmul * e) + (s.maxdmg || 0));
    it.dmg = [mn, mx]; it.dmgMod = !!(s.edmg || s.mindmg || s.maxdmg);
  }
  it.reqStr = b.str; it.reqDex = b.dex;
  return it;
}
function affixesFor(type, ilvl, kind, used) {
  const g = GROUP_OF_TYPE[type];
  return AFFIXES.filter(a => a.kind === kind && a.lvl <= ilvl && a.groups.includes(g) && !used.has(a.stat));
}
function pickAffix(type, ilvl, kind, used) {
  const pool = affixesFor(type, ilvl, kind, used);
  if (!pool.length) return null;
  const stats = [...new Set(pool.map(a => a.stat))];
  const st = pick(stats);
  return pick(pool.filter(a => a.stat === st));
}
function applyAffix(it, a) {
  if (ELEM.has(a.stat)) { const k = rnd(.85, 1.15); it.stats[a.stat] = [Math.max(1, Math.round(a.min * k)), Math.max(2, Math.round(a.max * k))]; }
  else it.stats[a.stat] = ri(a.min, a.max);
  it.lvlreq = Math.max(it.lvlreq, a.req);
}
function makeMagic(code, ilvl) {
  const b = BASE[code], it = newItem(code, 'magic', ilvl), used = new Set();
  const r = Math.random(); let pre = null, suf = null;
  if (r < .25 || r < .625) pre = pickAffix(b.type, ilvl, 'p', used);
  if (pre) used.add(pre.stat);
  if (r < .25 || r >= .625 || !pre) suf = pickAffix(b.type, ilvl, 's', used);
  if (pre) applyAffix(it, pre);
  if (suf) applyAffix(it, suf);
  it.name = `${pre ? pre.name + ' ' : ''}${b.name}${suf ? ' ' + suf.name : ''}`;
  return finalizeItem(it);
}
function makeRare(code, ilvl) {
  const b = BASE[code], it = newItem(code, 'rare', ilvl), used = new Set();
  const n = ilvl < 31 ? ri(3, 4) : ilvl < 51 ? ri(3, 5) : ri(4, 6);
  let np = 0, ns = 0;
  for (let i = 0; i < n; i++) {
    let kind = Math.random() < .5 ? 'p' : 's';
    if (kind === 'p' && np >= 3) kind = 's'; if (kind === 's' && ns >= 3) kind = 'p';
    let a = pickAffix(b.type, ilvl, kind, used) || pickAffix(b.type, ilvl, kind === 'p' ? 's' : 'p', used);
    if (!a) break;
    used.add(a.stat); applyAffix(it, a); if (a.kind === 'p') np++; else ns++;
  }
  it.name = `${pick(RARE_PRE)} ${pick(RARE_SUF[b.type] || ['Relic'])}`;
  return finalizeItem(it);
}
function makeUnique(u, ilvl) {
  const it = newItem(u.b, 'unique', ilvl);
  for (const k in u.s) it.stats[k] = rollStat(k, u.s[k]);
  it.name = u.n; it.lvlreq = u.l; it.uniq = u.n;
  return finalizeItem(it);
}
function makeSetItem(s, ilvl) {
  const it = newItem(s.b, 'set', ilvl);
  for (const k in s.s) it.stats[k] = rollStat(k, s.s[k]);
  it.name = s.n; it.lvlreq = s.l; it.set = s.set;
  return finalizeItem(it);
}
function makeWhite(code, ilvl) {
  const b = BASE[code];
  const r = Math.random();
  const q = r < .1 ? 'low' : r < .25 ? 'superior' : 'normal';
  const it = newItem(code, q, ilvl);
  if (q === 'low') it.name = `${pick(['Crude', 'Cracked', 'Damaged', 'Low Quality'])} ${b.name}`;
  if (q === 'superior') {
    it.name = 'Superior ' + b.name;
    if (WEAPON_TYPES.has(b.type)) { it.stats.edmg = ri(5, 15); if (Math.random() < .5) it.stats.ar = ri(1, 3); }
    else if (ARMOR_TYPES.has(b.type)) it.stats.ed = ri(5, 15);
  }
  return finalizeItem(it);
}

/* ---------- drop roll (D2 order: unique → set → rare → magic → white, Magic Find with diminishing returns) ---------- */
const TYPE_WEIGHT = { helm: 10, armor: 10, gloves: 8, boots: 8, belt: 7, shield: 6, scythe: 6, sword: 6, xbow: 0, bolts: 0, ring: 4, amulet: 3 };
function pickBase(ilvl) {
  const types = Object.keys(TYPE_WEIGHT); let tot = 0; for (const t of types) tot += TYPE_WEIGHT[t];
  let r = Math.random() * tot, type = types[0];
  for (const t of types) { r -= TYPE_WEIGHT[t]; if (r <= 0) { type = t; break; } }
  let pool = BASE_ROWS.map(x => BASE[x[0]]).filter(b => b.type === type && b.q <= ilvl && b.q >= ilvl - 24);
  if (!pool.length) pool = BASE_ROWS.map(x => BASE[x[0]]).filter(b => b.type === type && b.q <= Math.max(1, ilvl));
  if (!pool.length) pool = [BASE.cap];
  return pick(pool);
}
function rollItem(ilvl, mf, bonus) {
  const b = pickBase(ilvl);
  const eU = mf * 250 / (mf + 250), eS = mf * 500 / (mf + 500), eR = mf * 600 / (mf + 600), eM = mf;
  const B = bonus || 1;
  if (b.type !== 'bolts') {
    if (Math.random() < .012 * B * (1 + eU / 100)) {
      const pool = UNIQUES.filter(u => BASE[u.b].q <= ilvl + 2 && u.l <= ilvl + 6);
      if (pool.length) return makeUnique(pick(pool), ilvl);
    }
    if (Math.random() < .02 * B * (1 + eS / 100)) {
      const pool = SET_ITEMS.filter(s => BASE[s.b].q <= ilvl + 2 && s.l <= ilvl + 6);
      if (pool.length) return makeSetItem(pick(pool), ilvl);
    }
    if (Math.random() < .065 * B * (1 + eR / 100)) return makeRare(b.code, ilvl);
  }
  if (Math.random() < .28 * B * (1 + eM / 100) || b.type === 'ring' || b.type === 'amulet') return makeMagic(b.code, ilvl);
  return makeWhite(b.code, ilvl);
}
function sellPrice(it) {
  const b = BASE[it.base];
  const m = { low: .4, normal: 1, superior: 1.6, magic: 3, rare: 6, set: 9, unique: 12 }[it.q] || 1;
  return Math.max(1, Math.round((8 + it.ilvl * 3 + b.q * 2) * m));
}

/* ---------- inventory grid: every item takes exactly one cell (Fire Emblem convoy style) ---------- */
function invFits(inv, w, h, x, y, ignore) {
  if (x < 0 || y < 0 || x >= INV_W || y >= INV_H) return false;
  for (const o of inv) { if (o !== ignore && o.x === x && o.y === y) return false; }
  return true;
}
function invPlace(inv, it) {
  for (let y = 0; y < INV_H; y++) for (let x = 0; x < INV_W; x++)
    if (invFits(inv, 1, 1, x, y)) { it.x = x; it.y = y; inv.push(it); return true; }
  return false;
}

/* ---------- XP table (Diablo II values to 30, then the same growth curve to 99) ---------- */
const XP_TABLE = [0, 0, 500, 1500, 3750, 7875, 14175, 22680, 32886, 44396, 57715, 72144, 90180, 112725, 140906, 176132, 220165, 275207, 344008, 430010, 537513, 671891, 839864, 1049830, 1312287, 1640359, 2050449, 2563061, 3203826, 3902260, 4663553];
for (let l = 31; l <= 99; l++) { const inc = XP_TABLE[l - 1] - XP_TABLE[l - 2]; XP_TABLE[l] = Math.round(XP_TABLE[l - 1] + inc * 1.09); }
function xpPenalty(clvl, mlvl) { const d = clvl - mlvl; if (d <= 5) return 1; return [1, 1, 1, 1, 1, 1, .81, .62, .43, .24][d] ?? .05; }

/* ---------- derived stats ---------- */
const LOCAL_ARMOR = new Set(['ed', 'def']);
const LOCAL_WEAPON = new Set(['edmg', 'mindmg', 'maxdmg']);
function usableBy(cls, it) {
  const t = BASE[it.base].type;
  if (WEAPON_TYPES.has(t)) return cls.weapons.includes(t);
  if (t === 'shield' || t === 'bolts') return cls.off === t;
  return true;
}
function setCounts(eq, active) {
  const c = {};
  for (const s of active) { const it = eq[s]; if (it && it.set) c[it.set] = (c[it.set] || 0) + 1; }
  return c;
}
function computeStats(h, override, penalty) {
  const C = h.cls, eq = Object.assign({}, h.equip, override || {});
  let active = SLOTS.filter(s => eq[s] && usableBy(C, eq[s]));
  const w = eq.rhand;
  if (w && BASE[w.base].twoH && eq.lhand && BASE[eq.lhand.base].type === 'shield') active = active.filter(s => s !== 'lhand');
  let T;
  for (let pass = 0; pass < 3; pass++) {
    T = {};
    for (const s of active) {
      const it = eq[s], isW = s === 'rhand', isA = ARMOR_TYPES.has(BASE[it.base].type);
      for (const k in it.stats) {
        if (isW && LOCAL_WEAPON.has(k)) continue;
        if (isA && LOCAL_ARMOR.has(k)) continue;
        addStat(T, k, it.stats[k]);
      }
    }
    if (h.passiveStats) { const ps = h.passiveStats(); for (const k in ps) addStat(T, k, ps[k]); }
    const sc = setCounts(eq, active);
    for (const sid in sc) {
      const S = SETS[sid], n = sc[sid];
      for (const k in S.partial) if (n >= +k) for (const st in S.partial[k]) addStat(T, st, S.partial[k][st]);
      const total = SET_ITEMS.filter(x => x.set === sid).length;
      if (n >= total) for (const st in S.full) addStat(T, st, S.full[st]);
    }
    const aa = T.allattr || 0;
    const str = h.attr.str + (T.str || 0) + aa, dex = h.attr.dex + (T.dex || 0) + aa;
    const next = active.filter(s => { const it = eq[s]; return it.reqStr <= str && it.reqDex <= dex && it.lvlreq <= h.level; });
    if (next.length === active.length) break;
    active = next;
  }
  const g = (k) => T[k] || 0, aa = g('allattr');
  const S = { T, active: new Set(active) };
  S.str = h.attr.str + g('str') + aa; S.dex = h.attr.dex + g('dex') + aa; S.vit = h.attr.vit + g('vit') + aa; S.ene = h.attr.ene + g('ene') + aa;
  const L = h.level;
  S.lifeMax = Math.round((C.life + (L - 1) * C.lifeLvl + (S.vit - C.base.vit) * C.lifeVit + g('life') + g('lifelvl') * L) * (1 + g('lifep') / 100));
  S.manaMax = Math.round((C.mana + (L - 1) * C.manaLvl + (S.ene - C.base.ene) * C.manaEne + g('mana')) * (1 + g('manap') / 100));
  const wpn = active.includes('rhand') ? eq.rhand : null;
  const [wmin, wmax] = wpn ? wpn.dmg : [1, 2];
  const statBonus = C.dmgStat === 'str' ? S.str : S.dex;
  const mult = 1 + (statBonus + g('edmg')) / 100;
  S.min = Math.max(1, Math.floor((wmin + g('mindmg')) * mult));
  S.max = Math.max(S.min + 1, Math.floor((wmax + g('maxdmg')) * mult));
  S.fire = T.fire || [0, 0]; S.cold = T.cold || [0, 0]; S.ltng = T.ltng || [0, 0];
  S.ar = Math.max(1, Math.round(((S.dex - 7) * 5 + C.arBase + g('ar')) * (1 + g('arp') / 100)));
  let def = 0; for (const s of active) if (eq[s].def) def += eq[s].def;
  S.def = Math.round((def + g('def') + S.dex / 4) * (1 + g('defp') / 100));
  const sh = active.includes('lhand') && BASE[eq.lhand.base].type === 'shield' ? eq.lhand : null;
  S.block = sh ? Math.min(75, Math.floor((C.block + (BASE[sh.base].block || 0) + g('block')) * Math.max(0, S.dex - 15) / (L * 2))) : 0;
  const pen = penalty || 0;
  for (const r of ['fr', 'cr', 'lr', 'pr']) S[r] = Math.min(75, g(r) + g('allres') + pen);
  S.ias = g('ias'); const eias = Math.floor(120 * S.ias / (120 + S.ias));
  S.speed = Math.max(.6, Math.min(2.2, 1 + (eias - (wpn ? BASE[wpn.base].wsm : 0)) / 100));
  S.frw = g('frw'); S.run = 1 + Math.floor(150 * S.frw / (150 + S.frw)) / 100;
  S.fhr = g('fhr'); S.ll = g('ll'); S.ml = g('ml'); S.mf = g('mf'); S.gf = g('gf'); S.cb = Math.min(100, g('cb')); S.ds = Math.min(100, g('ds'));
  S.regen = g('regen'); S.skills = g('skills'); S.dr = Math.min(50, g('dr')); S.cdr = Math.min(50, g('cdr'));
  S.weapon = wpn;
  S.beltRows = active.includes('belt') ? BASE[eq.belt.base].rows : 1;
  return S;
}
function chanceToHit(ar, def, alvl, dlvl) {
  return Math.max(.05, Math.min(.95, 2 * ar / (ar + def) * alvl / (alvl + dlvl)));
}

/* force a quality (shop bundles / gacha) */
function makeByQuality(q, ilvl) {
  if (q === 'unique') { const pool = UNIQUES.filter(u => BASE[u.b].q <= ilvl + 6 && u.l <= ilvl + 8); if (pool.length) return makeUnique(pick(pool), ilvl); q = 'rare'; }
  if (q === 'set') { const pool = SET_ITEMS.filter(x => BASE[x.b].q <= ilvl + 6 && x.l <= ilvl + 8); if (pool.length) return makeSetItem(pick(pool), ilvl); q = 'rare'; }
  let b = pickBase(ilvl), guard = 20;
  while (b.type === 'bolts' && q !== 'magic' && guard--) b = pickBase(ilvl);
  if (q === 'rare') return makeRare(b.code, ilvl);
  if (q === 'magic') return makeMagic(b.code, ilvl);
  return makeWhite(b.code, ilvl);
}
