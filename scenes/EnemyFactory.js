// EnemyFactory.js
import { getEnemyTypeForLevel, getDifficultyParams } from '../config/DifficultyConfig.js';

// Re-export pour que SurvivalScene puisse importer depuis EnemyFactory comme avant
export { getEnemyTypeForLevel };

// ============================================================
//  EnemyFactory.js — Ennemis v2
//  Nouveaux types :
//    · shooter   — reste à distance, tire des projectiles
//    · kamikaze  — fonce droit, accélère au contact, explose
//    · swarm     — arrive en escouade de 5, petit et rapide
// ============================================================

// ── Profils ────────────────────────────────────────────────────
export function getEnemyProfile(type) {
  const profiles = {
    basic: {
      radius: 16, color: 0xef4444,
      speed: 92,  hp: 2, damage: 10, score: 1, scale: 0.92,
    },
    fast: {
      radius: 12, color: 0xfb7185,
      speed: 145, hp: 1, damage: 8, score: 1, scale: 0.82,
    },
    tank: {
      radius: 22, color: 0xb91c1c,
      speed: 62,  hp: 5, damage: 18, score: 3, scale: 1.05,
    },
    zigzag: {
      radius: 15, color: 0xf97316,
      speed: 108, hp: 2, damage: 10, score: 2, scale: 0.88,
      zigzagAmplitude: 1.35, zigzagFrequency: 0.006,
    },

    // ── NOUVEAUX ──────────────────────────────────────────────
    shooter: {
      radius: 14, color: 0x38bdf8,
      speed: 55,  hp: 2, damage: 6, score: 2, scale: 0.95,
      // S'arrête à ~220px du joueur et tire toutes les 1.4s
      preferredRange:   240,
      shootCooldownMs:  2800,
    },
    kamikaze: {
      radius: 13, color: 0xff6600,
      speed: 88,  hp: 1, damage: 22, score: 2, scale: 0.92,
      // Accélère brutalement sous 160px
      chargeSpeed:    340,
      chargeRange:    160,
      // Explose en AoE au contact
      explosionRadius: 80,
    },
    swarm: {
      radius: 9,  color: 0xa855f7,
      speed: 130, hp: 1, damage: 6, score: 1, scale: 0.68,
    },
    boss: {
      radius: 44, color: 0x7f1d1d,
      speed: 38,  hp: 70, damage: 25, score: 25, scale: 1.45,
      spawnCooldown: 0,  // géré par BossSystem
    },
  };
  return profiles[type] || profiles.basic;
}



// ── Spawn générique ────────────────────────────────────────────
export function spawnEnemyOfType(scene, type, x, y, time) {
  // Swarm se spawne toujours en groupe
  if (type === 'swarm') return spawnSwarm(scene, x, y, time);

  const profile = getEnemyProfile(type);
  const enemy   = scene.add.circle(x, y, profile.radius, profile.color, 0.01);
  scene.physics.add.existing(enemy);

  enemy.body.setAllowGravity(false);
  enemy.body.setEnable(false);

  enemy.enemyType         = type;
  enemy.hp                = profile.hp;
  enemy.maxHp             = profile.hp;
  enemy.damage            = profile.damage;
  enemy.speed             = profile.speed;
  enemy.scoreValue        = profile.score;
  enemy.collisionRadius   = profile.radius;
  enemy.spawnTime         = time || 0;
  enemy.spawnCooldown     = profile.spawnCooldown     || 0;
  enemy.lastSpawnTime     = 0;
  enemy.zigzagAmplitude   = profile.zigzagAmplitude   || 0;
  enemy.zigzagFrequency   = profile.zigzagFrequency   || 0;

  // Shooter
  enemy.preferredRange    = profile.preferredRange    || 0;
  enemy.shootCooldownMs   = profile.shootCooldownMs   || 0;
  enemy.lastShootTime     = -(profile.shootCooldownMs || 0); // peut tirer dès l'apparition

  // Kamikaze
  enemy.chargeSpeed       = profile.chargeSpeed       || 0;
  enemy.chargeRange       = profile.chargeRange       || 0;
  enemy.explosionRadius   = profile.explosionRadius   || 0;
  enemy.isCharging        = false;

  enemy.visual = scene.createEnemyVisual(type, x, y);
  if (enemy.visual) {
    enemy.visual.setScale(profile.scale || 1);
    enemy.baseScaleX = enemy.visual.scaleX;
    enemy.baseScaleY = enemy.visual.scaleY;
  }

  scene.enemies.add(enemy);
  return enemy;
}

// ── Spawn d'une escouade swarm ─────────────────────────────────
export function spawnSwarm(scene, x, y, time) {
  const count = 5;
  const spawned = [];
  for (let i = 0; i < count; i++) {
    // Dispersion en V autour du point d'entrée
    const offsetX = Phaser.Math.Between(-40, 40);
    const offsetY = Phaser.Math.Between(-40, 40);
    const e = _spawnSingle(scene, 'swarm', x + offsetX, y + offsetY, time);
    spawned.push(e);
  }
  return spawned;
}

function _spawnSingle(scene, type, x, y, time) {
  const profile = getEnemyProfile(type);
  const enemy   = scene.add.circle(x, y, profile.radius, profile.color, 0.01);
  scene.physics.add.existing(enemy);
  enemy.body.setAllowGravity(false);
  enemy.body.setEnable(false);
  enemy.enemyType       = type;
  enemy.hp              = profile.hp;
  enemy.maxHp           = profile.hp;
  enemy.damage          = profile.damage;
  enemy.speed           = profile.speed;
  enemy.scoreValue      = profile.score;
  enemy.collisionRadius = profile.radius;
  enemy.spawnTime       = time || 0;
  enemy.spawnCooldown   = 0;
  enemy.lastSpawnTime   = 0;
  enemy.zigzagAmplitude = 0;
  enemy.zigzagFrequency = 0;
  enemy.preferredRange  = 0;
  enemy.shootCooldownMs = 0;
  enemy.lastShootTime   = 0;
  enemy.chargeSpeed     = 0;
  enemy.chargeRange     = 0;
  enemy.explosionRadius = 0;
  enemy.isCharging      = false;

  enemy.visual = scene.createEnemyVisual(type, x, y);
  if (enemy.visual) {
    enemy.visual.setScale(profile.scale || 1);
    enemy.baseScaleX = enemy.visual.scaleX;
    enemy.baseScaleY = enemy.visual.scaleY;
  }
  scene.enemies.add(enemy);
  return enemy;
}

export function spawnBoss(scene, x, y, time) {
  return spawnEnemyOfType(scene, 'boss', x, y, time);
}

// ── Mouvement de tous les ennemis ─────────────────────────────
export function moveEnemies(scene, time) {
  scene.enemies.getChildren().forEach((enemy) => {
    if (!enemy.active || enemy.isDying) return;

    const dist = Phaser.Math.Distance.Between(
      enemy.x, enemy.y, scene.player.x, scene.player.y
    );
    const angleToPlayer = Phaser.Math.Angle.Between(
      enemy.x, enemy.y, scene.player.x, scene.player.y
    );

    let moveAngle = angleToPlayer;
    let speed     = enemy.speed || 80;

    // ── BASIC / TANK / FAST : fonce droit ─────────────────
    // (comportement par défaut — rien à modifier)

    // ── ZIGZAG ────────────────────────────────────────────
    if (enemy.enemyType === 'zigzag') {
      const phase = time * (enemy.zigzagFrequency || 0.006);
      moveAngle += Math.sin(phase) * (enemy.zigzagAmplitude || 1.2) * 0.35;
    }

    // ── SHOOTER — s'arrête à portée, recule si trop proche ─
    if (enemy.enemyType === 'shooter') {
      const range = enemy.preferredRange || 220;
      if (dist < range * 0.7) {
        // Trop proche → recule
        moveAngle += Math.PI;
        speed = enemy.speed * 0.7;
      } else if (dist < range) {
        // Dans la zone → stafe latéralement
        moveAngle += Math.PI / 2;
        speed = enemy.speed * 0.4;
      }
      // Sinon approche normalement
      _tryShoot(scene, enemy, time, angleToPlayer);
    }

    // ── KAMIKAZE — accélère en charge sous chargeRange ─────
    if (enemy.enemyType === 'kamikaze') {
      if (dist < (enemy.chargeRange || 160)) {
        if (!enemy.isCharging) {
          enemy.isCharging = true;
          // Effet visuel : teinte orange vif au moment de la charge
          if (enemy.visual?.active) {
            enemy.visual.setTintFill(0xff8800);
            scene.time.delayedCall(120, () => {
              enemy.visual?.active && enemy.visual.clearTint();
            });
          }
        }
        speed = enemy.chargeSpeed || 340;
      } else {
        enemy.isCharging = false;
      }
    }

    // ── SWARM — légère oscillation pour look organique ────
    if (enemy.enemyType === 'swarm') {
      const wobble = Math.sin(time * 0.008 + enemy.x * 0.01) * 0.4;
      moveAngle += wobble;
    }

    // ── BOSS — mouvement et phases gérés par BossSystem ──
    if (enemy.enemyType === 'boss') {
      return;  // BossSystem s'occupe du déplacement
    }

    // ── Déplacement ────────────────────────────────────────
    const dt = 1 / 60; // on utilise un delta fixe léger (moveEnemies appelé à chaque frame)
    enemy.x += Math.cos(moveAngle) * speed * dt;
    enemy.y += Math.sin(moveAngle) * speed * dt;

    if (enemy.visual?.active) {
      enemy.visual.x        = enemy.x;
      enemy.visual.y        = enemy.y;
      enemy.visual.rotation = angleToPlayer + Math.PI / 2;
    }
  });
}

// ── Tir du shooter ────────────────────────────────────────────
function _tryShoot(scene, enemy, time, angleToPlayer) {
  if (!scene.enemyProjectiles) return;
  if (time - enemy.lastShootTime < enemy.shootCooldownMs) return;

  enemy.lastShootTime = time;

  // Projectile cyan
  const proj = scene.add.circle(enemy.x, enemy.y, 5, 0x38bdf8, 0.95);
  proj.setDepth(3);
  scene.physics.add.existing(proj);
  proj.body.setAllowGravity(false);

  const speed = 260;
  proj.vx     = Math.cos(angleToPlayer) * speed;
  proj.vy     = Math.sin(angleToPlayer) * speed;
  proj.damage = enemy.damage || 6;
  proj.life   = 3000; // 3s avant autodestruct
  proj.radius = 5;
  proj.trailTimer = 0;

  // Halo autour du projectile
  const halo = scene.add.circle(enemy.x, enemy.y, 12, 0x38bdf8, 0.15).setDepth(2);
  proj._halo = halo;

  scene.enemyProjectiles.add(proj);

  // Flash sur le shooter au moment du tir
  if (enemy.visual?.active) {
    enemy.visual.setTintFill(0x00ffff);
    scene.time.delayedCall(80, () => {
      enemy.visual?.active && enemy.visual.clearTint();
    });
  }

  // Muzzle flash
  const muzzle = scene.add.circle(enemy.x, enemy.y, 10, 0xffffff, 0.8).setDepth(4);
  scene.tweens.add({
    targets: muzzle, scale: 2, alpha: 0, duration: 120,
    onComplete: () => muzzle.destroy(),
  });
}

// ── Explosion kamikaze (appelée depuis SurvivalScene) ─────────
export function triggerKamikazeExplosion(scene, enemy) {
  if (!enemy.active || enemy.isDying) return;
  const { x, y } = enemy;
  const radius   = enemy.explosionRadius || 80;

  // Onde de choc
  const wave = scene.add.circle(x, y, 10, 0xff6600, 0.5).setDepth(890);
  scene.tweens.add({
    targets: wave, scaleX: radius / 5, scaleY: radius / 5, alpha: 0,
    duration: 320, ease: 'Quad.Out', onComplete: () => wave.destroy(),
  });

  // Flash
  const flash = scene.add.circle(x, y, 16, 0xffffff, 0.9).setDepth(900);
  scene.tweens.add({
    targets: flash, scale: 3, alpha: 0, duration: 150,
    onComplete: () => flash.destroy(),
  });

  // Dégâts en zone sur le joueur
  const distToPlayer = Phaser.Math.Distance.Between(x, y, scene.player.x, scene.player.y);
  if (distToPlayer < radius && scene.playerLife > 0) {
    const falloff = 1 - distToPlayer / radius;
    const dmg     = Math.round(enemy.damage * falloff);
    if (dmg > 0) {
      scene.playerLife = Math.max(0, scene.playerLife - dmg);
      // Importer triggerPlayerHitEffect depuis GameFeel si disponible
      scene._triggerPlayerHit?.(dmg);
    }
  }

  scene.cameras.main.shake(100, 0.004);
}
