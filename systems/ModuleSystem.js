// ============================================================
//  ModuleSystem.js — Système de modules du vaisseau
//
//  3 slots :
//    slot 0 — arme avant   (WEAPON)
//    slot 1 — module gauche (SUPPORT)
//    slot 2 — module droit  (SUPPORT)
//
//  Appeler dans SurvivalScene.create() :
//    initModules(this)
//
//  Appeler dans SurvivalScene.update() :
//    tickModules(this, time, delta)
// ============================================================

// ─────────────────────────────────────────────────────────────
//  CATALOGUE COMPLET DES MODULES
// ─────────────────────────────────────────────────────────────
export const MODULE_CATALOG = {

  // ── ARMES (slot 0) ────────────────────────────────────────
  basic: {
    id:       'basic',
    name:     'Canon basique',
    type:     'weapon',
    slot:     'weapon',
    tier:     0,
    cost:     0,
    desc:     'Tir unique droit.\nGratuit et fiable.',
    icon:     'weapon-basic-gun',
    color:    0x38bdf8,
  },
  spread: {
    id:       'spread',
    name:     'Canon Spread',
    type:     'weapon',
    slot:     'weapon',
    tier:     1,
    cost:     120,
    desc:     'Deux tirs en cône.\nCouvre plus de terrain.',
    icon:     'weapon_spread',
    color:    0x2563eb,
  },
  double: {
    id:       'double',
    name:     'Canon Double',
    type:     'weapon',
    slot:     'weapon',
    tier:     1,
    cost:     150,
    desc:     'Deux tirs parallèles\nplus rapides.',
    icon:     'weapon_double',
    color:    0x7c3aed,
  },
  laser: {
    id:       'laser',
    name:     'Laser continu',
    type:     'weapon',
    slot:     'weapon',
    tier:     2,
    cost:     320,
    desc:     'Rayon continu qui perce\ntous les ennemis.',
    icon:     null,   // dessiné procéduralement
    color:    0x00ff88,
  },

  // ── MODULES LATÉRAUX (slots 1 & 2) ───────────────────────
  turret: {
    id:       'turret',
    name:     'Tourelle auto',
    type:     'support',
    slot:     'support',
    tier:     2,
    cost:     220,
    desc:     'Tir automatique vers\nl\'ennemi le plus proche.',
    icon:     null,
    color:    0xf59e0b,
    // Paramètres runtime
    fireCooldownMs: 800,
    damage:         0.6,
    range:          300,
  },
  rear_gun: {
    id:       'rear_gun',
    name:     'Canon arrière',
    type:     'support',
    slot:     'support',
    tier:     1,
    cost:     110,
    desc:     'Tire vers l\'arrière\nen même temps que l\'arme principale.',
    icon:     null,
    color:    0xef4444,
    damage:   0.7,
  },
  shield: {
    id:       'shield',
    name:     'Bouclier',
    type:     'support',
    slot:     'support',
    tier:     2,
    cost:     160,
    desc:     'Absorbe 1 hit complet\ntoutes les 8 secondes.',
    icon:     null,
    color:    0x06b6d4,
    rechargeSec: 8,
  },
  regen: {
    id:       'regen',
    name:     'Nanoréparateurs',
    type:     'support',
    slot:     'support',
    tier:     1,
    cost:     200,
    desc:     '+1 HP toutes les\n3 secondes.',
    icon:     null,
    color:    0x22c55e,
    regenSec: 3,
    regenHp:  1,
  },
  magnet: {
    id:       'magnet',
    name:     'Aimant à pièces',
    type:     'support',
    slot:     'support',
    tier:     1,
    cost:     140,
    desc:     'Rayon de collecte\nde pièces x2.5.',
    icon:     null,
    color:    0xf5a623,
    magnetMultiplier: 2.5,
  },
};

// ─────────────────────────────────────────────────────────────
//  ÉTAT PAR DÉFAUT
// ─────────────────────────────────────────────────────────────
export function createDefaultModuleState() {
  return {
    owned: ['basic'],
    slots: ['basic', null, null, null],  // [weapon, left, right, rear]
  };
}

export function sanitizeModuleState(raw) {
  if (!raw || typeof raw !== 'object') return createDefaultModuleState();
  const owned = Array.isArray(raw.owned)
    ? raw.owned.filter(id => MODULE_CATALOG[id])
    : ['basic'];
  if (!owned.includes('basic')) owned.unshift('basic');

  const slots = Array.isArray(raw.slots) ? raw.slots : ['basic', null, null];
  const safeSlots = [
    slots[0] && MODULE_CATALOG[slots[0]] ? slots[0] : 'basic',
    slots[1] && MODULE_CATALOG[slots[1]] ? slots[1] : null,
    slots[2] && MODULE_CATALOG[slots[2]] ? slots[2] : null,
    slots[3] && MODULE_CATALOG[slots[3]] ? slots[3] : null,
  ];
  return { owned, slots: safeSlots };
}

// ─────────────────────────────────────────────────────────────
//  INIT — appelé dans create()
// ─────────────────────────────────────────────────────────────
export function initModules(scene) {
  const state = scene.moduleState || createDefaultModuleState();
  scene.moduleState = sanitizeModuleState(state);

  // État runtime des modules actifs
  scene.moduleRuntime = {
    shield: {
      active:      scene.moduleState.slots.includes('shield'),
      charged:     true,
      chargeTimer: 0,
    },
    regen: {
      active:  scene.moduleState.slots.includes('regen'),
      timer:   0,
    },
    turret: {
      active:     scene.moduleState.slots.some(s => s === 'turret'),
      count:      scene.moduleState.slots.filter(s => s === 'turret').length,
      lastFire:   [0, 0],  // un timer par tourelle
    },
    magnet: {
      active:     scene.moduleState.slots.includes('magnet'),
      multiplier: 2.5,
    },
    rear_gun: {
      active: scene.moduleState.slots.includes('rear_gun') || scene.moduleState.slots[3] === 'rear_gun',
    },
    laser: {
      active:  scene.moduleState.slots[0] === 'laser',
      beam:    null,  // objet Graphics du rayon
      firing:  false,
    },
  };

  // Appliquer l'aimant immédiatement
  if (scene.moduleRuntime.magnet.active) {
    scene.coinMagnetRadius = (scene.coinMagnetRadius || 140) * 2.5;
  }

  // Construire les visuels des tourelles sur le vaisseau
  _buildTurretVisuals(scene);
  _buildShieldVisual(scene);
}

// ─────────────────────────────────────────────────────────────
//  TICK — appelé dans update()
// ─────────────────────────────────────────────────────────────
export function tickModules(scene, time, delta) {
  const rt = scene.moduleRuntime;
  if (!rt) return;

  // ── Régén ──────────────────────────────────────────────────
  if (rt.regen.active) {
    rt.regen.timer += delta;
    const cfg = MODULE_CATALOG.regen;
    if (rt.regen.timer >= cfg.regenSec * 1000) {
      rt.regen.timer = 0;
      const max = scene.maxPlayerLife || 100;
      if (scene.playerLife < max) {
        scene.playerLife = Math.min(max, scene.playerLife + cfg.regenHp);
        _showRegenPop(scene);
      }
    }
  }

  // ── Bouclier — recharge ────────────────────────────────────
  if (rt.shield.active && !rt.shield.charged) {
    rt.shield.chargeTimer += delta;
    const rechargMs = MODULE_CATALOG.shield.rechargeSec * 1000;
    if (rt.shield.chargeTimer >= rechargMs) {
      rt.shield.charged = true;
      rt.shield.chargeTimer = 0;
      _pulseShieldVisual(scene, true);
    } else {
      // Mise à jour arc de recharge
      _updateShieldArc(scene, rt.shield.chargeTimer / rechargMs);
    }
  }

  // ── Tourelles ─────────────────────────────────────────────
  if (rt.turret.active) {
    _tickTurrets(scene, time);
  }

  // ── Laser ─────────────────────────────────────────────────
  if (rt.laser.active) {
    _tickLaser(scene, time, delta);
  }
}

// ─────────────────────────────────────────────────────────────
//  BOUCLIER — intercepte les dégâts
//  Retourne true si le hit est absorbé
// ─────────────────────────────────────────────────────────────
export function tryShieldAbsorb(scene) {
  const rt = scene.moduleRuntime;
  if (!rt?.shield.active || !rt.shield.charged) return false;

  rt.shield.charged = false;
  rt.shield.chargeTimer = 0;
  _pulseShieldVisual(scene, false);  // effet de bris
  return true;
}

// ─────────────────────────────────────────────────────────────
//  TIR ARRIÈRE — appelé depuis WeaponSystem après chaque tir
// ─────────────────────────────────────────────────────────────
export function fireRearGun(scene) {
  const rt = scene.moduleRuntime;
  if (!rt?.rear_gun.active) return;

  const rearAngle = scene.weaponAngle + Math.PI;  // opposé
  _createModuleBullet(scene, rearAngle, {
    damage:   MODULE_CATALOG.rear_gun.damage,
    color:    0xff6644,
    speed:    0.85,
    offset:   -22,
  });
}

// ─────────────────────────────────────────────────────────────
//  INTERNES — Tourelles
// ─────────────────────────────────────────────────────────────
function _tickTurrets(scene, time) {
  const rt  = scene.moduleRuntime;
  const cfg = MODULE_CATALOG.turret;

  // Trouver l'ennemi le plus proche dans la portée
  const enemies  = scene.enemies?.getChildren() || [];
  const player   = scene.player;

  // Trier par distance
  const inRange = enemies
    .filter(e => e.active && !e.isDying)
    .map(e => ({
      e,
      dist: Phaser.Math.Distance.Between(player.x, player.y, e.x, e.y),
    }))
    .filter(({ dist }) => dist <= cfg.range)
    .sort((a, b) => a.dist - b.dist);

  // Chaque tourelle tire sur la cible
  for (let i = 0; i < rt.turret.count; i++) {
    if (time - rt.turret.lastFire[i] < cfg.fireCooldownMs) continue;
    const target = inRange[i] || inRange[0];
    if (!target) continue;

    rt.turret.lastFire[i] = time;
    const angle = Phaser.Math.Angle.Between(
      player.x, player.y, target.e.x, target.e.y
    );
    const sideOffset = i === 0 ? -20 : 20;
    _createModuleBullet(scene, angle, {
      damage:     cfg.damage,
      color:      0xfbbf24,
      speed:      0.9,
      sideOffset,
    });
    _flashTurret(scene, i);
  }
}

function _createModuleBullet(scene, angle, opts = {}) {
  const { damage = 0.5, color = 0xffd700, speed = 0.9, offset = 20, sideOffset = 0 } = opts;

  const perpX = -Math.sin(angle);
  const perpY =  Math.cos(angle);
  const spawnX = scene.player.x + Math.cos(angle) * offset + perpX * sideOffset;
  const spawnY = scene.player.y + Math.sin(angle) * offset + perpY * sideOffset;

  const bullet = scene.add.container(spawnX, spawnY);
  bullet.rotation = angle;

  const glow = scene.add.ellipse(0, 0, 18, 8, color, 0.3);
  const core = scene.add.rectangle(0, 0, 12, 3, color, 1);
  bullet.add([glow, core]);

  scene.physics.add.existing(bullet);
  bullet.body.setAllowGravity(false);
  bullet.body.setEnable(false);

  bullet.vx = Math.cos(angle) * scene.bulletSpeed * speed;
  bullet.vy = Math.sin(angle) * scene.bulletSpeed * speed;
  bullet.trailTimer   = 0;
  bullet.damage       = damage;
  bullet.remainingPierce = 0;
  bullet.hitEnemies   = new Set();

  scene.bullets.add(bullet);
}

// ─────────────────────────────────────────────────────────────
//  INTERNES — Laser
// ─────────────────────────────────────────────────────────────
function _tickLaser(scene, time, delta) {
  const rt = scene.moduleRuntime;
  // Le laser est géré par WeaponSystem — ici on gère juste les dégâts continus
  if (!rt.laser.beam?.active) return;

  // Dégâts continus sur les ennemis dans le rayon
  const angle   = scene.weaponAngle;
  const px      = scene.player.x;
  const py      = scene.player.y;
  const maxLen  = 600;

  scene.enemies?.getChildren().forEach(enemy => {
    if (!enemy.active || enemy.isDying) return;

    // Projection de l'ennemi sur l'axe du laser
    const dx = enemy.x - px;
    const dy = enemy.y - py;
    const dot = dx * Math.cos(angle) + dy * Math.sin(angle);
    if (dot < 0 || dot > maxLen) return;

    // Distance perpendiculaire au laser
    const perpDist = Math.abs(dx * Math.sin(angle) - dy * Math.cos(angle));
    if (perpDist > 14) return;

    // Dégâts par frame (0.08/frame ≈ ~5 DPS à 60fps)
    enemy.hp -= 0.08;
    if (enemy.hp <= 0) scene.killEnemy?.(enemy, null);
  });
}

// ─────────────────────────────────────────────────────────────
//  INTERNES — Visuels
// ─────────────────────────────────────────────────────────────
function _buildTurretVisuals(scene) {
  const rt    = scene.moduleRuntime;
  const slots = scene.moduleState.slots;
  scene._turretVisuals = [];

  const offsets = [{ x: -22, y: 4 }, { x: 22, y: 4 }];
  let tIdx = 0;
  slots.forEach((id, slotIdx) => {
    if (id !== 'turret' || slotIdx === 0) return;
    const off = offsets[tIdx++] || offsets[0];
    const g = scene.add.graphics().setDepth(3);
    _drawTurret(g, off.x, off.y, false);
    scene._turretVisuals.push({ g, off, flashing: false });
  });
}

function _drawTurret(g, ox, oy, flashing) {
  g.clear();
  const color = flashing ? 0xffffff : 0xfbbf24;
  // Base de la tourelle
  g.fillStyle(0x1a3052, 0.9);
  g.fillRoundedRect(ox - 6, oy - 5, 12, 10, 3);
  // Canon
  g.fillStyle(color, 0.9);
  g.fillRect(ox - 1, oy - 8, 3, 8);
  // Halo
  g.fillStyle(0xfbbf24, 0.2);
  g.fillCircle(ox, oy, 8);
}

function _flashTurret(scene, idx) {
  const tv = scene._turretVisuals?.[idx];
  if (!tv) return;
  tv.flashing = true;
  _drawTurret(tv.g, tv.off.x, tv.off.y, true);
  scene.time.delayedCall(80, () => {
    tv.flashing = false;
    _drawTurret(tv.g, tv.off.x, tv.off.y, false);
  });
}

function _buildShieldVisual(scene) {
  const rt = scene.moduleRuntime;
  if (!rt.shield.active) return;

  scene._shieldVisual = scene.add.graphics().setDepth(1).setAlpha(0.6);
  _drawShieldArc(scene._shieldVisual, 1);
}

function _drawShieldArc(g, progress) {
  g.clear();
  // Anneau complet si chargé
  const alpha = progress >= 1 ? 0.35 : 0.15;
  g.lineStyle(2, 0x06b6d4, alpha);
  g.strokeCircle(0, 0, 28);
  // Arc de recharge
  if (progress < 1) {
    g.lineStyle(2, 0x06b6d4, 0.7);
    g.beginPath();
    const start = -Math.PI / 2;
    const end   = start + Math.PI * 2 * progress;
    g.arc(0, 0, 28, start, end, false);
    g.strokePath();
  }
}

function _updateShieldArc(scene, progress) {
  if (!scene._shieldVisual) return;
  _drawShieldArc(scene._shieldVisual, progress);
}

function _pulseShieldVisual(scene, recharging) {
  if (!scene._shieldVisual) return;
  if (!recharging) {
    // Bris du bouclier — flash puis s'estompe
    scene._shieldVisual.setAlpha(1);
    scene.tweens.add({
      targets: scene._shieldVisual, alpha: 0.15, duration: 400, ease: 'Quad.Out',
    });
  } else {
    // Bouclier rechargé — pulse cyan
    scene.tweens.add({
      targets: scene._shieldVisual, alpha: 0.8, duration: 200,
      yoyo: true, onComplete: () => scene._shieldVisual?.setAlpha(0.6),
    });
  }
}

function _showRegenPop(scene) {
  const t = scene.add.text(scene.player.x, scene.player.y - 20, '+1', {
    fontFamily: '"Courier New", monospace', fontStyle: 'bold',
    fontSize: '14px', color: '#22c55e',
  }).setOrigin(0.5).setDepth(1000);
  scene.tweens.add({
    targets: t, y: t.y - 30, alpha: 0, duration: 700, ease: 'Quad.Out',
    onComplete: () => t.destroy(),
  });
}

// ─────────────────────────────────────────────────────────────
//  SYNC VISUEL — appeler dans update() pour suivre le joueur
// ─────────────────────────────────────────────────────────────
export function syncModuleVisuals(scene) {
  const px = scene.player?.x;
  const py = scene.player?.y;
  if (px == null) return;

  // Tourelles suivent le joueur
  scene._turretVisuals?.forEach(({ g }) => {
    g.x = px; g.y = py;
  });

  // Bouclier suit le joueur
  if (scene._shieldVisual) {
    scene._shieldVisual.x = px;
    scene._shieldVisual.y = py;
  }
}
