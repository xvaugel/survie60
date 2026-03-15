export function getEnemyProfile(type) {
  const profiles = {
    normal: { radius: 12, color: 0xef4444, hp: 2, speedMultiplier: 1, damage: 10, isRanged: false },
    fast: { radius: 9, color: 0xf97316, hp: 1, speedMultiplier: 1.33, damage: 5, isRanged: false },
    shooter: {
      radius: 11,
      color: 0x38bdf8,
      hp: 2,
      speedMultiplier: 0.6,
      damage: 8,
      isRanged: true,
      preferredMinDistance: 180,
      preferredMaxDistance: 260,
      shootDelay: 2000,
      projectileSpeed: 220,
    },
    tank: { radius: 16, color: 0x8b5cf6, hp: 5, speedMultiplier: 0.55, damage: 15, isRanged: false },
    boss: {
      radius: 40,
      color: 0xdc2626,
      hp: 220,
      speedMultiplier: 0.35,
      damage: 20,
      isRanged: true,
      preferredMinDistance: 220,
      preferredMaxDistance: 340,
      shootDelay: 1400,
      projectileSpeed: 260,
    },
  };

  return profiles[type] || profiles.normal;
}

export function getEnemyTypeForLevel(level) {
  const r = Math.random();

  if (level === 1) return 'normal';
  if (level === 2) return 'normal';
  if (level === 3) return r < 0.15 ? 'fast' : 'normal';
  if (level === 4) return r < 0.25 ? 'fast' : 'normal';

  if (level <= 6) {
    if (r < 0.15) return 'tank';
    if (r < 0.35) return 'fast';
    return 'normal';
  }

  if (level <= 8) {
    if (r < 0.12) return 'shooter';
    if (r < 0.28) return 'tank';
    if (r < 0.48) return 'fast';
    return 'normal';
  }

  if (r < 0.16) return 'shooter';
  if (r < 0.34) return 'tank';
  if (r < 0.56) return 'fast';
  return 'normal';
}

export function spawnEnemyOfType(scene, type, x, y, time) {
  const profile = getEnemyProfile(type);
  const enemy = scene.add.circle(x, y, profile.radius, profile.color, 0.01);

  enemy.collisionRadius = profile.radius;
  enemy.visual = scene.createEnemyVisual(type, x, y, profile.color);
  enemy.type = type;
  enemy.hp = profile.hp;
  enemy.maxHp = profile.hp;
  enemy.enemySpeed = scene.enemySpeed * profile.speedMultiplier;
  enemy.damage = profile.damage;
  enemy.isRanged = !!profile.isRanged;
  enemy.preferredMinDistance = profile.preferredMinDistance || 0;
  enemy.preferredMaxDistance = profile.preferredMaxDistance || 0;
  enemy.shootDelay = profile.shootDelay || 0;
  enemy.projectileSpeed = profile.projectileSpeed || 0;
  enemy.lastShotTime = time || 0;

  scene.physics.add.existing(enemy);
  enemy.body.setAllowGravity(false);
  enemy.body.setImmovable(true);
  scene.enemies.add(enemy);
  return enemy;
}

export function spawnBoss(scene) {
  const boss = spawnEnemyOfType(scene, 'boss', scene.centerX, 120, scene.time.now);
  boss.body.setVelocity(0, 0);
  boss.bossReward = 25;

  scene.bossBarBg = scene.add.rectangle(scene.centerX, 70, 420, 24, 0x000000, 0.75)
    .setStrokeStyle(2, 0xffffff, 0.15)
    .setDepth(1000);
  scene.bossBarFill = scene.add.rectangle(scene.centerX - 210, 70, 420, 18, 0xdc2626, 0.9)
    .setOrigin(0, 0.5)
    .setDepth(1001);
  scene.bossLabel = scene.add.text(scene.centerX, 42, `BOSS - Niveau ${scene.currentLevel}`, {
    fontSize: '22px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(1001);

  return boss;
}

export function updateBossUI(scene) {
  if (!scene.bossSpawned || !scene.bossBarFill) return;

  const boss = scene.enemies.getChildren().find((enemy) => enemy.active && enemy.type === 'boss' && !enemy.isDying);
  if (!boss) {
    scene.bossBarBg?.destroy();
    scene.bossBarFill?.destroy();
    scene.bossLabel?.destroy();
    scene.bossBarBg = null;
    scene.bossBarFill = null;
    scene.bossLabel = null;
    return;
  }

  const ratio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
  scene.bossBarFill.width = 420 * ratio;
}

export function fireEnemyProjectile(scene, enemy, angle) {
  const spawnDistance = enemy.collisionRadius + 10;
  const px = enemy.x + Math.cos(angle) * spawnDistance;
  const py = enemy.y + Math.sin(angle) * spawnDistance;

  const projectile = scene.add.circle(px, py, enemy.type === 'boss' ? 7 : 5, 0x7dd3fc);
  projectile.setStrokeStyle(1, 0xe0f2fe, 0.9);
  projectile.damage = enemy.damage;
  projectile.vx = Math.cos(angle) * enemy.projectileSpeed;
  projectile.vy = Math.sin(angle) * enemy.projectileSpeed;
  projectile.life = enemy.type === 'boss' ? 4500 : 3500;
  projectile.trailTimer = 0;

  scene.physics.add.existing(projectile);
  projectile.body.setAllowGravity(false);
  projectile.body.setEnable(false);
  scene.enemyProjectiles.add(projectile);
}

export function moveEnemies(scene, time) {
  scene.enemies.getChildren().forEach((enemy) => {
    if (!enemy.active || !enemy.body || enemy.isDying) return;

    const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, scene.player.x, scene.player.y);
    const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, scene.player.x, scene.player.y);

    if (enemy.isRanged) {
      if (distanceToPlayer > enemy.preferredMaxDistance) {
        enemy.body.setVelocity(Math.cos(angleToPlayer) * enemy.enemySpeed, Math.sin(angleToPlayer) * enemy.enemySpeed);
      } else if (distanceToPlayer < enemy.preferredMinDistance) {
        enemy.body.setVelocity(-Math.cos(angleToPlayer) * enemy.enemySpeed, -Math.sin(angleToPlayer) * enemy.enemySpeed);
      } else {
        enemy.body.setVelocity(0, 0);
      }

      if (time - enemy.lastShotTime >= enemy.shootDelay) {
        fireEnemyProjectile(scene, enemy, angleToPlayer);
        enemy.lastShotTime = time;
      }
    } else {
      enemy.body.setVelocity(Math.cos(angleToPlayer) * enemy.enemySpeed, Math.sin(angleToPlayer) * enemy.enemySpeed);
    }

    if (enemy.visual?.active) {
      enemy.visual.x = enemy.x;
      enemy.visual.y = enemy.y;
      enemy.visual.rotation = angleToPlayer + Math.PI / 2;
    }
  });

  updateBossUI(scene);
}
