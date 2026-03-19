// BackgroundSystem.js
// Fallback intelligent : cycle sur les 10 backgrounds disponibles

export function buildBackground(scene) {
  const level    = scene.currentLevel || 1;

  // Cycle sur 10 backgrounds : niveau 11 → bg_01, niveau 12 → bg_02, etc.
  const bgIndex  = ((level - 1) % 10) + 1;
  const levelKey = bgIndex.toString().padStart(2, '0');
  const textureKey = `bg_level_${levelKey}`;

  scene.bgLayers = {};

  // Fallback si la texture n'est pas chargée
  const key = scene.textures.exists(textureKey) ? textureKey : 'bg_level_01';

  scene.bgLayers.image = scene.add.image(scene.centerX, scene.centerY, key)
    .setDepth(-100)
    .setScrollFactor(0)
    .setAlpha(0.82)
    .setDisplaySize(scene.width, scene.height);

  scene.bgLayers.dim = scene.add.rectangle(
    scene.centerX, scene.centerY,
    scene.width, scene.height,
    0x020617, 0.22
  ).setDepth(-95).setScrollFactor(0);

  // Starfield lointain
  scene.bgLayers.starsFar = scene.add.tileSprite(
    scene.centerX, scene.centerY,
    scene.width, scene.height,
    createStarTexture(scene, 'stars_far', 120, 1)
  ).setDepth(-90).setAlpha(0.35).setScrollFactor(0);

  // Starfield proche
  scene.bgLayers.starsNear = scene.add.tileSprite(
    scene.centerX, scene.centerY,
    scene.width, scene.height,
    createStarTexture(scene, 'stars_near', 60, 2)
  ).setDepth(-80).setAlpha(0.6).setScrollFactor(0);

  scene.bgParallax = { x: 0, y: 0 };
}

function createStarTexture(scene, key, count, size) {
  if (scene.textures.exists(key)) return key;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  const W = 512, H = 512;

  g.fillStyle(0x000000, 0);
  g.fillRect(0, 0, W, H);

  for (let i = 0; i < count; i++) {
    const x = Phaser.Math.Between(0, W);
    const y = Phaser.Math.Between(0, H);
    const r = Phaser.Math.FloatBetween(size * 0.4, size);
    g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.3, 1));
    g.fillCircle(x, y, r);
  }

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

export function animateBackground(scene, delta) {
  if (!scene.player?.body) return;

  const vx = scene.player.body.velocity.x || 0;
  const vy = scene.player.body.velocity.y || 0;
  const dt = delta / 1000;

  if (scene.bgLayers?.starsFar) {
    scene.bgLayers.starsFar.tilePositionX += 0.3 * dt + vx * 0.0005;
    scene.bgLayers.starsFar.tilePositionY += 0.8 * dt + vy * 0.0005;
  }

  if (scene.bgLayers?.starsNear) {
    scene.bgLayers.starsNear.tilePositionX += 0.6 * dt + vx * 0.0015;
    scene.bgLayers.starsNear.tilePositionY += 1.2 * dt + vy * 0.0015;
  }
}
