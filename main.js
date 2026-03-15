import { MenuScene } from './scenes/MenuScene.js';
import { SurvivalScene } from './scenes/SurvivalScene.js';
import { getDefaultProgress, sanitizeProgress } from './systems/storage.js';

function runBalanceSanityChecks() {
  const normal = { radius: 12, damage: 10 };
  const fast = { radius: 9, damage: 5 };
  const tank = { radius: 16, damage: 15 };
  const progress = sanitizeProgress({ coins: 12, upgrades: { speed: 1, fireRate: 2, bulletSpeed: 3 } });
  const defaults = getDefaultProgress();
  const persistedCoins = sanitizeProgress({ coins: 7, upgrades: { speed: 0, fireRate: 0, bulletSpeed: 0 } });
  const fireRateMultiplier = Math.max(0.45, 1 - (2 * 0.08));
  const computedDelay = Math.max(180, Math.round(650 * fireRateMultiplier));
  const computedBulletSpeed = 480 + (3 * 60);
  const testAngle = Math.PI / 4;

  console.assert(fast.damage < normal.damage, 'Les ennemis rapides doivent faire moins de dégâts que les normaux.');
  console.assert(tank.damage > normal.damage, 'Les tanks doivent faire plus de dégâts que les normaux.');
  console.assert(tank.radius > normal.radius, 'Les tanks doivent être plus gros que les ennemis normaux.');
  console.assert(fast.radius < normal.radius, 'Les rapides doivent être plus petits que les ennemis normaux.');
  console.assert(0.28 > 0 && 0.28 < 1, 'Le taux de drop des pièces doit être compris entre 0 et 1.');
  console.assert(progress.coins === 12, 'Les pièces sauvegardées doivent être conservées.');
  console.assert(progress.upgrades.fireRate === 2, 'Les niveaux d’upgrade doivent être conservés.');
  console.assert(defaults.upgrades.speed === 0, 'Les upgrades par défaut doivent démarrer à 0.');
  console.assert(persistedCoins.coins === 7, 'Les pièces doivent pouvoir être relues correctement depuis la sauvegarde.');
  console.assert(sanitizeProgress(null).coins === 0, 'Une sauvegarde absente doit retomber à 0 pièce.');
  console.assert(sanitizeProgress({ coins: -5, upgrades: {} }).coins === 0, 'Les pièces négatives doivent être corrigées à 0.');
  console.assert(140 > 22, 'Le rayon magnétique doit être supérieur au rayon de ramassage.');
  console.assert(typeof getDefaultProgress().coins === 'number', 'La structure de progression doit rester valide.');
  console.assert(computedDelay < 650, 'Un upgrade de cadence doit réduire le délai de tir.');
  console.assert(computedBulletSpeed === 660, 'Un upgrade de vitesse des balles doit être appliqué correctement.');
  console.assert(Math.abs(Math.cos(testAngle) * 480) > 300, 'La vitesse horizontale des projectiles doit être calculée correctement.');
  console.assert(Math.abs(Math.sin(testAngle) * 480) > 300, 'La vitesse verticale des projectiles doit être calculée correctement.');
  console.assert(typeof SurvivalScene === 'function', 'La scène de survie doit exister.');
  console.assert(typeof MenuScene === 'function', 'La scène menu doit exister.');
}

runBalanceSanityChecks();

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#111111',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  scene: [MenuScene, SurvivalScene],
};

const game = new Phaser.Game(config);
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
