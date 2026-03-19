import { playMusic, stopMusic, playSfx, getBossMusicKey } from './AudioConfig.js';

// ============================================================
//  BossSystem.js — Boss en 3 phases avec mise en scène
//
//  API publique :
//    initBossLevel(scene)        — appelé quand isBossLevel
//    updateBoss(scene, time, delta) — appelé dans update()
//    onBossDeath(scene, boss)    — appelé depuis killEnemy()
// ============================================================

const FONT = { fontFamily: '"Courier New", Courier, monospace', fontStyle: 'bold' };

// ── Profil boss selon le niveau ───────────────────────────────
function getBossProfile(level) {
  const tier = Math.floor(level / 5);  // boss 1=tier1, boss 2=tier2...
  return {
    hp:          60 + tier * 20,
    speed:       32 + tier * 4,
    damage:      22 + tier * 3,
    bossReward:  25 + tier * 10,
    // sprite 512x512 → target ~170px tier1, +15px par tier
    scale:       (170 + tier * 15) / 512,
    color:       0x7f1d1d,
    // Paramètres de tir par phase
    phase1: { shotCount: 3, shotCooldown: 2000, orbitSpeed: 0.4 },
    phase2: { shotCount: 5, shotCooldown: 1400, orbitSpeed: 0.7 },
    phase3: { shotCount: 8, shotCooldown: 900,  orbitSpeed: 1.1 },
  };
}

// ─────────────────────────────────────────────────────────────
//  INIT — Mise en scène d'entrée du boss
// ─────────────────────────────────────────────────────────────
export function initBossLevel(scene) {
  scene.bossData = {
    boss:          null,
    phase:         1,
    lastShot:      0,
    lastMinion:    0,
    orbitAngle:    0,
    orbitRadius:   200,
    enraged:       false,
    shakeTimer:    0,
    profile:       getBossProfile(scene.currentLevel),
    introComplete:   false,
    shockwaveTimer:  0,     // cooldown shockwave de répulsion
    shockwaveReady:  true,
  };

  // Couper la musique de niveau (fondu)
  scene.stopGameplayMusic?.();

  // Overlay "BOSS INCOMING"
  _playBossIntro(scene);
}

function _playBossIntro(scene) {
  const W  = scene.scale.width;
  const H  = scene.scale.height;
  const cx = scene.centerX;
  const cy = scene.centerY;

  // Fond flash rouge
  const flash = scene.add.rectangle(cx, cy, W, H, 0x660000, 0)
    .setDepth(1100).setScrollFactor(0);

  scene.tweens.add({
    targets: flash, fillAlpha: 0.45, duration: 200,
    yoyo: true, repeat: 2,
    onComplete: () => flash.destroy(),
  });

  // Texte "BOSS INCOMING"
  const warning = scene.add.text(cx, cy - 60, '⚠ BOSS INCOMING ⚠', {
    ...FONT, fontSize: '36px', color: '#ff2244',
    stroke: '#000000', strokeThickness: 6,
  }).setOrigin(0.5).setDepth(1200).setScrollFactor(0).setAlpha(0);

  const sub = scene.add.text(cx, cy, `NIVEAU ${scene.currentLevel}`, {
    ...FONT, fontSize: '20px', color: '#ff8844',
  }).setOrigin(0.5).setDepth(1200).setScrollFactor(0).setAlpha(0);

  scene.tweens.add({
    targets: [warning, sub], alpha: 1, duration: 300, ease: 'Quad.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: [warning, sub], alpha: 0, duration: 600, delay: 2800,
        onComplete: () => { warning.destroy(); sub.destroy(); _spawnBossWithEntrance(scene); },
      });
    },
  });

  // Son boss-intro si disponible, sinon shake caméra
  if (scene.cache.audio.exists('boss-intro')) {
    scene.sound.play('boss-intro', { volume: 0.6 });
  } else {
    scene.cameras.main.shake(300, 0.008);
  }
}

function _spawnBossWithEntrance(scene) {
  const W  = scene.scale.width;
  const H  = scene.scale.height;
  const cx = scene.centerX;
  const profile = scene.bossData.profile;

  // Spawner hors écran en haut
  const startX = cx;
  const startY = -80;

  // Créer le boss
  const boss = scene.add.circle(startX, startY, 44, profile.color, 0.01);
  scene.physics.add.existing(boss);
  boss.body.setAllowGravity(false);
  boss.body.setEnable(false);

  boss.enemyType     = 'boss';
  boss.hp            = profile.hp;
  boss.maxHp         = profile.hp;
  boss.damage        = profile.damage;
  boss.speed         = profile.speed;
  boss.scoreValue    = 25;
  boss.collisionRadius = 44;
  boss.bossReward    = profile.bossReward;
  boss.spawnCooldown = 0;
  boss.lastSpawnTime = 0;
  boss.zigzagAmplitude = 0;
  boss.zigzagFrequency = 0;
  boss.preferredRange  = 0;
  boss.shootCooldownMs = 0;
  boss.lastShootTime   = 0;
  boss.chargeSpeed     = 0;
  boss.chargeRange     = 0;
  boss.explosionRadius = 0;
  boss.isCharging      = false;

  // Visual — utilise le sprite si disponible
  boss.visual = scene.createEnemyVisual('boss', startX, startY);
  if (boss.visual) {
    boss.visual.setScale(profile.scale);
    boss.baseScaleX = boss.visual.scaleX;
    boss.baseScaleY = boss.visual.scaleY;
    // Ajuster le rayon de collision au vrai visuel
    boss.collisionRadius = Math.round(profile.scale * 512 * 0.28);
  }

  scene.enemies.add(boss);
  scene.bossData.boss = boss;

  // Animation d'entrée — animer seulement le cercle physique
  // Le visual est synchronisé manuellement à chaque frame
  const targetY = H * 0.22;
  scene.tweens.add({
    targets: boss,   // seulement le cercle, pas le visual
    y: targetY, duration: 2800, ease: 'Quad.Out',
    onUpdate: () => {
      // Sync visuel pendant l'entrée
      if (boss.visual?.active) {
        boss.visual.x = boss.x;
        boss.visual.y = boss.y;
      }
    },
    onComplete: () => {
      // Activer la physique maintenant que l'intro est terminée
      boss.body.setEnable(true);
      boss.body.reset(boss.x, boss.y);
      scene.bossData.introComplete = true;
      scene.cameras.main.shake(250, 0.006);
      // Lancer la musique du boss
      const bossMusicKey = getBossMusicKey(scene.currentLevel);
      playMusic(scene, bossMusicKey);
      _buildBossHPBar(scene, boss);
    },
  });
}

// ─────────────────────────────────────────────────────────────
//  BARRE DE VIE DU BOSS
// ─────────────────────────────────────────────────────────────
function _buildBossHPBar(scene, boss) {
  const SW  = scene.scale.width;
  const bW  = Math.round(SW * 0.55);  // plus large
  const bH  = 20;                      // plus haute
  const bX  = Math.round((SW - bW) / 2);
  const bY  = 82;  // sous le HUD (blocs HUD = ~74px)

  // Cacher les éléments HUD de niveau/timer sur boss level
  if (scene.gameHUD?.levelText) scene.gameHUD.levelText.setVisible(false);
  if (scene.gameHUD?.timeText)  scene.gameHUD.timeText.setVisible(false);
  if (scene.levelTextUI)        scene.levelTextUI.setVisible(false);

  // Fond barre avec label "BOSS LVL XX" à gauche
  const nameT = scene.add.text(bX, bY - 18,
    `⚔ BOSS — NIVEAU ${scene.currentLevel}`, {
    ...FONT, fontSize: '14px', color: '#ff4466',
  }).setOrigin(0, 1).setDepth(1052).setScrollFactor(0);

  // HP restants à droite
  const hpT = scene.add.text(bX + bW, bY - 18, '', {
    ...FONT, fontSize: '14px', color: '#ff8899',
  }).setOrigin(1, 1).setDepth(1052).setScrollFactor(0);

  const trackG = scene.add.graphics().setDepth(1050).setScrollFactor(0);
  trackG.fillStyle(0x0a0a0a, 0.92);
  trackG.fillRoundedRect(bX - 2, bY - 2, bW + 4, bH + 4, 8);
  trackG.lineStyle(2, 0xff2244, 0.5);
  trackG.strokeRoundedRect(bX - 2, bY - 2, bW + 4, bH + 4, 8);

  // Fill barre
  const fillG = scene.add.graphics().setDepth(1051).setScrollFactor(0);

  scene.bossData.hpBar = { trackG, fillG, nameT, hpT, bX, bY, bW, bH };
  _updateBossHPBar(scene);
}

function _updateBossHPBar(scene) {
  const bd   = scene.bossData;
  if (!bd?.hpBar || !bd.boss) return;

  const { fillG, hpT, bX, bY, bW, bH } = bd.hpBar;
  const ratio  = Phaser.Math.Clamp(bd.boss.hp / bd.boss.maxHp, 0, 1);
  const fillW  = Math.max(0, Math.floor(bW * ratio));
  const hpLeft = Math.max(0, Math.ceil(bd.boss.hp));

  // Couleur selon phase (change visuellement sans annoncer la phase)
  const color = bd.phase === 3 ? 0xff2244
              : bd.phase === 2 ? 0xff8844
              : 0xff4466;

  fillG.clear();
  if (fillW > 0) {
    fillG.fillStyle(color, 0.9);
    fillG.fillRoundedRect(bX, bY, fillW, bH, 6);
    // Reflet
    fillG.fillStyle(0xffffff, 0.12);
    fillG.fillRoundedRect(bX, bY, fillW, Math.floor(bH * 0.35), 6);
    // Segment de brillance animé (tick tous les 500ms environ)
    const tick = Math.floor(Date.now() / 500) % 2;
    if (tick && fillW > 20) {
      fillG.fillStyle(0xffffff, 0.08);
      fillG.fillRect(bX + 4, bY + 2, fillW - 8, bH - 4);
    }
  }

  // HP numériques
  if (hpT) hpT.setText(`${hpLeft} HP`);


}

// ─────────────────────────────────────────────────────────────
//  UPDATE — Logique de comportement par phase
// ─────────────────────────────────────────────────────────────
export function updateBoss(scene, time, delta) {
  const bd   = scene.bossData;
  if (!bd || !bd.boss?.active || !bd.introComplete) return;

  const boss    = bd.boss;
  const profile = bd.profile;
  const ratio   = boss.hp / boss.maxHp;

  // ── Détection de changement de phase ─────────────────────
  const newPhase = ratio > 0.6 ? 1 : ratio > 0.3 ? 2 : 3;
  if (newPhase !== bd.phase) {
    _onPhaseChange(scene, bd, newPhase);
  }
  bd.phase = newPhase;

  // Params de la phase courante
  const phParams = profile[`phase${bd.phase}`];

  // ── Mouvement selon la phase ──────────────────────────────
  if (bd.phase === 1) {
    // Phase 1 : orbite autour du centre de l'écran
    bd.orbitAngle += phParams.orbitSpeed * (delta / 1000);
    const tx = scene.centerX + Math.cos(bd.orbitAngle) * bd.orbitRadius;
    const ty = scene.centerY * 0.4 + Math.sin(bd.orbitAngle * 0.5) * 60;
    _moveToward(boss, tx, ty, profile.speed, delta);

  } else if (bd.phase === 2) {
    // Phase 2 : orbite + charges occasionnelles vers le joueur
    bd.orbitAngle += phParams.orbitSpeed * (delta / 1000);
    if (!bd.charging) {
      const tx = scene.centerX + Math.cos(bd.orbitAngle) * (bd.orbitRadius * 0.8);
      const ty = scene.centerY * 0.35 + Math.sin(bd.orbitAngle * 0.7) * 80;
      _moveToward(boss, tx, ty, profile.speed * 1.3, delta);
      // Déclencher une charge toutes les 4s
      if (!bd.lastCharge || time - bd.lastCharge > 4000) {
        bd.lastCharge = time;
        bd.charging = true;
        scene.time.delayedCall(800, () => { bd.charging = false; });
      }
    } else {
      // Charge vers le joueur
      _moveToward(boss, scene.player.x, scene.player.y, profile.speed * 3.5, delta);
    }

  } else {
    // Phase 3 : ENRAGÉ — fonce directement sur le joueur
    _moveToward(boss, scene.player.x, scene.player.y, profile.speed * 2.2, delta);

    // Tremblement du sprite
    bd.shakeTimer += delta;
    if (boss.visual?.active && bd.shakeTimer > 50) {
      bd.shakeTimer = 0;
      boss.visual.x = boss.x + Phaser.Math.Between(-2, 2);
      boss.visual.y = boss.y + Phaser.Math.Between(-2, 2);
    }

    // Vignette rouge pulsante
    if (!bd.vignetteTimer || time - bd.vignetteTimer > 1200) {
      bd.vignetteTimer = time;
      _pulseRedVignette(scene);
    }
  }

  // Sync visual position
  if (boss.visual?.active) {
    const angleToPlayer = Phaser.Math.Angle.Between(boss.x, boss.y, scene.player.x, scene.player.y);
    if (bd.phase === 3) {
      // Phase 3 : shake léger autour de la position réelle
      boss.visual.x = boss.x + Phaser.Math.Between(-2, 2);
      boss.visual.y = boss.y + Phaser.Math.Between(-2, 2);
    } else {
      boss.visual.x = boss.x;
      boss.visual.y = boss.y;
    }
    boss.visual.rotation = angleToPlayer + Math.PI / 2;
  }

  // ── Shockwave de répulsion ────────────────────────────────
  _checkBossShockwave(scene, boss, bd, time, delta);

  // ── Tirs ─────────────────────────────────────────────────
  if (time - bd.lastShot > phParams.shotCooldown) {
    bd.lastShot = time;
    _bossShoot(scene, boss, phParams.shotCount, bd.phase);
  }

  // ── Spawn de minions ──────────────────────────────────────
  const minionCooldown = bd.phase === 3 ? 4000 : bd.phase === 2 ? 3000 : 99999;
  if (bd.phase >= 2 && time - bd.lastMinion > minionCooldown) {
    bd.lastMinion = time;
    _spawnBossMinion(scene, boss, bd.phase);
  }

  // ── Mise à jour barre de vie ──────────────────────────────
  _updateBossHPBar(scene);
}

// ─────────────────────────────────────────────────────────────
//  CHANGEMENT DE PHASE
// ─────────────────────────────────────────────────────────────
function _onPhaseChange(scene, bd, newPhase) {
  // Flash du boss
  if (bd.boss.visual?.active) {
    bd.boss.visual.setTintFill(0xffffff);
    scene.time.delayedCall(120, () => bd.boss.visual?.active && bd.boss.visual.clearTint());
  }

  // Shake caméra
  const intensity = newPhase === 3 ? 0.01 : 0.006;
  scene.cameras.main.shake(400, intensity);

  // Son de phase (pas de texte — le joueur voit la barre changer)
  // Son de phase 3 : utiliser le shake uniquement (pas de son 'bossRoar')
}

// ─────────────────────────────────────────────────────────────
//  SHOCKWAVE DE RÉPULSION
// ─────────────────────────────────────────────────────────────
function _checkBossShockwave(scene, boss, bd, time, delta) {
  const SHOCKWAVE_RADIUS  = 130;  // rayon déclencheur
  const SHOCKWAVE_COOLDOWN = 2000; // ms entre deux shockwaves
  const SHOCKWAVE_DAMAGE   = 8;
  const REPULSE_DIST       = 220;  // distance à laquelle le joueur est repoussé
  const REPULSE_DURATION   = 320;  // durée du tween de répulsion (ms)

  if (!bd.shockwaveReady) {
    bd.shockwaveTimer += delta;
    if (bd.shockwaveTimer >= SHOCKWAVE_COOLDOWN) {
      bd.shockwaveReady = true;
      bd.shockwaveTimer = 0;
    }
    return;
  }

  const dist = Phaser.Math.Distance.Between(
    boss.x, boss.y, scene.player.x, scene.player.y
  );
  if (dist > SHOCKWAVE_RADIUS) return;

  // Déclencher !
  bd.shockwaveReady = false;
  bd.shockwaveTimer = 0;

  // ── Visuel : onde de choc visible ───────────────────────
  const ring1 = scene.add.circle(boss.x, boss.y, 20, 0xff4466, 0).setDepth(800);
  ring1.setStrokeStyle(4, 0xff2244, 0.9);
  scene.tweens.add({
    targets: ring1, scaleX: 8, scaleY: 8, alpha: 0,
    duration: 380, ease: 'Quad.Out',
    onComplete: () => ring1.destroy(),
  });

  const ring2 = scene.add.circle(boss.x, boss.y, 20, 0xff8844, 0).setDepth(799);
  ring2.setStrokeStyle(2, 0xff8844, 0.6);
  scene.tweens.add({
    targets: ring2, scaleX: 12, scaleY: 12, alpha: 0,
    duration: 500, ease: 'Quad.Out',
    onComplete: () => ring2.destroy(),
  });

  // Flash sur le boss
  if (boss.visual?.active) {
    boss.visual.setTintFill(0xff6600);
    scene.time.delayedCall(100, () => boss.visual?.active && boss.visual.clearTint());
  }

  // Shake caméra léger
  scene.cameras.main.shake(180, 0.005);

  // ── Dégâts au joueur ────────────────────────────────────
  if (scene.playerLife > 0) {
    scene.playerLife = Math.max(0, scene.playerLife - SHOCKWAVE_DAMAGE);
    scene._triggerPlayerHit?.(SHOCKWAVE_DAMAGE);
  }

  // ── Répulsion : propulser le joueur à l'opposé du boss ──
  const angle = Phaser.Math.Angle.Between(boss.x, boss.y, scene.player.x, scene.player.y);
  const targetX = Phaser.Math.Clamp(
    scene.player.x + Math.cos(angle) * REPULSE_DIST,
    30, scene.scale.width - 30
  );
  const targetY = Phaser.Math.Clamp(
    scene.player.y + Math.sin(angle) * REPULSE_DIST,
    30, scene.scale.height - 30
  );

  // Bloquer les inputs pendant la répulsion
  scene._repulsed = true;
  if (scene.player.body) {
    scene.player.body.setVelocity(0, 0);
  }

  scene.tweens.add({
    targets: scene.player,
    x: targetX, y: targetY,
    duration: REPULSE_DURATION,
    ease: 'Quad.Out',
    onUpdate: () => {
      // Sync visuel pendant la répulsion
      if (scene.playerVisual?.active) {
        scene.playerVisual.x = scene.player.x;
        scene.playerVisual.y = scene.player.y;
      }
    },
    onComplete: () => {
      scene._repulsed = false;
    },
  });

  // Traînée de particules derrière le joueur pendant la répulsion
  for (let i = 0; i < 8; i++) {
    scene.time.delayedCall(i * 35, () => {
      if (!scene.player?.active) return;
      const spark = scene.add.circle(
        scene.player.x + Phaser.Math.Between(-8, 8),
        scene.player.y + Phaser.Math.Between(-8, 8),
        Phaser.Math.Between(2, 5), 0xff6644, 0.9
      ).setDepth(850);
      scene.tweens.add({
        targets: spark, alpha: 0, scale: 0.2, duration: 200,
        onComplete: () => spark.destroy(),
      });
    });
  }
}

// ─────────────────────────────────────────────────────────────
//  TIRS DU BOSS
// ─────────────────────────────────────────────────────────────
function _bossShoot(scene, boss, count, phase) {
  if (!scene.enemyProjectiles) return;

  const baseAngle = Phaser.Math.Angle.Between(boss.x, boss.y, scene.player.x, scene.player.y);

  // Phase 3 : rafale circulaire en plus du tir dirigé
  if (phase === 3) {
    // 8 projectiles en cercle
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      _spawnBossProjectile(scene, boss, angle, 220, 0xff2244);
    }
    return;
  }

  // Phases 1 & 2 : éventail centré sur le joueur
  const spread = phase === 2 ? 0.28 : 0.22;
  for (let i = 0; i < count; i++) {
    const offset = count === 1 ? 0 : (i / (count - 1) - 0.5) * spread * 2;
    _spawnBossProjectile(scene, boss, baseAngle + offset, 200, phase === 2 ? 0xff6633 : 0xff4455);
  }
}

function _spawnBossProjectile(scene, boss, angle, speed, color) {
  const proj = scene.add.circle(boss.x, boss.y, 7, color, 0.95).setDepth(4);
  scene.physics.add.existing(proj);
  proj.body.setAllowGravity(false);

  // Halo
  const halo = scene.add.circle(boss.x, boss.y, 14, color, 0.15).setDepth(3);
  proj._halo = halo;

  proj.vx       = Math.cos(angle) * speed;
  proj.vy       = Math.sin(angle) * speed;
  proj.damage   = 12;
  proj.life     = 4000;
  proj.radius   = 7;
  proj.trailTimer = 0;

  scene.enemyProjectiles.add(proj);
}

// ─────────────────────────────────────────────────────────────
//  MINIONS
// ─────────────────────────────────────────────────────────────
function _spawnBossMinion(scene, boss, phase) {
  const types  = phase === 3 ? ['kamikaze', 'fast'] : ['fast', 'fast'];
  const count  = phase === 3 ? 1 : 2;

  for (let i = 0; i < count; i++) {
    const angle  = (Math.PI * 2 * i / count) + Phaser.Math.FloatBetween(-0.3, 0.3);
    const dist   = 80;
    const sx     = boss.x + Math.cos(angle) * dist;
    const sy     = boss.y + Math.sin(angle) * dist;
    const type   = types[i % types.length];

    // Import dynamique évité — on appelle directement la fonction de spawn
    scene._spawnMinionFromBoss?.(type, sx, sy);
  }

  // Flash visuel sur le boss
  if (boss.visual?.active) {
    boss.visual.setTintFill(0xff8844);
    scene.time.delayedCall(100, () => boss.visual?.active && boss.visual.clearTint());
  }
}

// ─────────────────────────────────────────────────────────────
//  VIGNETTE ROUGE (phase 3)
// ─────────────────────────────────────────────────────────────
function _pulseRedVignette(scene) {
  const vign = scene.add.rectangle(
    scene.centerX, scene.centerY,
    scene.scale.width, scene.scale.height,
    0xff0000, 0.12
  ).setDepth(900).setScrollFactor(0);

  scene.tweens.add({
    targets: vign, alpha: 0, duration: 600, ease: 'Quad.Out',
    onComplete: () => vign.destroy(),
  });
}

// ─────────────────────────────────────────────────────────────
//  MORT DU BOSS
// ─────────────────────────────────────────────────────────────
export function onBossDeath(scene, boss) {
  const bd = scene.bossData;

  // Détruire la barre de vie + restaurer le HUD
  if (bd?.hpBar) {
    Object.values(bd.hpBar).forEach(obj => {
      if (obj?.destroy) obj.destroy();
    });
    bd.hpBar = null;
  }
  if (scene.gameHUD?.levelText) scene.gameHUD.levelText.setVisible(true);
  if (scene.gameHUD?.timeText)  scene.gameHUD.timeText.setVisible(true);
  if (scene.levelTextUI)        scene.levelTextUI.setVisible(true);

  // Son d'explosion boss (spécifique au niveau)
  const bossExpKey = `boss-level-${((Math.floor(scene.currentLevel / 5)) * 5) || 5}-explosion`;
  playSfx(scene, 'bossExplosion');

  // Explosion en 3 vagues
  _bossDeathExplosion(scene, boss.x, boss.y);

  // Récompense généreuse
  const reward = bd?.profile?.bossReward || 30;
  scene.coins += reward;
  scene.syncCoinsToStorage?.();

  // Texte de victoire
  const W = scene.scale.width;
  const t1 = scene.add.text(scene.centerX, scene.centerY - 60, 'BOSS VAINCU !', {
    ...FONT, fontSize: '40px', color: '#ffdd44',
    stroke: '#000000', strokeThickness: 7,
  }).setOrigin(0.5).setDepth(1200).setScrollFactor(0).setAlpha(0);

  const t2 = scene.add.text(scene.centerX, scene.centerY - 10, `+${reward} pièces`, {
    ...FONT, fontSize: '22px', color: '#f5a623',
  }).setOrigin(0.5).setDepth(1200).setScrollFactor(0).setAlpha(0);

  scene.tweens.add({
    targets: [t1, t2], alpha: 1, y: '-=20', duration: 400, ease: 'Back.Out',
  });
  scene.tweens.add({
    targets: [t1, t2], alpha: 0, duration: 600, delay: 2200,
    onComplete: () => { t1.destroy(); t2.destroy(); },
  });

  // Shake final
  scene.cameras.main.shake(500, 0.012);

  // Nettoyer bossData
  if (bd) bd.boss = null;

  // Fondu musique, puis écran de victoire épique
  scene.time.delayedCall(1800, () => stopMusic(scene));
  scene.time.delayedCall(3000, () => {
    scene._launchBossVictory?.(boss, bd);
  });
}

function _bossDeathExplosion(scene, x, y) {
  const W = scene.scale.width;
  const H = scene.scale.height;

  // ── PHASE 1 : Flash aveuglant + hitstop ──────────────────
  // Freeze visuel immédiat
  scene.physics.pause();
  scene.time.delayedCall(80, () => scene.physics.resume());

  // Écran blanc
  const whiteFlash = scene.add.rectangle(scene.centerX, scene.centerY, W, H, 0xffffff, 1)
    .setDepth(2000).setScrollFactor(0);
  scene.tweens.add({
    targets: whiteFlash, alpha: 0, duration: 350, ease: 'Quad.Out',
    onComplete: () => whiteFlash.destroy(),
  });

  // Shake très violent
  scene.cameras.main.shake(600, 0.022);

  // Flash central immédiat
  const coreFlash = scene.add.circle(x, y, 80, 0xffffff, 1).setDepth(1900);
  scene.tweens.add({
    targets: coreFlash, scaleX: 12, scaleY: 12, alpha: 0, duration: 400, ease: 'Expo.Out',
    onComplete: () => coreFlash.destroy(),
  });

  // ── PHASE 2 : 6 explosions secondaires en étoile (200-700ms) ─
  const secondaryColors = [0xff2244, 0xff8844, 0xffdd44, 0xff4488, 0xff6600, 0xff0088];
  for (let i = 0; i < 6; i++) {
    scene.time.delayedCall(200 + i * 80, () => {
      const angle = (Math.PI * 2 * i) / 6 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const dist  = Phaser.Math.Between(70, 140);
      const ex    = x + Math.cos(angle) * dist;
      const ey    = y + Math.sin(angle) * dist;
      const color = secondaryColors[i];

      // Boule principale
      const ball = scene.add.circle(ex, ey, 18, color, 0.95).setDepth(960);
      scene.tweens.add({
        targets: ball, scaleX: 5, scaleY: 5, alpha: 0, duration: 380, ease: 'Quad.Out',
        onComplete: () => ball.destroy(),
      });

      // Onde de choc de chaque explosion secondaire
      const ring = scene.add.circle(ex, ey, 10, 0x000000, 0).setDepth(955);
      ring.setStrokeStyle(3, color, 0.8);
      scene.tweens.add({
        targets: ring, scaleX: 6, scaleY: 6, alpha: 0, duration: 350, ease: 'Quad.Out',
        onComplete: () => ring.destroy(),
      });

      // Particules de chaque explosion secondaire
      for (let p = 0; p < 8; p++) {
        const pa    = (Math.PI * 2 * p) / 8;
        const pdist = Phaser.Math.Between(40, 110);
        const pt    = scene.add.circle(ex, ey, Phaser.Math.Between(3, 7), color, 1).setDepth(970);
        scene.tweens.add({
          targets: pt,
          x: ex + Math.cos(pa) * pdist,
          y: ey + Math.sin(pa) * pdist,
          alpha: 0, scaleX: 0.2, scaleY: 0.2,
          duration: Phaser.Math.Between(350, 600), ease: 'Quad.Out',
          onComplete: () => pt.destroy(),
        });
      }
    });
  }

  // ── PHASE 3 : Débris qui volent (600-1800ms) ─────────────
  scene.time.delayedCall(600, () => {
    // Gros débris rectangulaires (éclats de métal)
    for (let i = 0; i < 20; i++) {
      const angle  = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const speed  = Phaser.Math.Between(120, 320);
      const dw     = Phaser.Math.Between(4, 12);
      const dh     = Phaser.Math.Between(2, 6);
      const debris = scene.add.rectangle(x, y, dw, dh, 0xffd080, 0.95).setDepth(975);
      debris.rotation = Phaser.Math.FloatBetween(0, Math.PI * 2);

      scene.tweens.add({
        targets: debris,
        x: x + Math.cos(angle) * speed,
        y: y + Math.sin(angle) * speed,
        rotation: debris.rotation + Phaser.Math.FloatBetween(-4, 4),
        alpha: 0,
        duration: Phaser.Math.Between(600, 1100),
        ease: 'Quad.Out',
        onComplete: () => debris.destroy(),
      });
    }

    // Traînées lumineuses longues
    for (let i = 0; i < 12; i++) {
      const angle  = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const len    = Phaser.Math.Between(60, 180);
      const streak = scene.add.graphics().setDepth(965);
      const color  = i % 3 === 0 ? 0xffdd44 : i % 3 === 1 ? 0xff8844 : 0xff4455;
      streak.lineStyle(Phaser.Math.Between(1, 3), color, 0.9);
      streak.lineBetween(0, 0, Math.cos(angle) * len, Math.sin(angle) * len);
      streak.x = x; streak.y = y;
      scene.tweens.add({
        targets: streak, alpha: 0, scaleX: 1.4, scaleY: 1.4,
        duration: Phaser.Math.Between(400, 800), ease: 'Quad.Out',
        onComplete: () => streak.destroy(),
      });
    }
  });

  // ── PHASE 4 : Onde de choc finale + pulsations rouges ────
  scene.time.delayedCall(900, () => {
    // Grande onde de choc circulaire
    const shockwave = scene.add.circle(x, y, 20, 0x000000, 0).setDepth(940);
    shockwave.setStrokeStyle(6, 0xff2244, 0.9);
    scene.tweens.add({
      targets: shockwave,
      scaleX: W / 20, scaleY: W / 20,
      alpha: 0,
      duration: 1200, ease: 'Quad.Out',
      onComplete: () => shockwave.destroy(),
    });

    // 3 pulsations rouges de l'écran
    for (let i = 0; i < 3; i++) {
      scene.time.delayedCall(i * 300, () => {
        const pulse = scene.add.rectangle(scene.centerX, scene.centerY, W, H, 0xff0000, 0.18)
          .setDepth(1050).setScrollFactor(0);
        scene.tweens.add({
          targets: pulse, alpha: 0, duration: 280, ease: 'Quad.Out',
          onComplete: () => pulse.destroy(),
        });
      });
    }

    // Shake secondaire
    scene.time.delayedCall(100, () => scene.cameras.main.shake(400, 0.01));
  });

  // ── Anneau final doré (2s) ────────────────────────────────
  scene.time.delayedCall(1800, () => {
    const goldRing = scene.add.circle(x, y, 30, 0x000000, 0).setDepth(935);
    goldRing.setStrokeStyle(8, 0xffd700, 1);
    scene.tweens.add({
      targets: goldRing, scaleX: 14, scaleY: 14, alpha: 0,
      duration: 900, ease: 'Sine.Out',
      onComplete: () => goldRing.destroy(),
    });
  });
}

// ─────────────────────────────────────────────────────────────
//  HELPER mouvement
// ─────────────────────────────────────────────────────────────
function _moveToward(enemy, tx, ty, speed, delta) {
  const dx   = tx - enemy.x;
  const dy   = ty - enemy.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 4) return;
  const dt = delta / 1000;
  enemy.x += (dx / dist) * speed * dt;
  enemy.y += (dy / dist) * speed * dt;
  // Sync body avec la position
  if (enemy.body?.enable) {
    enemy.body.reset(enemy.x, enemy.y);
  }
}
