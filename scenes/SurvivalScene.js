import { loadProgress, saveProgress, getDefaultProgress } from '../systems/storage.js';
import { createCrosshair } from '../ui/crosshair.js';

export class SurvivalScene extends Phaser.Scene {
  constructor() {
    super('SurvivalScene');
  }

  init(data) {
    const defaults = getDefaultProgress().upgrades;
    const incoming = data && data.upgrades ? data.upgrades : defaults;

    this.runUpgrades = {
      speed: Number.isFinite(incoming.speed) ? incoming.speed : defaults.speed,
      fireRate: Number.isFinite(incoming.fireRate) ? incoming.fireRate : defaults.fireRate,
      bulletSpeed: Number.isFinite(incoming.bulletSpeed) ? incoming.bulletSpeed : defaults.bulletSpeed,
    };
  }

  create() {
    this.width = this.scale.width;
    this.height = this.scale.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;

    // -------- SYSTEME DE NIVEAUX --------
    this.currentLevel = this.registry.get('currentLevel') || 1;
    this.levelDuration = 90;
    this.levelTimer = 0;
    this.isBossLevel = this.currentLevel % 5 === 0;
    this.bossSpawned = false;
    this.levelCompleted = false;

    // -------- ETAT GENERAL --------
    this.gameOver = false;
    this.score = 0;
    this.level = 1;
    this.xp = 0;
    this.xpToNext = 8;
    this.survivalTime = 0;
    this.lastSpawn = 0;
    this.spawnInterval = 900;
    this.enemySpeed = 70;
    this.playerSpeed = 220 + (this.runUpgrades.speed * 15);
    this.playerLife = 100;
    this.damageCooldown = 0;

    const fireRateMultiplier = Math.max(0.45, 1 - this.runUpgrades.fireRate * 0.08);
    this.autoShootDelay = Math.max(180, Math.round(650 * fireRateMultiplier));
    this.lastShotTime = 0;
    this.bulletSpeed = 480 + (this.runUpgrades.bulletSpeed * 60);
    this.maxBullets = 80;
    this.bulletPierce = 1;
    this.weaponAngle = 0;
    this.lastUpgradeText = null;

    this.coins = 0;
    this.progressSnapshot = loadProgress();
    this.baseCoins = this.progressSnapshot.coins;
    this.bonusCoins = 0;
    this.coinDropChance = 0.28;
    this.coinPickupRadius = 22;
    this.coinMagnetDelay = 2000;
    this.coinMagnetRadius = 140;
    this.coinMagnetSpeed = 220;

    // -------- DECOR --------
    this.add.rectangle(this.centerX, this.centerY, this.width, this.height, 0x141414);

    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1f1f1f, 1);
    for (let x = 0; x < this.width; x += 80) grid.lineBetween(x, 0, x, this.height);
    for (let y = 0; y < this.height; y += 80) grid.lineBetween(0, y, this.width, y);

    this.stars = [];
    for (let i = 0; i < 60; i += 1) {
      const star = this.add.circle(
        Phaser.Math.Between(0, this.width),
        Phaser.Math.Between(0, this.height),
        Phaser.Math.Between(1, 2),
        0xffffff,
        Phaser.Math.FloatBetween(0.2, 0.6),
      );
      star.speed = Phaser.Math.FloatBetween(5, 15);
      this.stars.push(star);
    }

    // -------- JOUEUR --------
    this.player = this.add.circle(this.centerX, this.centerY, 14, 0x22c55e, 0.01);
    this.player.collisionRadius = 14;
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);
    this.playerVisual = this.createPlayerVisual(this.player.x, this.player.y);

    this.weapon = this.add.rectangle(this.player.x, this.player.y, 26, 8, 0xe5e7eb);
    this.weapon.setStrokeStyle(1, 0xffffff);
    this.weapon.setOrigin(0.15, 0.5);
    this.weaponFlash = this.add.circle(this.player.x, this.player.y, 6, 0xfacc15).setAlpha(0);
    this.crosshair = createCrosshair(this);

    // -------- GROUPES --------
    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();
    this.coinsGroup = this.physics.add.group();

    // -------- INPUTS --------
    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('Z,Q,S,D,W,A');

    this.physics.world.setBounds(0, 0, this.width, this.height);

    // -------- UI --------
    this.timeText = this.add.text(20, 20, 'Temps : 0.0 s', { fontSize: '24px', color: '#ffffff' });
    this.lifeText = this.add.text(20, 55, 'Vie : 100', { fontSize: '24px', color: '#ffffff' });
    this.scoreText = this.add.text(20, 90, 'Kills : 0', { fontSize: '24px', color: '#ffffff' });
    this.levelText = this.add.text(20, 125, 'Level : 1', { fontSize: '22px', color: '#ffffff' });
    this.xpText = this.add.text(20, 152, 'XP : 0 / 8', { fontSize: '20px', color: '#a3e635' });
    this.coinsText = this.add.text(20, 178, 'Pièces : 0', { fontSize: '20px', color: '#facc15' });
    this.infoText = this.add.text(20, 206, 'Déplacement : ZQSD / WASD / flèches', { fontSize: '18px', color: '#cccccc' });
    this.weaponText = this.add.text(20, 231, 'Arme : canon auto souris', { fontSize: '18px', color: '#cccccc' });
    this.shopBonusText = this.add.text(20, 256, `Boutique : VIT ${this.runUpgrades.speed} | TIR ${this.runUpgrades.fireRate} | BAL ${this.runUpgrades.bulletSpeed}`, { fontSize: '16px', color: '#94a3b8' });
    this.runStatsText = this.add.text(20, 278, `Run : Pierce ${this.bulletPierce}`, { fontSize: '16px', color: '#93c5fd' });

    this.levelTextUI = this.add.text(this.centerX, 20, `Niveau ${this.currentLevel}`, {
      fontSize: '28px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);

    this.centerText = this.add.text(
      this.centerX,
      this.centerY - 120,
      `Niveau ${this.currentLevel}${this.currentLevel === 1 ? ' - initiation' : ''}`,
      { fontSize: '28px', color: '#ffffff', align: 'center' },
    ).setOrigin(0.5);

    this.time.delayedCall(2200, () => this.centerText?.destroy());
  }

  update(time, delta) {
    this.animateStars(delta);
    this.updateCrosshair();

    if (this.gameOver) return;

    this.survivalTime += delta / 1000;
    this.levelTimer += delta / 1000;

    const remaining = Math.max(0, this.levelDuration - this.levelTimer);
    this.timeText.setText(`Temps : ${remaining.toFixed(1)} s`);

    if (!this.levelCompleted && this.levelTimer >= this.levelDuration) {
      this.endLevel();
      return;
    }

    this.handlePlayerMovement();
    this.spawnEnemies(time);
    this.moveEnemies(time);
    this.updateWeaponAim();
    this.autoShoot(time);
    this.moveBullets(delta);
    this.updateEnemyProjectiles(delta);
    this.cleanupBullets();
    this.cleanupEnemyProjectiles();
    this.checkBulletHits();
    this.checkEnemyProjectileHits();
    this.updateCoins();
    this.checkCollisions(time);
    this.increaseDifficulty();
  }

  animateStars(delta) {
    for (const star of this.stars) {
      star.y += star.speed * (delta / 1000);
      if (star.y > this.height) {
        star.y = 0;
        star.x = Phaser.Math.Between(0, this.width);
      }
    }
  }

  updateCrosshair() {
    const pointer = this.input.activePointer;
    if (!pointer || !this.crosshair) return;
    this.crosshair.x = pointer.worldX;
    this.crosshair.y = pointer.worldY;
  }

  handlePlayerMovement() {
    let vx = 0;
    let vy = 0;

    const left = this.cursors.left.isDown || this.keys.Q.isDown || this.keys.A.isDown;
    const right = this.cursors.right.isDown || this.keys.D.isDown;
    const up = this.cursors.up.isDown || this.keys.Z.isDown || this.keys.W.isDown;
    const down = this.cursors.down.isDown || this.keys.S.isDown;

    if (left) vx = -1;
    if (right) vx = 1;
    if (up) vy = -1;
    if (down) vy = 1;

    const length = Math.hypot(vx, vy) || 1;
    this.player.body.setVelocity((vx / length) * this.playerSpeed, (vy / length) * this.playerSpeed);
  }

  createPlayerVisual(x, y) {
    const ship = this.add.container(x, y);

    const hull = this.add.triangle(0, 0, 0, -20, 14, 14, -14, 14, 0x22c55e);
    hull.setStrokeStyle(2, 0x86efac, 1);

    const cockpit = this.add.ellipse(0, -2, 10, 14, 0xc7f9cc);
    cockpit.setStrokeStyle(1, 0xffffff, 0.7);

    const wingLeft = this.add.triangle(-14, 8, 0, 0, -10, 12, -24, 8, 0x15803d);
    const wingRight = this.add.triangle(14, 8, 0, 0, 24, 8, 10, 12, 0x15803d);

    const engineCore = this.add.ellipse(0, 17, 8, 10, 0xe0f2fe, 0.7);
    const engineGlow = this.add.ellipse(0, 19, 14, 20, 0x38bdf8, 0.45);

    ship.add([engineGlow, engineCore, wingLeft, wingRight, hull, cockpit]);
    ship.engineGlow = engineGlow;
    return ship;
  }

  createEnemyVisual(type, x, y, color) {
    const visual = this.add.container(x, y);

    if (type === 'normal') {
      visual.add([
        this.add.rectangle(0, 0, 18, 18, color).setRotation(Math.PI / 4).setStrokeStyle(2, 0xffffff, 0.18),
        this.add.circle(0, 0, 3, 0xffffff, 0.85),
      ]);
    } else if (type === 'fast') {
      visual.add([
        this.add.rectangle(0, 12, 4, 10, 0xfde68a, 0.35),
        this.add.triangle(0, 0, 0, -14, 10, 10, -10, 10, color).setStrokeStyle(2, 0xffffff, 0.22),
      ]);
    } else if (type === 'shooter') {
      visual.add([
        this.add.triangle(0, 0, 0, 14, 12, -10, -12, -10, color).setStrokeStyle(2, 0xffffff, 0.22),
        this.add.rectangle(0, -14, 4, 10, 0xe0f2fe),
        this.add.circle(0, -2, 3, 0xffffff, 0.9),
      ]);
    } else if (type === 'tank') {
      visual.add([
        this.add.polygon(0, 0, [-14, -8, 0, -16, 14, -8, 14, 8, 0, 16, -14, 8], color).setStrokeStyle(2, 0xffffff, 0.2),
        this.add.circle(0, 0, 5, 0xe9d5ff, 0.9),
      ]);
    } else if (type === 'boss') {
      visual.add([
        this.add.polygon(0, 0, [-28, -16, 0, -34, 28, -16, 34, 0, 28, 16, 0, 34, -28, 16, -34, 0], color).setStrokeStyle(3, 0xffffff, 0.22),
        this.add.circle(0, 0, 10, 0xffffff, 0.85),
        this.add.circle(-14, 8, 4, 0xfff1f2, 0.8),
        this.add.circle(14, 8, 4, 0xfff1f2, 0.8),
      ]);
    }

    return visual;
  }

  getEnemyProfile(type) {
    const profiles = {
      normal: { radius: 12, color: 0xef4444, hp: 2, speedMultiplier: 1, damage: 10, isRanged: false },
      fast: { radius: 9, color: 0xf97316, hp: 1, speedMultiplier: 1.05, damage: 5, isRanged: false },
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

  getEnemyTypeForCurrentLevel() {
    const r = Math.random();

    if (this.currentLevel === 1) {
      return 'normal';
    }

    if (this.currentLevel === 2) {
      return 'normal';
    }

    if (this.currentLevel === 3) {
      return r < 0.15 ? 'fast' : 'normal';
    }

    if (this.currentLevel === 4) {
      if (r < 0.25) return 'fast';
      return 'normal';
    }

    // Après le premier boss, on introduit progressivement le reste.
    if (this.currentLevel <= 6) {
      if (r < 0.15) return 'tank';
      if (r < 0.35) return 'fast';
      return 'normal';
    }

    if (this.currentLevel <= 8) {
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

  spawnEnemies(time) {
    if (this.isBossLevel) {
      if (!this.bossSpawned) {
        this.spawnBoss();
        this.bossSpawned = true;
      }
      return;
    }

    if (time - this.lastSpawn < this.spawnInterval) return;
    this.lastSpawn = time;

    const side = Phaser.Math.Between(0, 3);
    let x;
    let y;

    if (side === 0) {
      x = Phaser.Math.Between(0, this.width);
      y = -20;
    } else if (side === 1) {
      x = this.width + 20;
      y = Phaser.Math.Between(0, this.height);
    } else if (side === 2) {
      x = Phaser.Math.Between(0, this.width);
      y = this.height + 20;
    } else {
      x = -20;
      y = Phaser.Math.Between(0, this.height);
    }

    const type = this.getEnemyTypeForCurrentLevel();
    this.spawnEnemyOfType(type, x, y, time);
  }

  spawnEnemyOfType(type, x, y, time) {
    const profile = this.getEnemyProfile(type);

    const enemy = this.add.circle(x, y, profile.radius, profile.color, 0.01);
    enemy.collisionRadius = profile.radius;
    enemy.visual = this.createEnemyVisual(type, x, y, profile.color);
    enemy.type = type;
    enemy.hp = profile.hp;
    enemy.maxHp = profile.hp;
    enemy.enemySpeed = this.enemySpeed * profile.speedMultiplier;
    enemy.damage = profile.damage;
    enemy.isRanged = !!profile.isRanged;
    enemy.preferredMinDistance = profile.preferredMinDistance || 0;
    enemy.preferredMaxDistance = profile.preferredMaxDistance || 0;
    enemy.shootDelay = profile.shootDelay || 0;
    enemy.projectileSpeed = profile.projectileSpeed || 0;
    enemy.lastShotTime = time || 0;

    this.physics.add.existing(enemy);
    enemy.body.setAllowGravity(false);
    enemy.body.setImmovable(true);
    this.enemies.add(enemy);
    return enemy;
  }

  spawnBoss() {
    const boss = this.spawnEnemyOfType('boss', this.centerX, 120, this.time.now);
    boss.body.setVelocity(0, 0);
    boss.bossReward = 25;

    this.bossBarBg = this.add.rectangle(this.centerX, 70, 420, 24, 0x000000, 0.75).setStrokeStyle(2, 0xffffff, 0.15).setDepth(1000);
    this.bossBarFill = this.add.rectangle(this.centerX - 210, 70, 420, 18, 0xdc2626, 0.9).setOrigin(0, 0.5).setDepth(1001);
    this.bossLabel = this.add.text(this.centerX, 42, `BOSS - Niveau ${this.currentLevel}`, {
      fontSize: '22px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1001);
  }

  updateBossUI() {
    if (!this.bossSpawned || !this.bossBarFill) return;
    const boss = this.enemies.getChildren().find((enemy) => enemy.active && enemy.type === 'boss' && !enemy.isDying);
    if (!boss) {
      this.bossBarBg?.destroy();
      this.bossBarFill?.destroy();
      this.bossLabel?.destroy();
      this.bossBarBg = null;
      this.bossBarFill = null;
      this.bossLabel = null;
      return;
    }

    const ratio = Phaser.Math.Clamp(boss.hp / boss.maxHp, 0, 1);
    this.bossBarFill.width = 420 * ratio;
  }

  moveEnemies(time) {
    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active || !enemy.body || enemy.isDying) return;

      const angleToPlayer = Phaser.Math.Angle.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      const distanceToPlayer = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);

      if (enemy.isRanged) {
        if (distanceToPlayer > enemy.preferredMaxDistance) {
          enemy.body.setVelocity(Math.cos(angleToPlayer) * enemy.enemySpeed, Math.sin(angleToPlayer) * enemy.enemySpeed);
        } else if (distanceToPlayer < enemy.preferredMinDistance) {
          enemy.body.setVelocity(-Math.cos(angleToPlayer) * enemy.enemySpeed, -Math.sin(angleToPlayer) * enemy.enemySpeed);
        } else {
          enemy.body.setVelocity(0, 0);
        }

        if (time - enemy.lastShotTime >= enemy.shootDelay) {
          this.fireEnemyProjectile(enemy, angleToPlayer);
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

    this.updateBossUI();
  }

  fireEnemyProjectile(enemy, angle) {
    const spawnDistance = enemy.collisionRadius + 10;
    const px = enemy.x + Math.cos(angle) * spawnDistance;
    const py = enemy.y + Math.sin(angle) * spawnDistance;

    const projectile = this.add.circle(px, py, enemy.type === 'boss' ? 7 : 5, 0x7dd3fc);
    projectile.setStrokeStyle(1, 0xe0f2fe, 0.9);
    projectile.damage = enemy.damage;
    projectile.vx = Math.cos(angle) * enemy.projectileSpeed;
    projectile.vy = Math.sin(angle) * enemy.projectileSpeed;
    projectile.life = enemy.type === 'boss' ? 4500 : 3500;
    projectile.trailTimer = 0;

    this.physics.add.existing(projectile);
    projectile.body.setAllowGravity(false);
    projectile.body.setEnable(false);
    this.enemyProjectiles.add(projectile);
  }

  updateWeaponAim() {
    const pointer = this.input.activePointer;
    if (pointer) {
      this.weaponAngle = Phaser.Math.Angle.Between(this.player.x, this.player.y, pointer.worldX, pointer.worldY);
    }

    this.weapon.x = this.player.x;
    this.weapon.y = this.player.y;
    this.weapon.rotation = this.weaponAngle;

    this.playerVisual.x = this.player.x;
    this.playerVisual.y = this.player.y;
    this.playerVisual.rotation = this.weaponAngle + Math.PI / 2;

    if (this.playerVisual.engineGlow) {
      this.playerVisual.engineGlow.scaleY = 0.9 + Math.abs(Math.sin(this.time.now * 0.015)) * 0.35;
      this.playerVisual.engineGlow.alpha = 0.35 + Math.abs(Math.sin(this.time.now * 0.02)) * 0.25;
    }

    const flashOffset = 18;
    this.weaponFlash.x = this.player.x + Math.cos(this.weaponAngle) * flashOffset;
    this.weaponFlash.y = this.player.y + Math.sin(this.weaponAngle) * flashOffset;
  }

  autoShoot(time) {
    if (time - this.lastShotTime < this.autoShootDelay) return;

    this.lastShotTime = time;
    const shootAngle = this.weaponAngle;
    const muzzleDistance = 20;
    const spawnX = this.player.x + Math.cos(shootAngle) * muzzleDistance;
    const spawnY = this.player.y + Math.sin(shootAngle) * muzzleDistance;

    const bullet = this.add.rectangle(spawnX, spawnY, 16, 5, 0xfacc15);
    bullet.rotation = shootAngle;
    this.physics.add.existing(bullet);
    bullet.body.setAllowGravity(false);
    bullet.body.setEnable(false);
    bullet.vx = Math.cos(shootAngle) * this.bulletSpeed;
    bullet.vy = Math.sin(shootAngle) * this.bulletSpeed;
    bullet.trailTimer = 0;
    bullet.damage = 1;
    bullet.remainingPierce = this.bulletPierce;
    bullet.hitEnemies = new Set();
    this.bullets.add(bullet);

    this.weaponFlash.setAlpha(1);
    this.weaponFlash.setScale(1.4);
    this.tweens.add({ targets: this.weaponFlash, alpha: 0, scale: 0.5, duration: 90, ease: 'Quad.easeOut' });
    this.tweens.add({
      targets: this.weapon,
      x: this.player.x - Math.cos(shootAngle) * 4,
      y: this.player.y - Math.sin(shootAngle) * 4,
      duration: 45,
      yoyo: true,
      ease: 'Quad.easeOut',
      onUpdate: () => {
        this.weapon.rotation = this.weaponAngle;
      },
    });

    if (this.bullets.getChildren().length > this.maxBullets) {
      const oldestBullet = this.bullets.getChildren()[0];
      this.destroyEntity(oldestBullet, this.bullets);
    }
  }

  moveBullets(delta) {
    const dt = delta / 1000;

    this.bullets.getChildren().forEach((bullet) => {
      if (!bullet.active) return;
      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;
      bullet.trailTimer += delta;

      if (bullet.trailTimer > 25) {
        bullet.trailTimer = 0;
        const trail = this.add.rectangle(bullet.x, bullet.y, 6, 2, 0xfacc15, 0.6);
        trail.rotation = bullet.rotation;
        this.tweens.add({ targets: trail, alpha: 0, scaleX: 0.2, duration: 180, onComplete: () => trail.destroy() });
      }
    });
  }

  updateEnemyProjectiles(delta) {
    const dt = delta / 1000;

    this.enemyProjectiles.getChildren().forEach((projectile) => {
      if (!projectile.active) return;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= delta;
      projectile.trailTimer += delta;

      if (projectile.trailTimer > 45) {
        projectile.trailTimer = 0;
        const trail = this.add.circle(projectile.x, projectile.y, 3, 0x7dd3fc, 0.35);
        this.tweens.add({ targets: trail, alpha: 0, scale: 0.2, duration: 220, onComplete: () => trail.destroy() });
      }
    });
  }

  checkBulletHits() {
    const bullets = this.bullets.getChildren();
    const enemies = this.enemies.getChildren();

    bullets.forEach((bullet) => {
      if (!bullet.active) return;

      for (const enemy of enemies) {
        if (!enemy.active || enemy.isDying) continue;
        if (bullet.hitEnemies?.has(enemy)) continue;

        const distance = Phaser.Math.Distance.Between(bullet.x, bullet.y, enemy.x, enemy.y);
        if (distance < 20) {
          bullet.hitEnemies?.add(enemy);

          let dmg = bullet.damage || 1;
          const isCrit = Math.random() < 0.12;
          if (isCrit) dmg *= 3;

          const dmgText = this.add.text(enemy.x, enemy.y - 10, isCrit ? `CRIT ${dmg}` : String(dmg), {
            fontSize: isCrit ? '22px' : '18px',
            color: isCrit ? '#ff4040' : '#ffffff',
            fontStyle: 'bold',
          }).setOrigin(0.5);
          this.tweens.add({ targets: dmgText, y: dmgText.y - 30, alpha: 0, duration: 500, ease: 'Quad.easeOut', onComplete: () => dmgText.destroy() });

          this.showImpact(enemy.x, enemy.y);
          enemy.hp -= dmg;
          if (enemy.hp <= 0) this.killEnemy(enemy, bullet);

          bullet.remainingPierce -= 1;
          if (bullet.remainingPierce < 0) {
            this.destroyEntity(bullet, this.bullets);
            break;
          }
        }
      }
    });
  }

  checkEnemyProjectileHits() {
    this.enemyProjectiles.getChildren().forEach((projectile) => {
      if (!projectile.active) return;

      const distance = Phaser.Math.Distance.Between(projectile.x, projectile.y, this.player.x, this.player.y);
      if (distance < this.player.collisionRadius + 8) {
        this.damagePlayer(projectile.damage || 8);
        this.showEnemyProjectileImpact(projectile.x, projectile.y);
        this.destroyEntity(projectile, this.enemyProjectiles);
      }
    });
  }

  showImpact(x, y) {
    const impact = this.add.circle(x, y, 7, 0xffffff).setStrokeStyle(2, 0xfacc15);
    this.tweens.add({ targets: impact, alpha: 0, scale: 2, duration: 100, onComplete: () => impact.destroy() });
  }

  showEnemyProjectileImpact(x, y) {
    const impact = this.add.circle(x, y, 8, 0x7dd3fc, 0.5).setStrokeStyle(2, 0xe0f2fe, 0.9);
    this.tweens.add({ targets: impact, alpha: 0, scale: 2.5, duration: 150, onComplete: () => impact.destroy() });
  }

  killEnemy(enemy, bullet = null) {
    if (!enemy || !enemy.active || enemy.isDying) return;
    enemy.isDying = true;
    enemy.hp = 0;

    if (enemy.body) {
      enemy.body.setVelocity(0, 0);
      enemy.body.enable = false;
    }

    const x = enemy.x;
    const y = enemy.y;
    const colors = { normal: 0xef4444, fast: 0xf97316, shooter: 0x38bdf8, tank: 0x8b5cf6, boss: 0xdc2626 };
    const particleColor = colors[enemy.type] || 0xffffff;

    for (let i = 0; i < 8; i += 1) {
      const particle = this.add.circle(x, y, Phaser.Math.Between(2, 4), particleColor);
      particle.setStrokeStyle(1, 0xffffff, 0.35);
      const particleAngle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const particleSpeed = Phaser.Math.Between(70, 160);
      this.physics.add.existing(particle);
      particle.body.setAllowGravity(false);
      particle.body.setVelocity(Math.cos(particleAngle) * particleSpeed, Math.sin(particleAngle) * particleSpeed);
      this.tweens.add({ targets: particle, alpha: 0, scale: 0.25, duration: 420, onComplete: () => particle.destroy() });
    }

    const shockwave = this.add.circle(x, y, 8, particleColor, 0.28).setStrokeStyle(2, 0xffffff, 0.22);
    this.tweens.add({ targets: shockwave, scale: 3, alpha: 0, duration: 220, onComplete: () => shockwave.destroy() });

    this.score += 1;
    this.cameras.main.shake(enemy.type === 'boss' ? 140 : 80, enemy.type === 'boss' ? 0.004 : 0.002);
    this.scoreText.setText(`Kills : ${this.score}`);

    let xpGain = enemy.type === 'boss' ? 12 : 1;
    if (bullet?.hitEnemies) {
      const multiKillCount = bullet.hitEnemies.size;
      if (multiKillCount >= 2) {
        xpGain += multiKillCount - 1;
        this.showMultiKillText(x, y, multiKillCount);
      }
    }

    this.addXP(xpGain);
    this.tryDropCoin(x, y, enemy.type === 'boss' ? (enemy.bossReward || 25) : 1);

    if (enemy.visual?.active) {
      this.tweens.add({
        targets: enemy.visual,
        scaleX: enemy.type === 'boss' ? 1.8 : 1.4,
        scaleY: enemy.type === 'boss' ? 1.8 : 1.4,
        alpha: 0,
        duration: enemy.type === 'boss' ? 220 : 120,
      });
    }

    this.tweens.add({
      targets: enemy,
      scaleX: enemy.type === 'boss' ? 2.2 : 1.8,
      scaleY: enemy.type === 'boss' ? 2.2 : 1.8,
      alpha: 0,
      duration: enemy.type === 'boss' ? 180 : 100,
      onComplete: () => {
        this.destroyEntity(enemy, this.enemies);
      },
    });
  }

  addXP(amount) {
    this.xp += amount;

    while (this.xp >= this.xpToNext) {
      this.xp -= this.xpToNext;
      this.levelUp();
    }

    this.xpText.setText(`XP : ${this.xp} / ${this.xpToNext}`);
    if (this.runStatsText) {
      this.runStatsText.setText(`Run : Pierce ${this.bulletPierce}`);
    }
  }

  levelUp() {
    this.level += 1;
    this.xpToNext = Math.ceil(this.xpToNext * 1.35);
    this.levelText.setText(`Level : ${this.level}`);

    const upgrades = [
      {
        label: 'Cadence +15%',
        apply: () => {
          this.autoShootDelay = Math.max(180, Math.round(this.autoShootDelay * 0.85));
        },
      },
      {
        label: 'Balles +60 vitesse',
        apply: () => {
          this.bulletSpeed += 60;
        },
      },
      {
        label: 'Perforation +1',
        apply: () => {
          this.bulletPierce += 1;
        },
      },
      {
        label: 'Déplacement +15',
        apply: () => {
          this.playerSpeed += 15;
        },
      },
    ];

    const chosen = Phaser.Utils.Array.GetRandom(upgrades);
    chosen.apply();
    this.showLevelUpText(chosen.label);
    this.xpText.setText(`XP : ${this.xp} / ${this.xpToNext}`);
    if (this.runStatsText) {
      this.runStatsText.setText(`Run : Pierce ${this.bulletPierce}`);
    }
  }

  tryDropCoin(x, y, value = 1) {
    const drops = Math.max(1, value);

    for (let i = 0; i < drops; i += 1) {
      if (value === 1 && Math.random() > this.coinDropChance) continue;

      const offsetX = Phaser.Math.Between(-10, 10);
      const offsetY = Phaser.Math.Between(-10, 10);
      const coin = this.add.circle(x + offsetX, y + offsetY, 6, 0xfacc15);
      coin.setStrokeStyle(2, 0x7c5c00);

      const glow = this.add.circle(x + offsetX, y + offsetY, 10, 0xfacc15, 0.15);
      glow.setDepth(coin.depth - 1);
      coin.glow = glow;
      coin.glowTween = this.tweens.add({
        targets: glow,
        scale: 1.4,
        alpha: 0,
        duration: 600,
        repeat: -1,
        yoyo: true,
      });

      coin.spawnTime = this.time.now;
      coin.value = 1;
      this.physics.add.existing(coin);
      coin.body.setAllowGravity(false);
      coin.body.setVelocity(0, 0);
      this.coinsGroup.add(coin);

      this.tweens.add({
        targets: coin,
        scale: 1.15,
        duration: 180,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  updateCoins() {
    this.coinsGroup.getChildren().forEach((coin) => {
      if (!coin.active || !coin.body) return;

      const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.x, coin.y);

      if (distance < this.coinPickupRadius) {
        this.collectCoin(coin);
        return;
      }

      if (this.time.now - coin.spawnTime > this.coinMagnetDelay && distance <= this.coinMagnetRadius) {
        const magnetAngle = Phaser.Math.Angle.Between(coin.x, coin.y, this.player.x, this.player.y);
        const magnetStrength = 1 - (distance / this.coinMagnetRadius);
        const currentMagnetSpeed = this.coinMagnetSpeed * (0.35 + magnetStrength);

        coin.body.setVelocity(
          Math.cos(magnetAngle) * currentMagnetSpeed,
          Math.sin(magnetAngle) * currentMagnetSpeed,
        );
      } else {
        coin.body.setVelocity(0, 0);
      }

      if (coin.glow?.active) {
        coin.glow.setPosition(coin.body.center.x, coin.body.center.y);
      }
    });
  }

  collectCoin(coin) {
    if (!coin || !coin.active) return;

    this.coins += coin.value || 1;
    this.coinsText.setText(`Pièces : ${this.coins}`);
    this.syncCoinsToStorage();

    const pickupText = this.add.text(coin.x, coin.y - 16, '+1', {
      fontSize: '18px',
      color: '#facc15',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: pickupText,
      y: pickupText.y - 18,
      alpha: 0,
      duration: 500,
      onComplete: () => pickupText.destroy(),
    });

    if (coin.glowTween) {
      coin.glowTween.stop();
      coin.glowTween.remove();
    }
    if (coin.glow?.active) coin.glow.destroy();
    this.destroyEntity(coin, this.coinsGroup);
  }

  showMultiKillText(x, y, count) {
    const txt = this.add.text(x, y - 26, `${count} HIT +XP`, {
      fontSize: '18px',
      color: '#60a5fa',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.tweens.add({
      targets: txt,
      y: txt.y - 24,
      alpha: 0,
      duration: 650,
      onComplete: () => txt.destroy(),
    });
  }

  showLevelUpText(label) {
    this.lastUpgradeText?.destroy();

    const container = this.add.container(this.player.x, this.player.y - 70);
    const bg = this.add.rectangle(0, 0, 260, 70, 0x000000, 0.78).setStrokeStyle(2, 0xfacc15, 1);
    const title = this.add.text(0, -14, 'LEVEL UP !', { fontSize: '24px', color: '#fde047', fontStyle: 'bold' }).setOrigin(0.5);
    const subtitle = this.add.text(0, 14, `Bonus : ${label}`, { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);

    container.add([bg, title, subtitle]);
    container.setDepth(1000);
    this.lastUpgradeText = container;

    this.tweens.add({
      targets: container,
      y: container.y - 35,
      alpha: 0,
      duration: 1200,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (container?.active) container.destroy();
      },
    });
  }

  damagePlayer(amount) {
    if (this.gameOver) return;
    if (this.time.now <= this.damageCooldown) return;

    this.damageCooldown = this.time.now + 250;
    this.playerLife -= amount;
    this.lifeText.setText(`Vie : ${Math.max(0, this.playerLife)}`);

    this.tweens.add({
      targets: this.playerVisual,
      alpha: 0.25,
      duration: 80,
      yoyo: true,
      repeat: 1,
    });

    if (this.playerLife <= 0) {
      this.endGame();
    }
  }

  checkCollisions(time) {
    let highestDamage = 0;

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active || enemy.isDying) return;
      const collisionDistance = this.player.collisionRadius + (enemy.collisionRadius || enemy.radius || 12);
      const distance = Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y);
      if (distance < collisionDistance) {
        highestDamage = Math.max(highestDamage, enemy.damage || 10);
      }
    });

    if (highestDamage > 0 && time > this.damageCooldown) {
      this.damagePlayer(highestDamage);
    }
  }

  cleanupBullets() {
    this.bullets.getChildren().forEach((bullet) => {
      if (!bullet.active) return;
      const outOfBounds = bullet.x < -50 || bullet.x > this.width + 50 || bullet.y < -50 || bullet.y > this.height + 50;
      if (outOfBounds) this.destroyEntity(bullet, this.bullets);
    });
  }

  cleanupEnemyProjectiles() {
    this.enemyProjectiles.getChildren().forEach((projectile) => {
      if (!projectile.active) return;
      const outOfBounds = projectile.x < -50 || projectile.x > this.width + 50 || projectile.y < -50 || projectile.y > this.height + 50;
      if (outOfBounds || projectile.life <= 0) {
        this.destroyEntity(projectile, this.enemyProjectiles);
      }
    });
  }

  destroyEntity(entity, group) {
    if (!entity) return;
    if (entity.glowTween) {
      entity.glowTween.stop();
      entity.glowTween.remove();
    }
    if (entity.glow?.active) entity.glow.destroy();
    if (entity.visual?.active) entity.visual.destroy();

    if (group?.contains(entity)) {
      group.remove(entity, true, true);
    } else {
      entity.destroy();
    }
  }

  increaseDifficulty() {
    if (this.isBossLevel) {
      this.spawnInterval = 999999;
      this.enemySpeed = 80;
      return;
    }

    const levelFactor = Math.max(0, this.currentLevel - 1);
    this.spawnInterval = Math.max(320, 950 - (this.levelTimer * 4) - (levelFactor * 35));
    this.enemySpeed = Math.min(170, 60 + (levelFactor * 4) + (this.levelTimer * 0.4));
  }

  syncCoinsToStorage() {
    const progress = loadProgress();
    progress.coins = this.baseCoins + this.coins;
    saveProgress(progress);
  }

  calculateKillBonus() {
    const tiers = [10, 50, 100, 150, 200];
    let bonus = 0;
    tiers.forEach((tier) => {
      if (this.score >= tier) bonus += Math.floor(tier / 10);
    });
    this.bonusCoins = bonus;
  }

  persistRunCoins() {
    this.calculateKillBonus();
    const progress = loadProgress();
    progress.coins = this.baseCoins + this.coins + this.bonusCoins;
    saveProgress(progress);
  }

  endLevel() {
    if (this.gameOver || this.levelCompleted) return;

    this.levelCompleted = true;
    this.gameOver = true;
    this.persistRunCoins();

    this.player.body.setVelocity(0, 0);
    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.body) enemy.body.setVelocity(0, 0);
    });
    this.bullets.getChildren().forEach((bullet) => {
      bullet.vx = 0;
      bullet.vy = 0;
    });
    this.enemyProjectiles.getChildren().forEach((projectile) => {
      projectile.vx = 0;
      projectile.vy = 0;
    });

    const overlay = this.add.rectangle(this.centerX, this.centerY, 560, 340, 0x000000, 0.85).setStrokeStyle(2, 0xffffff, 0.12).setDepth(2000);
    const title = this.add.text(this.centerX, this.centerY - 90, this.isBossLevel ? 'Boss vaincu !' : 'Niveau terminé', {
      fontSize: '40px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(2001);

    const resume = this.add.text(this.centerX, this.centerY - 28, `Niveau ${this.currentLevel} terminé\nKills : ${this.score}  |  Pièces : ${this.coins}`, {
      fontSize: '22px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5).setDepth(2001);

    const nextButton = this.createOverlayButton(this.centerX, this.centerY + 44, 'Niveau suivant', 0x16a34a, () => {
      this.registry.set('currentLevel', this.currentLevel + 1);
      this.scene.restart({ upgrades: this.runUpgrades });
    });

    const menuButton = this.createOverlayButton(this.centerX, this.centerY + 118, 'Boutique / menu', 0x2563eb, () => {
      this.scene.start('MenuScene');
    });

    nextButton.setDepth(2001);
    menuButton.setDepth(2001);
    overlay.setDataEnabled();
    title.setDepth(2001);
    resume.setDepth(2001);
  }

  createOverlayButton(x, y, label, color, onClick) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 260, 58, color, 1).setStrokeStyle(3, 0xffffff, 0.15);
    const text = this.add.text(0, 0, label, {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([bg, text]);
    container.setSize(260, 58);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => container.setScale(1.03));
    container.on('pointerout', () => container.setScale(1));
    container.on('pointerdown', onClick);
    return container;
  }

  endGame() {
    if (this.gameOver && !this.levelCompleted) return;
    if (this.levelCompleted) return;

    this.gameOver = true;
    this.persistRunCoins();
    this.player.body.setVelocity(0, 0);

    this.enemies.getChildren().forEach((enemy) => {
      if (enemy.body) enemy.body.setVelocity(0, 0);
    });

    this.bullets.getChildren().forEach((bullet) => {
      bullet.vx = 0;
      bullet.vy = 0;
      if (bullet.body) bullet.body.setVelocity(0, 0);
    });

    this.enemyProjectiles.getChildren().forEach((projectile) => {
      projectile.vx = 0;
      projectile.vy = 0;
      if (projectile.body) projectile.body.setVelocity(0, 0);
    });

    this.coinsGroup.getChildren().forEach((coin) => {
      if (coin.body) coin.body.setVelocity(0, 0);
      if (coin.glowTween) coin.glowTween.stop();
      if (coin.glow?.active) coin.glow.destroy();
    });

    const overlay = this.add.rectangle(this.centerX, this.centerY, 500, 300, 0x000000, 0.82).setStrokeStyle(2, 0xffffff, 0.1);
    this.add.text(this.centerX, this.centerY - 80, 'Game Over', { fontSize: '40px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(this.centerX, this.centerY - 30, `Niveau atteint : ${this.currentLevel}`, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(this.centerX, this.centerY + 8, `Ennemis éliminés : ${this.score}`, { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(this.centerX, this.centerY + 42, `Pièces ramassées : ${this.coins}`, { fontSize: '22px', color: '#facc15' }).setOrigin(0.5);
    if (this.bonusCoins > 0) {
      this.add.text(this.centerX, this.centerY + 74, `Bonus paliers : +${this.bonusCoins}`, { fontSize: '22px', color: '#22c55e' }).setOrigin(0.5);
    }

    const checkpointLevel = this.currentLevel >= 5 ? Math.floor((this.currentLevel - 1) / 5) * 5 + 1 : 1;
    const menuButtonY = this.bonusCoins > 0 ? this.centerY + 128 : this.centerY + 108;
    const menuButton = this.createOverlayButton(this.centerX, menuButtonY, 'Retour au menu', 0x2563eb, () => {
      this.registry.set('currentLevel', checkpointLevel);
      this.scene.start('MenuScene');
    });
    menuButton.setDepth(1001);
  }
}
