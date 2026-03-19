// storage.js — v3 : ajout du système de modules
export const STORAGE_KEY = 'survival60_progress';

export function getDefaultProgress() {
  return {
    coins:    0,
    checkpointLevel:      1,
    unlockedCheckpoints:  [1],
    upgrades: {
      speed:       0,
      fireRate:    0,
      bulletSpeed: 0,
    },
    // Modules du vaisseau (permanents)
    modules: {
      owned: ['basic'],
      slots: ['basic', null, null, null],  // [weapon, left, right, rear]
    },
  };
}

export function sanitizeProgress(data) {
  const fallback = getDefaultProgress();
  const safe     = data && typeof data === 'object' ? data : {};
  const upgrades = safe.upgrades && typeof safe.upgrades === 'object' ? safe.upgrades : {};

  // Modules
  const rawMod  = safe.modules && typeof safe.modules === 'object' ? safe.modules : {};
  const owned   = Array.isArray(rawMod.owned)
    ? rawMod.owned.filter(id => typeof id === 'string')
    : ['basic'];
  if (!owned.includes('basic')) owned.unshift('basic');

  const rawSlots = Array.isArray(rawMod.slots) ? rawMod.slots : ['basic', null, null, null];
  const slots = [
    typeof rawSlots[0] === 'string' ? rawSlots[0] : 'basic',
    typeof rawSlots[1] === 'string' ? rawSlots[1] : null,
    typeof rawSlots[2] === 'string' ? rawSlots[2] : null,
  ];

  // Checkpoints
  let unlocked = Array.isArray(safe.unlockedCheckpoints)
    ? safe.unlockedCheckpoints.map(n => Math.floor(Number(n))).filter(n => Number.isFinite(n) && n >= 1)
    : [1];
  if (unlocked.length === 0) unlocked = [1];

  return {
    coins: Number.isFinite(safe.coins)
      ? Math.max(0, Math.floor(safe.coins))
      : fallback.coins,

    checkpointLevel: Number.isFinite(safe.checkpointLevel)
      ? Math.max(1, Math.floor(safe.checkpointLevel))
      : fallback.checkpointLevel,

    unlockedCheckpoints: unlocked,

    upgrades: {
      speed:       Number.isFinite(upgrades.speed)       ? Math.max(0, Math.floor(upgrades.speed))       : 0,
      fireRate:    Number.isFinite(upgrades.fireRate)    ? Math.max(0, Math.floor(upgrades.fireRate))    : 0,
      bulletSpeed: Number.isFinite(upgrades.bulletSpeed) ? Math.max(0, Math.floor(upgrades.bulletSpeed)) : 0,
    },

    modules: { owned, slots },
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    return sanitizeProgress(JSON.parse(raw));
  } catch (e) {
    console.warn('Impossible de lire la sauvegarde, réinitialisation.', e);
    return getDefaultProgress();
  }
}

export function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProgress(data)));
}

export function unlockCheckpoint(level) {
  const progress = loadProgress();
  if (!progress.unlockedCheckpoints.includes(level)) {
    progress.unlockedCheckpoints.push(level);
    progress.unlockedCheckpoints.sort((a, b) => a - b);
    saveProgress(progress);
  }
}

/** Achète un module et le sauvegarde */
export function purchaseModule(moduleId, cost) {
  const progress = loadProgress();
  if (progress.coins < cost) return false;
  if (progress.modules.owned.includes(moduleId)) return false;
  progress.coins -= cost;
  progress.modules.owned.push(moduleId);
  saveProgress(progress);
  return true;
}

/** Équipe un module dans un slot et sauvegarde */
export function equipModule(moduleId, slotIndex) {
  const progress = loadProgress();
  if (!progress.modules.owned.includes(moduleId)) return false;
  if (slotIndex < 0 || slotIndex > 3) return false;
  progress.modules.slots[slotIndex] = moduleId;
  saveProgress(progress);
  return true;
}

/** Retire un module d'un slot */
export function unequipModule(slotIndex) {
  const progress = loadProgress();
  if (slotIndex === 0) progress.modules.slots[0] = 'basic';  // slot arme → retour basic
  else progress.modules.slots[slotIndex] = null;  // slots 1,2,3 → null
  saveProgress(progress);
  return true;
}
