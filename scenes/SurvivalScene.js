import { loadProgress, saveProgress, getDefaultProgress, unlockCheckpoint } from '../systems/storage.js';
import { createCrosshair } from '../ui/crosshair.js';
import { createGameHUD, refreshGameHUD, showFloatingText, showGameOverOverlay } from '../ui/GameUI.js';
import { initLevelState, createLevelUI, updateLevelTimer, endLevel } from './LevelSystem.js';
import {
  getEnemyProfile,
  getEnemyTypeForLevel,
  spawnEnemyOfType,
  spawnSwarm,
  spawnBoss,
  moveEnemies as moveEnemiesFromFactory,
  triggerKamikazeExplosion,
} from './EnemyFactory.js';
import { getDifficultyParams } from '../config/DifficultyConfig.js';
import { initBossLevel, updateBoss, onBossDeath } from '../systems/BossSystem.js';
import { playMusic, stopMusic, playSfx, AUDIO_CONFIG } from '../systems/AudioConfig.js';
import { buildBackground, animateBackground } from '../systems/BackgroundSystem.js';
import {
  createDefaultWeaponState,
  shootEquippedWeapon,
  unlockWeapon,
  equipWeapon
} from '../systems/WeaponSystem.js';
import { openShopOverlay } from '../systems/ShopSystem.js';
import { initGameFeel, triggerHitstop, spawnKillParticles, triggerPlayerHitEffect, registerKill, getComboMultiplier } from '../systems/GameFeel.js';
import { initModules, tickModules, syncModuleVisuals, tryShieldAbsorb } from '../systems/ModuleSystem.js';
import { stopLaserBeam } from '../systems/WeaponSystem.js';

const DEBUG_START_LEVEL = null; 
// null = fonctionnement normal
// 1, 2, 3, 4, 5... = forcer le niveau de départ

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

    this.weaponState = data && data.weaponState
      ? data.weaponState
      : createDefaultWeaponState();

    // Charger les modules depuis la sauvegarde permanente
    const progress = loadProgress();
    this.moduleState  = data?.moduleState || progress.modules || { owned: ['basic'], slots: ['basic', null, null] };
    this.isBossReplay = data?.isBossReplay ?? false;
    this.runStacks    = data?.runStacks    || {};
  }

  preload() {
    // Charger les backgrounds disponibles (1 à 10)
    // Les fichiers manquants sont ignorés silencieusement
    for (let i = 1; i <= 10; i++) {
      const level = i.toString().padStart(2, '0');
      const key   = `bg_level_${level}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, `assets/backgrounds/bg_level_${level}.webp`);
      }
    }
    // Ignorer les erreurs 404 sur les backgrounds optionnels
    this.load.on('loaderror', (file) => {
      if (file.key?.startsWith('bg_level_')) {
        // Texture non disponible — le fallback dans BackgroundSystem prendra le relais
      }
    });

    if (!this.cache.audio.exists('music-game')) {
      this.load.audio('music-game', 'assets/audio/music-game.mp3');
    }
    // Musiques boss par niveau (boss-level-5.mp3, boss-level-10.mp3...)
    for (let bl = 5; bl <= 50; bl += 5) {
      const bk = `boss-level-${bl}`;
      if (!this.cache.audio.exists(bk)) {
        this.load.audio(bk, `assets/audio/boss-level-${bl}.mp3`);
      }
      const ek = `boss-level-${bl}-explosion`;
      if (!this.cache.audio.exists(ek)) {
        this.load.audio(ek, `assets/audio/boss-level-${bl}-explosion.mp3`);
      }
    }

    this.load.image('weapon_spread', 'assets/weapons/weapon_spread.webp');
    this.load.image('weapon_double', 'assets/weapons/weapon_double.webp');
    this.load.image('enemy-shooter',      'assets/sprites/enemy-shooter.webp');
    this.load.image('enemy-boss-level-1', 'assets/sprites/enemy-boss-level-1.webp');
    this.load.image('enemy-kamikaze', 'assets/sprites/enemy-kamikaze.webp');
    this.load.image('enemy-swarm',    'assets/sprites/enemy-swarm.webp');
  }


  startGameplayMusic() {
    if (this.isBossLevel) return;
    playMusic(this, 'music-game');
  }

  stopGameplayMusic() {
    stopMusic(this);
  }

  create() {
    this.width = this.scale.width;
    this.height = this.scale.height;
    this.centerX = this.width / 2;
    this.centerY = this.height / 2;

    this.gameplayMusicStarted = false;

    const unlockGameplayMusic = () => {
      if (this.gameplayMusicStarted) return;
      this.gameplayMusicStarted = true;
      this.startGameplayMusic();
    };

    this.input.once('pointerdown', unlockGameplayMusic);
    this.input.keyboard.once('keydown', unlockGameplayMusic);

    this.gameOver = false;
    this.score = 0;
    this.survivalTime = 0;
    this.lastSpawn = 0;
    this.spawnInterval = 900;
    this.enemySpeed = 70;
    this.playerSpeed = 220 + this.runUpgrades.speed * 15;
    this.playerLife = 100;
    this.damageCooldown = 0;

    const fireRateMultiplier = Math.max(0.45, 1 - this.runUpgrades.fireRate * 0.08);
    this.autoShootDelay = Math.max(180, Math.round(650 * fireRateMultiplier));
    this.lastShotTime = 0;
    this.bulletSpeed = 480 + this.runUpgrades.bulletSpeed * 60;
    this.maxBullets = 80;
    this.bulletPierce = 1;
    this.weaponAngle = 0;

    this.enemies = this.physics.add.group();
    this.bullets = this.physics.add.group();
    this.coinsGroup = this.physics.add.group();
    this.enemyProjectiles = this.physics.add.group();

    this.coins = 0;
    this.progressSnapshot = loadProgress();
    this.baseCoins = this.progressSnapshot.coins;
    this.bonusCoins = 0;
    this.coinDropChance = 0.38;
    this.coinPickupRadius = 22;
    this.coinMagnetDelay = 2000;
    this.coinMagnetRadius = 140;
    this.coinMagnetSpeed = 220;

    initLevelState(this);
    if (this.isBossReplay) this.isBossLevel = true;

    // Réappliquer les upgrades de run (stacks)
    this._applyRunStacks();

    if (Number.isFinite(DEBUG_START_LEVEL) && DEBUG_START_LEVEL >= 1) {
      this.currentLevel = DEBUG_START_LEVEL;
      this.registry.set('currentLevel', DEBUG_START_LEVEL);
      this.isBossLevel = this.currentLevel % 5 === 0;
    }

    buildBackground(this);
    this.buildPlayer();
    this.crosshair = createCrosshair(this);

    this.cursors = this.input.keyboard.createCursorKeys();
    this.keys = this.input.keyboard.addKeys('Z,Q,S,D,W,A');
    this.physics.world.setBounds(0, 0, this.width, this.height);

    this.buildHud();
    createLevelUI(this);
    refreshGameHUD(this);

    const menuMusic = this.sound.get('music-menu');
    if (menuMusic && menuMusic.isPlaying) {
      menuMusic.stop();
    }
  }

  buildPlayer() {
    this.createEngineParticleTexture();
    this.player = this.add.circle(this.centerX, this.centerY, 14, 0x22c55e, 0.01);
    this.player.collisionRadius = 14;
    this.physics.add.existing(this.player);
    this.player.body.setCollideWorldBounds(true);

    this.playerVisual = this.createPlayerVisual(this.player.x, this.player.y);
    this.engineTrailTimer = 0;

    this.weaponFlash = this.add.circle(this.player.x, this.player.y, 7, 0x7dd3fc, 0.8).setAlpha(0);
  }

  buildHud() {
    const hud = createGameHUD(this);
    initGameFeel(this);
    initModules(this);

    // Expose le trigger de hit joueur pour l'explosion kamikaze
    this._triggerPlayerHit = (dmg) => triggerPlayerHitEffect(this, dmg);

    this.gameHUD = hud;
    this.lifeText = hud.lifeText;
    this.coinsText = hud.coinsText;
    this.levelText = hud.levelText;
    this.timeText = hud.timeText;
    this.killsText = hud.killsText;
  }

  update(time, delta) {
    animateBackground(this, delta);
    this.updateCrosshair();

    if (this.gameOver) return;

    this.survivalTime += delta / 1000;
    if (updateLevelTimer(this, delta)) return;

    this.handlePlayerMovement();
    this.spawnEnemies(time);
    this.moveEnemies(time);
    this.updateWeaponAim();
    this.updateEngineTrail(delta);
    this.autoShoot(time);
    this.moveBullets(delta);
    this.updateEnemyProjectiles(delta);
    this.cleanupBullets();
    this.cleanupEnemyProjectiles();
    this.checkBulletHits();
    this.updateCoins();
    this.checkCollisions(time);
    this.increaseDifficulty();

    tickModules(this, time, delta);
    syncModuleVisuals(this);
    if (this.isBossLevel) updateBoss(this, time, delta);
    refreshGameHUD(this);
  }

  updateCrosshair() {
    const pointer = this.input.activePointer;
    if (!pointer || !this.crosshair) return;

    this.crosshair.x = pointer.worldX;
    this.crosshair.y = pointer.worldY;
  }

  handlePlayerMovement() {
    // Bloqué pendant une répulsion de shockwave boss
    if (this._repulsed) {
      this.player.body.setVelocity(0, 0);
      return;
    }
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

  createEngineParticleTexture() {
    if (this.textures.exists('engine-particle')) return;

    const gfx = this.make.graphics({ x: 0, y: 0, add: false });

    gfx.fillStyle(0xffffff, 1);
    gfx.fillCircle(8, 8, 8);

    gfx.generateTexture('engine-particle', 16, 16);
    gfx.destroy();
  }

createPlayerVisual(x, y) {
  const ship = this.add.container(x, y);
  ship.setDepth(2);

  const hull = this.add.image(0, 0, 'ship-hull');
  hull.setScale(1.5);

  const weapon = this.add.image(0, -10, 'weapon-basic');
  weapon.setScale(1.05);

  ship.add([hull, weapon]);
  ship.weapon = weapon;
  ship.hull = hull;

  return ship;
}

createEnemyVisual(type, x, y) {
  // Sélection du sprite boss selon le niveau
  const bossKey = this.textures.exists('enemy-boss-level-1')
    ? 'enemy-boss-level-1' : 'enemy-tank';

  const spriteMap = {
    basic:    'enemy-basic',
    fast:     'enemy-fast',
    tank:     'enemy-tank',
    boss:     bossKey,
    zigzag:   'enemy-fast',
    shooter:  'enemy-shooter',
    kamikaze: 'enemy-kamikaze',
    swarm:    'enemy-swarm',
  };

  const key = spriteMap[type] || 'enemy-basic';
  const img = this.add.image(x, y, key).setDepth(2);

  // Teintes spécifiques (pas de teinte sur le boss — on respecte le sprite)
  if (type === 'zigzag') img.setTint(0xf97316);

  return img;
}
  spawnEnemies(time) {
    if (this.isBossLevel) {
      if (!this.bossSpawned) {
        this.bossSpawned = true;
        initBossLevel(this);  // mise en scène + spawn boss
      }
      return;
    }

    if (time - this.lastSpawn < this.spawnInterval) return;
    this.lastSpawn = time;

    const side = Phaser.Math.Between(0, 3);
    let x;
    let y;
    if (side === 0) {
      x = Phaser.Math.Between(0, this.width); y = -20;
    } else if (side === 1) {
      x = this.width + 20; y = Phaser.Math.Between(0, this.height);
    } else if (side === 2) {
      x = Phaser.Math.Between(0, this.width); y = this.height + 20;
    } else {
      x = -20; y = Phaser.Math.Between(0, this.height);
    }

    const type = getEnemyTypeForLevel(this.currentLevel);

    // Le swarm spawne en groupe (spawnSwarm gère les 5 ennemis)
    if (type === 'swarm') {
      spawnSwarm(this, x, y, time);
    } else {
      spawnEnemyOfType(this, type, x, y, time);
    }
  }

  moveEnemies(time) {
    moveEnemiesFromFactory(this, time);
  }

  // Appelé par BossSystem quand le boss est mort → fin du niveau
  _applyRunStacks() {
    const s = this.runStacks || {};
    // Cadence
    if (s.fireRate) {
      const mult = Math.max(0.45, 1 - s.fireRate * 0.10);
      this.autoShootDelay = Math.max(120, Math.round(650 * mult));
    }
    // Dégâts
    this.bulletDamageMultiplier = 1 + (s.damage || 0) * 0.20;
    // Vitesse
    if (s.speed) this.playerSpeed = 220 + s.speed * 15;
    // Bouclier temporaire
    if (s.shield && this.moduleRuntime?.shield) {
      this.moduleRuntime.shield.active  = true;
      this.moduleRuntime.shield.charged = true;
    }
  }

  _endBossLevel() {
    endLevel(this);
  }

  // Appelé par BossSystem après l'explosion → écran de victoire épique
  _launchBossVictory(boss, bd) {
    if (this.levelCompleted) return;
    this.levelCompleted = true;
    this.gameOver       = true;
    this.persistRunCoins();

    // Sauvegarder le checkpoint
    const progress = loadProgress();
    const nextLevel = this.currentLevel + 1;
    progress.checkpointLevel = nextLevel;
    saveProgress(progress);
    unlockCheckpoint(nextLevel);

    // Mettre en pause
    if (this.player?.body) this.player.body.setVelocity(0, 0);
    this.enemies.getChildren().forEach(e => e.body?.setVelocity(0, 0));

    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('BossVictoryScene', {
        level:         this.currentLevel,
        kills:         this.score ?? 0,
        coinsEarned:   this.coins ?? 0,
        lifeRemaining: Math.max(0, Math.round(this.playerLife ?? 0)),
        maxLife:       this.maxPlayerLife || 100,
        bossReward:    bd?.profile?.bossReward || 25,
        upgrades:      this.runUpgrades,
        weaponState:   this.weaponState,
        moduleState:   this.moduleState,
      });
    });
  }

  // Appelé par BossSystem pour spawner des minions
  _spawnMinionFromBoss(type, x, y) {
    spawnEnemyOfType(this, type, x, y, this.time.now);
  }

  updateWeaponAim() {
    const pointer = this.input.activePointer;
    if (pointer) {
      this.weaponAngle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        pointer.worldX,
        pointer.worldY
      );
    }

    this.playerVisual.x = this.player.x;
    this.playerVisual.y = this.player.y;
    this.playerVisual.rotation = this.weaponAngle + Math.PI / 2;

    const flashOffset = 22;
    this.weaponFlash.x = this.player.x + Math.cos(this.weaponAngle) * flashOffset;
    this.weaponFlash.y = this.player.y + Math.sin(this.weaponAngle) * flashOffset;
  }

  updateEngineTrail(delta) {
    if (!this.playerVisual) return;

    this.engineTrailTimer += delta;

    if (this.engineTrailTimer < 18) return;
    this.engineTrailTimer = 0;

    const shipAngle = this.playerVisual.rotation - Math.PI / 2;
    const rearDistance = 20;

    const baseX = this.player.x - Math.cos(shipAngle) * rearDistance;
    const baseY = this.player.y - Math.sin(shipAngle) * rearDistance;

    const jitterX = Phaser.Math.Between(-2, 2);
    const jitterY = Phaser.Math.Between(-2, 2);

    const glow = this.add.ellipse(
      baseX + jitterX,
      baseY + jitterY,
      Phaser.Math.Between(12, 20),
      Phaser.Math.Between(18, 26),
      0x38bdf8,
      0.22
    );
    glow.setDepth(1);
    glow.rotation = shipAngle + Math.PI / 2;

    const core = this.add.ellipse(
      baseX + jitterX,
      baseY + jitterY,
      Phaser.Math.Between(4, 7),
      Phaser.Math.Between(10, 16),
      0xe0f2fe,
      0.9
    );
    core.setDepth(1);
    core.rotation = shipAngle + Math.PI / 2;

    this.tweens.add({
      targets: glow,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => glow.destroy()
    });

    this.tweens.add({
      targets: core,
      alpha: 0,
      scaleX: 0.2,
      scaleY: 0.2,
      duration: 140,
      ease: 'Quad.easeOut',
      onComplete: () => core.destroy()
    });
  }

  autoShoot(time) {
    shootEquippedWeapon(this, time);
  }

  updateEnemyProjectiles(delta) {
    const dt = delta / 1000;
    this.enemyProjectiles.getChildren().forEach((projectile) => {
      if (!projectile.active) return;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.life -= delta;
      projectile.trailTimer += delta;

      // Suivi du halo (projectiles shooter)
      if (projectile._halo?.active) {
        projectile._halo.x = projectile.x;
        projectile._halo.y = projectile.y;
      }

      if (projectile.trailTimer > 35) {
        projectile.trailTimer = 0;
        const trail = this.add.circle(projectile.x, projectile.y, projectile.radius || 3, 0x38bdf8, 0.35);
        this.tweens.add({ targets: trail, alpha: 0, scale: 0.3, duration: 180, onComplete: () => trail.destroy() });
      }
      if (projectile.life <= 0) {
        projectile._halo?.destroy();
        this.destroyEntity(projectile, this.enemyProjectiles);
      }
    });
  }

  moveBullets(delta) {
    const dt = delta / 1000;

    this.bullets.getChildren().forEach((bullet) => {
      if (!bullet.active) return;

      bullet.x += bullet.vx * dt;
      bullet.y += bullet.vy * dt;

      bullet.trailTimer += delta;

      if (bullet.trailTimer > 20) {
        bullet.trailTimer = 0;

        const trailGlow = this.add.ellipse(bullet.x, bullet.y, 14, 6, 0x38bdf8, 0.18);
        trailGlow.rotation = bullet.rotation;

        const trailCore = this.add.rectangle(bullet.x, bullet.y, 8, 2, 0xe0f2fe, 0.75);
        trailCore.rotation = bullet.rotation;

        this.tweens.add({
          targets: trailGlow,
          alpha: 0,
          scaleX: 0.2,
          scaleY: 0.2,
          duration: 150,
          onComplete: () => trailGlow.destroy()
        });

        this.tweens.add({
          targets: trailCore,
          alpha: 0,
          scaleX: 0.2,
          duration: 140,
          onComplete: () => trailCore.destroy()
        });
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

          showFloatingText(this, enemy.x, enemy.y - 10, isCrit ? `CRIT ${dmg}` : `${dmg}`, {
            color: isCrit ? '#ff4040' : '#ffffff',
            fontSize: isCrit ? '22px' : '18px',
          });

          this.showImpact(enemy.x, enemy.y);
          this.flashEnemyHit(enemy);
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

  showImpact(x, y) {
    const impactGlow = this.add.circle(x, y, 10, 0x38bdf8, 0.22);
    const impactCore = this.add.circle(x, y, 4, 0xffffff, 0.95).setStrokeStyle(2, 0x7dd3fc);

    this.tweens.add({
      targets: impactGlow,
      alpha: 0,
      scale: 2.4,
      duration: 120,
      onComplete: () => impactGlow.destroy()
    });

    this.tweens.add({
      targets: impactCore,
      alpha: 0,
      scale: 1.8,
      duration: 100,
      onComplete: () => impactCore.destroy()
    });
  }

flashEnemyHit(enemy) {
  if (!enemy || !enemy.active || enemy.isDying) return;
  if (!enemy.visual || !enemy.visual.active) return;

  const visual = enemy.visual;

  visual.setTintFill(0xffffff);

  this.time.delayedCall(60, () => {
    if (visual.active) {
      visual.clearTint();
    }
  });

  this.tweens.killTweensOf(visual);

  const baseScaleX = enemy.baseScaleX ?? visual.scaleX;
  const baseScaleY = enemy.baseScaleY ?? visual.scaleY;

  visual.setScale(baseScaleX * 1.08, baseScaleY * 1.08);

  this.tweens.add({
    targets: visual,
    scaleX: baseScaleX,
    scaleY: baseScaleY,
    duration: 90,
    ease: 'Quad.easeOut',
    onComplete: () => {
      if (visual.active) {
        visual.clearTint();
      }
    }
  });
}


destroyEnemyOnPlayerHit(enemy) {
    if (!enemy || !enemy.active) return;

    const x = enemy.x;
    const y = enemy.y;

    const blastGlow = this.add.circle(x, y, 18, 0xfb923c, 0.28);
    const blastCore = this.add.circle(x, y, 8, 0xffffff, 0.95).setStrokeStyle(2, 0xf97316);

    this.tweens.add({
      targets: blastGlow,
      alpha: 0,
      scale: 2.2,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => blastGlow.destroy()
    });

    this.tweens.add({
      targets: blastCore,
      alpha: 0,
      scale: 1.6,
      duration: 120,
      ease: 'Quad.easeOut',
      onComplete: () => blastCore.destroy()
    });

    if (enemy.visual) {
      enemy.visual.destroy();
    }

    enemy.destroy();
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

  // Kamikaze : explosion AoE avant la mort
  if (enemy.enemyType === 'kamikaze') {
    triggerKamikazeExplosion(this, enemy);
  }

  const isHeavyEnemy = enemy.enemyType === 'tank' || enemy.enemyType === 'boss';
  const isBoss       = enemy.enemyType === 'boss';

  // Particules colorées par type + hitstop + screen shake (GameFeel)
  spawnKillParticles(this, x, y, enemy.enemyType, isBoss);
  triggerHitstop(this, isBoss ? 90 : isHeavyEnemy ? 70 : 45);
  this.cameras.main.shake(
    isBoss ? 140 : isHeavyEnemy ? 90 : 55,
    isBoss ? 0.006 : isHeavyEnemy ? 0.004 : 0.0018
  );

  this.score += 1;
  registerKill(this, x, y, enemy.enemyType);

  if (bullet && bullet.hitEnemies) {
    const multiKillCount = bullet.hitEnemies.size;
    if (multiKillCount >= 2) {
      this.showMultiKillText(x, y, multiKillCount);
    }
  }

  if (enemy.enemyType === 'boss') {
    onBossDeath(this, enemy);  // explosion + récompense + texte
  }

  this.tryDropCoin(x, y, enemy);

  if (enemy.visual?.active) {
    const targetScaleX = (enemy.baseScaleX ?? enemy.visual.scaleX) * 1.4;
    const targetScaleY = (enemy.baseScaleY ?? enemy.visual.scaleY) * 1.4;

    this.tweens.add({
      targets: enemy.visual,
      scaleX: targetScaleX,
      scaleY: targetScaleY,
      alpha: 0,
      duration: 120
    });
  }

  this.tweens.add({
    targets: enemy,
    scaleX: 1.8,
    scaleY: 1.8,
    alpha: 0,
    duration: 100,
    onComplete: () => this.destroyEntity(enemy, this.enemies),
  });
}
  tryDropCoin(x, y, enemy = null) {
  if (Math.random() > this.coinDropChance) return;

  const coin = this.add.circle(x, y, 6, 0xfacc15).setStrokeStyle(2, 0x7c5c00);
  const glow = this.add.circle(x, y, 10, 0xfacc15, 0.15);

  // Petit reflet interne pour rendre la rotation visible
  const shine = this.add.rectangle(x + 2, y - 2, 3, 8, 0xfff7cc, 0.85);
  shine.setAngle(25);

  glow.setDepth(coin.depth - 1);
  shine.setDepth(coin.depth + 1);

  coin.glow = glow;
  coin.shine = shine;
  coin.spawnTime = this.time.now;
  // Valeur selon le type d'ennemi
  coin.value = (enemy?.enemyType === 'tank') ? 2
             : (enemy?.enemyType === 'boss')  ? 3
             : 1;

  this.physics.add.existing(coin);
  coin.body.setAllowGravity(false);
  coin.body.setVelocity(0, 0);

  this.coinsGroup.add(coin);

  // Pulse glow
  coin.glowTween = this.tweens.add({
    targets: glow,
    scale: 1.4,
    alpha: 0,
    duration: 600,
    repeat: -1,
    yoyo: true
  });

  // Rotation visible via le reflet
  coin.spinTween = this.tweens.add({
    targets: shine,
    angle: 385,
    duration: 1200,
    repeat: -1,
    ease: 'Linear'
  });

  // Flottement léger
  coin.floatTween = this.tweens.add({
    targets: [coin, glow, shine],
    y: y - 5,
    duration: 850,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut'
  });
}

  updateCoins() {
  this.coinsGroup.getChildren().forEach((coin) => {
    if (!coin.active || !coin.body) return;

    const distance = Phaser.Math.Distance.Between(this.player.x, this.player.y, coin.x, coin.y);

    if (distance < this.coinPickupRadius) {
      this.collectCoin(coin);
      return;
    }

    const isMagnetized =
      this.time.now - coin.spawnTime > this.coinMagnetDelay &&
      distance <= this.coinMagnetRadius;

    if (isMagnetized) {
      if (coin.floatTween) {
        coin.floatTween.stop();
        coin.floatTween.remove();
        coin.floatTween = null;
      }

      const magnetAngle = Phaser.Math.Angle.Between(coin.x, coin.y, this.player.x, this.player.y);
      const magnetStrength = 1 - distance / this.coinMagnetRadius;
      const currentMagnetSpeed = this.coinMagnetSpeed * (0.35 + magnetStrength);

      coin.body.setVelocity(
        Math.cos(magnetAngle) * currentMagnetSpeed,
        Math.sin(magnetAngle) * currentMagnetSpeed
      );
    } else {
      coin.body.setVelocity(0, 0);
    }

    if (coin.glow?.active) {
      coin.glow.setPosition(coin.x, coin.y);
    }

    if (coin.shine?.active) {
      coin.shine.setPosition(coin.x + 2, coin.y - 2);
    }
  });
}

  collectCoin(coin) {
  if (!coin || !coin.active) return;

  this.coins += coin.value || 1;
  this.syncCoinsToStorage();
  refreshGameHUD(this);

  this.sound.play('coin', {
    volume: 0.22,
    rate: Phaser.Math.FloatBetween(0.96, 1.04)
  });

  const pickupText = this.add.text(coin.x, coin.y - 16, '+1', {
    fontSize: '18px',
    color: '#facc15',
    fontStyle: 'bold'
  }).setOrigin(0.5);

  this.tweens.add({
    targets: pickupText,
    y: pickupText.y - 18,
    alpha: 0,
    duration: 500,
    onComplete: () => pickupText.destroy()
  });

  if (coin.glowTween) {
    coin.glowTween.stop();
    coin.glowTween.remove();
  }

  if (coin.spinTween) {
    coin.spinTween.stop();
    coin.spinTween.remove();
  }

  if (coin.floatTween) {
    coin.floatTween.stop();
    coin.floatTween.remove();
  }

  if (coin.glow?.active) {
    coin.glow.destroy();
  }

  if (coin.shine?.active) {
    coin.shine.destroy();
  }

  this.destroyEntity(coin, this.coinsGroup);
}

  showMultiKillText(x, y, count) {
    showFloatingText(this, x, y - 26, `${count} HIT`, { color: '#60a5fa', fontSize: '18px' });
  }

  checkCollisions(time) {
    let highestDamage = 0;
    const collidedEnemies = [];

    this.enemies.getChildren().forEach((enemy) => {
      if (!enemy.active) return;
      // Le boss gère ses propres interactions via BossSystem (shockwave)
      if (enemy.enemyType === 'boss') return;

      const distance = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        enemy.x,
        enemy.y
      );

      const playerRadius = this.player.collisionRadius || 14;
      const enemyRadius = enemy.collisionRadius || 12;

      if (distance <= playerRadius + enemyRadius) {
        highestDamage = Math.max(highestDamage, enemy.damage || 1);
        collidedEnemies.push(enemy);
      }
    });

    this.enemyProjectiles.getChildren().forEach((projectile) => {
      if (!projectile.active) return;

      const distance = Phaser.Math.Distance.Between(
        projectile.x,
        projectile.y,
        this.player.x,
        this.player.y
      );

      if (distance < this.player.collisionRadius + 6) {
        highestDamage = Math.max(highestDamage, projectile.damage || 8);
        this.destroyEntity(projectile, this.enemyProjectiles);
      }
    });

    if (highestDamage > 0 && time > this.damageCooldown) {
      this.damageCooldown = time + 250;

      // Bouclier absorbe le hit si chargé
      const absorbed = tryShieldAbsorb(this);
      if (!absorbed) {
        this.playerLife -= highestDamage;
        this.sound.play('player-explosion', {
          volume: 0.12,
          rate: Phaser.Math.FloatBetween(1.05, 1.18)
        });
        // Flash rouge + shake + vignette (GameFeel)
        triggerPlayerHitEffect(this, highestDamage);
      } else {
        // Petit effet visuel bouclier absorbé
        this.cameras.main.shake(60, 0.002);
      }

      collidedEnemies.forEach((enemy) => {
        if (!enemy.active) return;
        this.destroyEnemyOnPlayerHit(enemy);
      });

      if (this.playerLife <= 0) this.endGame();
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
      const outOfBounds = projectile.x < -60 || projectile.x > this.width + 60 || projectile.y < -60 || projectile.y > this.height + 60;
      if (outOfBounds) {
        projectile._halo?.destroy();
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
    if (this.isBossLevel) return;
    const params = getDifficultyParams(this.currentLevel);
    // Légère accélération en cours de niveau (max -15% de l'intervalle de base)
    const timeBonus = Math.min(this.levelTimer * 1.2, params.spawnMs * 0.15);
    this.spawnInterval = Math.max(380, params.spawnMs - timeBonus);
    this.enemySpeed    = params.enemySpeed;
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

  endGame() {
    stopLaserBeam(this);

    if (this.gameOver) return;
    this.gameOver = true;
    this.persistRunCoins();

    if (this.player?.body) this.player.body.setVelocity(0, 0);
    this.enemies.getChildren().forEach((enemy) => enemy.body && enemy.body.setVelocity(0, 0));
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

    playSfx(this, 'gameOver');

    const progress = loadProgress();
    this.registry.set('currentLevel', progress.checkpointLevel || 1);

    showGameOverOverlay(this);
  }
}
