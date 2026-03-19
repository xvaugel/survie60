// WeaponSystem.js — v2 : intégration laser + tir arrière
import { fireRearGun } from './ModuleSystem.js';

export function createDefaultWeaponState() {
  return { equipped: 'basic', owned: ['basic'] };
}

export function getWeaponConfig(type) {
  const configs = {
    basic: {
      cooldown: 260,
      bulletSpeedMultiplier: 1,
    },
    spread: {
      cooldown: 340,
      bulletSpeedMultiplier: 1,
      angles: [-0.16, 0.16],
      damage: 0.8,
      pierceOverride: 0,
    },
    'side-double': {
      cooldown: 320,
      bulletSpeedMultiplier: 0.82,
      sideOffsets: [-16, 16],
      damage: 0.45,
      pierceOverride: 0,
    },
    // double = alias de side-double (nouvelle boutique modules)
    double: {
      cooldown: 320,
      bulletSpeedMultiplier: 0.82,
      sideOffsets: [-16, 16],
      damage: 0.45,
      pierceOverride: 0,
    },
    laser: {
      cooldown: 0,   // continu — géré par ModuleSystem
      isLaser: true,
    },
  };
  return configs[type] || configs.basic;
}

export function equipWeapon(scene, weaponType) {
  if (!scene.weaponState) scene.weaponState = createDefaultWeaponState();
  if (!scene.weaponState.owned.includes(weaponType)) return;
  scene.weaponState.equipped = weaponType;
}

export function unlockWeapon(scene, weaponType) {
  if (!scene.weaponState) scene.weaponState = createDefaultWeaponState();
  if (!scene.weaponState.owned.includes(weaponType)) {
    scene.weaponState.owned.push(weaponType);
  }
}

export function shootEquippedWeapon(scene, time) {
  // Dériver l'arme depuis moduleState si disponible (nouveau système)
  const weaponId = scene.moduleState?.slots?.[0] || scene.weaponState?.equipped || 'basic';
  const config   = getWeaponConfig(weaponId);

  // Laser : géré dans ModuleSystem.tickModules — ici on gère juste l'affichage du beam
  if (config.isLaser) {
    _handleLaserBeam(scene);
    return true;
  }

  if (time - scene.lastShotTime < config.cooldown) return false;
  scene.lastShotTime = time;

  if (weaponId === 'spread') {
    fireSpread(scene, config);
  } else if (weaponId === 'double' || weaponId === 'side-double') {
    fireSideDouble(scene, config);
  } else {
    fireBasic(scene, config);
  }

  // Déclencher le tir arrière si le module est actif
  fireRearGun(scene);

  return true;
}

// ── Laser beam visuel ──────────────────────────────────────────
function _handleLaserBeam(scene) {
  const rt = scene.moduleRuntime?.laser;
  if (!rt) return;

  // Créer ou mettre à jour le beam
  if (!rt.beam) {
    rt.beam = scene.add.graphics().setDepth(5);
  }

  const g     = rt.beam;
  const angle = scene.weaponAngle;
  const px    = scene.player.x;
  const py    = scene.player.y;
  const len   = 600;
  const ex    = px + Math.cos(angle) * len;
  const ey    = py + Math.sin(angle) * len;

  g.clear();
  // Halo externe
  g.lineStyle(8, 0x00ff88, 0.12);
  g.lineBetween(px, py, ex, ey);
  // Halo intermédiaire
  g.lineStyle(4, 0x00ff88, 0.3);
  g.lineBetween(px, py, ex, ey);
  // Cœur blanc
  g.lineStyle(2, 0xffffff, 0.9);
  g.lineBetween(px, py, ex, ey);

  rt.firing = true;
}

export function stopLaserBeam(scene) {
  const rt = scene.moduleRuntime?.laser;
  if (!rt?.beam) return;
  rt.beam.clear();
  rt.firing = false;
}

// ── Fonctions de tir ──────────────────────────────────────────
function fireBasic(scene, config) {
  createBulletFromAngle(scene, scene.weaponAngle, {
    muzzleDistance:  28,
    speedMultiplier: config.bulletSpeedMultiplier || 1,
    damage: 1,
  });
}

function fireSpread(scene, config) {
  const baseAngle = scene.weaponAngle;
  (config.angles || [-0.12, 0.12]).forEach(offset => {
    createBulletFromAngle(scene, baseAngle + offset, {
      muzzleDistance:  28,
      speedMultiplier: config.bulletSpeedMultiplier || 1,
      damage:          config.damage || 0.8,
      pierceOverride:  config.pierceOverride,
    });
  });
}

function fireSideDouble(scene, config) {
  const baseAngle = scene.weaponAngle;
  (config.sideOffsets || [-10, 10]).forEach(sideOffset => {
    createBulletFromAngle(scene, baseAngle, {
      muzzleDistance:  24,
      sideOffset,
      speedMultiplier: config.bulletSpeedMultiplier || 1,
      damage:          config.damage || 0.45,
      pierceOverride:  config.pierceOverride,
    });
  });
}

export function createBulletFromAngle(scene, angle, options = {}) {
  const muzzleDistance = options.muzzleDistance ?? 28;
  const sideOffset     = options.sideOffset     ?? 0;
  const speedMultiplier = options.speedMultiplier ?? 1;
  const damage          = options.damage         ?? 1;
  const pierceOverride  = options.pierceOverride;

  const perpX  = -Math.sin(angle);
  const perpY  =  Math.cos(angle);
  const spawnX = scene.player.x + Math.cos(angle) * muzzleDistance + perpX * sideOffset;
  const spawnY = scene.player.y + Math.sin(angle) * muzzleDistance + perpY * sideOffset;

  const bullet = scene.add.container(spawnX, spawnY);
  bullet.rotation = angle;
  if (damage < 1) bullet.setScale(0.8);

  const glow = scene.add.ellipse(0, 0, 22, 10, 0x38bdf8, 0.28);
  const core = scene.add.rectangle(0, 0, 16, 4, 0xffffff).setStrokeStyle(1, 0x7dd3fc, 0.95);
  const tail = scene.add.rectangle(-8, 0, 10, 2, 0x93c5fd, 0.5);
  bullet.add([glow, tail, core]);

  scene.physics.add.existing(bullet);
  bullet.body.setAllowGravity(false);
  bullet.body.setEnable(false);

  bullet.vx              = Math.cos(angle) * scene.bulletSpeed * speedMultiplier;
  bullet.vy              = Math.sin(angle) * scene.bulletSpeed * speedMultiplier;
  bullet.trailTimer      = 0;
  bullet.damage          = damage * (scene.bulletDamageMultiplier || 1);
  bullet.remainingPierce = pierceOverride ?? scene.bulletPierce;
  bullet.hitEnemies      = new Set();

  scene.bullets.add(bullet);

  if (scene.weaponFlash) {
    scene.weaponFlash.x = spawnX;
    scene.weaponFlash.y = spawnY;
    scene.weaponFlash.setFillStyle(0xe0f2fe, 0.95);
    scene.weaponFlash.setAlpha(0.9).setScale(1.4);
    scene.tweens.add({
      targets: scene.weaponFlash, alpha: 0, scale: 0.4, duration: 100, ease: 'Quad.Out',
    });
  }
}
