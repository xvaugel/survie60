export const STORAGE_KEY = 'survival60_progress';

export function getDefaultProgress() {
  return {
    coins: 0,
    upgrades: {
      speed: 0,
      fireRate: 0,
      bulletSpeed: 0,
    },
  };
}

export function sanitizeProgress(data) {
  const fallback = getDefaultProgress();
  const safe = data && typeof data === 'object' ? data : {};
  const upgrades = safe.upgrades && typeof safe.upgrades === 'object' ? safe.upgrades : {};

  return {
    coins: Number.isFinite(safe.coins) ? Math.max(0, Math.floor(safe.coins)) : fallback.coins,
    upgrades: {
      speed: Number.isFinite(upgrades.speed) ? Math.max(0, Math.floor(upgrades.speed)) : fallback.upgrades.speed,
      fireRate: Number.isFinite(upgrades.fireRate) ? Math.max(0, Math.floor(upgrades.fireRate)) : fallback.upgrades.fireRate,
      bulletSpeed: Number.isFinite(upgrades.bulletSpeed)
        ? Math.max(0, Math.floor(upgrades.bulletSpeed))
        : fallback.upgrades.bulletSpeed,
    },
  };
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProgress();
    return sanitizeProgress(JSON.parse(raw));
  } catch (error) {
    console.warn('Impossible de lire la sauvegarde locale, réinitialisation.', error);
    return getDefaultProgress();
  }
}

export function saveProgress(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitizeProgress(data)));
}
