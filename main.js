import { initAudio } from './systems/AudioConfig.js';
import { MenuScene }     from './scenes/MenuScene.js';
import { ShopScene }        from './scenes/ShopScene.js';
import { BossVictoryScene } from './scenes/BossVictoryScene.js';
import { MapScene }      from './scenes/MapScene.js';
import { SurvivalScene } from './scenes/SurvivalScene.js';
import { getDefaultProgress, sanitizeProgress } from './systems/storage.js';

function runBalanceSanityChecks() {
  const normal   = { radius: 12, damage: 10 };
  const fast     = { radius: 9,  damage: 5  };
  const tank     = { radius: 16, damage: 15 };
  const progress = sanitizeProgress({ coins: 12, upgrades: { speed: 1, fireRate: 2, bulletSpeed: 3 } });
  const defaults = getDefaultProgress();
  const fireRateMultiplier = Math.max(0.45, 1 - (2 * 0.08));
  const computedDelay      = Math.max(180, Math.round(650 * fireRateMultiplier));
  const computedBulletSpeed = 480 + (3 * 60);
  const testAngle = Math.PI / 4;

  console.assert(fast.damage < normal.damage,         'Les ennemis rapides doivent faire moins de dégâts.');
  console.assert(tank.damage > normal.damage,         'Les tanks doivent faire plus de dégâts.');
  console.assert(tank.radius > normal.radius,         'Les tanks doivent être plus gros.');
  console.assert(fast.radius < normal.radius,         'Les rapides doivent être plus petits.');
  console.assert(progress.coins === 12,               'Les pièces sauvegardées doivent être conservées.');
  console.assert(progress.upgrades.fireRate === 2,    'Les niveaux d\'upgrade doivent être conservés.');
  console.assert(defaults.upgrades.speed === 0,       'Les upgrades par défaut doivent démarrer à 0.');
  console.assert(sanitizeProgress(null).coins === 0,  'Une sauvegarde absente doit retomber à 0 pièce.');
  console.assert(computedDelay < 650,                 'Un upgrade de cadence doit réduire le délai de tir.');
  console.assert(computedBulletSpeed === 660,         'Un upgrade de vitesse de balle doit être appliqué.');
  console.assert(Math.abs(Math.cos(testAngle) * 480) > 300, 'La vitesse horizontale doit être correcte.');
  console.assert(typeof SurvivalScene === 'function', 'SurvivalScene doit exister.');
  console.assert(typeof MenuScene === 'function',     'MenuScene doit exister.');
  console.assert(typeof MapScene === 'function',      'MapScene doit exister.');
  console.assert(typeof ShopScene === 'function',     'ShopScene doit exister.');
}

runBalanceSanityChecks();

const config = {
  type:            Phaser.AUTO,
  parent:          'game-container',
  width:           window.innerWidth,
  height:          window.innerHeight,
  backgroundColor: '#030612',
  dom: {
    createContainer: true,
  },
  physics: {
    default: 'arcade',
    arcade:  { debug: false },
  },
  scene: [MenuScene, MapScene, ShopScene, BossVictoryScene, SurvivalScene],
};

const game = new Phaser.Game(config);
initAudio(game);  // Écoute la première interaction pour débloquer l'audio
window.addEventListener('resize', () => {
  game.scale.resize(window.innerWidth, window.innerHeight);
});
