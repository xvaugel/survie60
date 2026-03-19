// ============================================================
//  GameFeel.js — Système de sensations de jeu
//  Importer et appeler initGameFeel(scene) dans create()
//
//  Fournit :
//    · Hitstop           — freeze bref sur kill
//    · Screen shake      — déjà présent, amélioré
//    · Particules kills  — gerbe colorée par type ennemi
//    · Flash joueur      — rouge + chromatic sur dégâts reçus
//    · Combo             — multiplicateur x1→x4 avec UI
//    · Kill streak       — textes "DOUBLE / TRIPLE / RAMPAGE"
//    · Screenshake dégât — plus violent sur hit joueur
// ============================================================

// ── Couleurs par type d'ennemi ────────────────────────────────
const ENEMY_COLORS = {
  normal:  { main: 0xef4444, secondary: 0xff8888 },
  fast:    { main: 0xf97316, secondary: 0xffd580 },
  shooter: { main: 0x38bdf8, secondary: 0x90e0ff },
  tank:    { main: 0x8b5cf6, secondary: 0xc4b5fd },
  boss:    { main: 0xff2d55, secondary: 0xff90a8 },
};

// ── Initialisation ────────────────────────────────────────────
export function initGameFeel(scene) {
  // État combo
  scene.gf = {
    combo:          0,
    comboTimer:     null,
    comboDecayMs:   2200,    // temps avant que le combo retombe
    lastKillTime:   0,
    streakCount:    0,
    hitstopActive:  false,
    comboText:      null,
    comboBarBg:     null,
    comboBarFill:   null,
  };

  _buildComboUI(scene);
}

// ═══════════════════════════════════════════════════════════
//  HITSTOP — gèle le jeu 1-3 frames sur un kill
// ═══════════════════════════════════════════════════════════
export function triggerHitstop(scene, durationMs = 55) {
  if (scene.gf?.hitstopActive) return;
  scene.gf.hitstopActive = true;

  // Phaser n'a pas de timeScale global facile, on simule via physics pause
  scene.physics.pause();

  scene.time.delayedCall(durationMs, () => {
    if (scene.physics) scene.physics.resume();
    if (scene.gf) scene.gf.hitstopActive = false;
  });
}

// ═══════════════════════════════════════════════════════════
//  PARTICULES D'EXPLOSION — gerbe colorée par type
// ═══════════════════════════════════════════════════════════
export function spawnKillParticles(scene, x, y, enemyType, isBoss) {
  const colors   = ENEMY_COLORS[enemyType] || ENEMY_COLORS.normal;
  const count    = isBoss ? 28 : (enemyType === 'tank' ? 20 : 14);
  const maxDist  = isBoss ? 110 : (enemyType === 'tank' ? 80 : 60);

  // Son d'explosion
  scene.sound?.play?.('rouge-explosion', {
    volume: isBoss ? 0.18 : (enemyType === 'tank' ? 0.14 : 0.10),
    rate:   Phaser.Math.FloatBetween(0.9, 1.1),
  });
  const maxSpeed = isBoss ? 320 : 240;

  // Éclat central coloré
  const burst = scene.add.circle(x, y, isBoss ? 40 : 28, colors.main, 0.35).setDepth(880);
  scene.tweens.add({
    targets: burst, scale: isBoss ? 6 : 4.5, alpha: 0,
    duration: isBoss ? 350 : 260, ease: 'Quad.Out',
    onComplete: () => burst.destroy(),
  });

  // Anneau de shockwave
  const ring = scene.add.circle(x, y, isBoss ? 22 : 16, 0x000000, 0).setDepth(885);
  ring.setStrokeStyle(isBoss ? 4 : 3, colors.main, 0.7);
  scene.tweens.add({
    targets: ring, scale: isBoss ? 4.5 : 3.2, alpha: 0,
    duration: isBoss ? 320 : 250, ease: 'Quad.Out',
    onComplete: () => ring.destroy(),
  });

  // Flash blanc
  const flash = scene.add.circle(x, y, isBoss ? 20 : 14, 0xffffff, 1).setDepth(900);
  scene.tweens.add({
    targets: flash, scale: isBoss ? 3 : 2.2, alpha: 0,
    duration: 100, ease: 'Quad.Out',
    onComplete: () => flash.destroy(),
  });

  // Particules principales
  for (let i = 0; i < count; i++) {
    const big    = i < count * 0.3;
    const radius = Phaser.Math.Between(big ? 3 : 2, big ? 6 : 4);
    const color  = big ? colors.main : colors.secondary;
    const p      = scene.add.circle(x, y, radius, color, 1).setDepth(895);

    const angle = (i / count) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.3, 0.3);
    const dist  = Phaser.Math.Between(maxDist * 0.4, maxDist);
    const dur   = Phaser.Math.Between(280, 480);

    scene.tweens.add({
      targets: p,
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      alpha: 0, scale: 0.1,
      duration: dur, ease: 'Quad.Out',
      onComplete: () => p.destroy(),
    });
  }

  // Étincelles longues (lignes qui partent en étoile)
  const sparkCount = isBoss ? 10 : 6;
  for (let i = 0; i < sparkCount; i++) {
    const angle  = (i / sparkCount) * Math.PI * 2;
    const length = Phaser.Math.Between(24, maxDist * 0.7);
    const spark  = scene.add.graphics().setDepth(890);
    spark.lineStyle(isBoss ? 2 : 1.5, colors.secondary, 0.9);
    spark.lineBetween(0, 0, Math.cos(angle) * length, Math.sin(angle) * length);
    spark.x = x; spark.y = y;
    scene.tweens.add({
      targets: spark, alpha: 0, scale: 1.2,
      duration: Phaser.Math.Between(180, 320), ease: 'Quad.Out',
      onComplete: () => spark.destroy(),
    });
  }
}

// ═══════════════════════════════════════════════════════════
//  FLASH JOUEUR — rouge + shake violent sur dégâts reçus
// ═══════════════════════════════════════════════════════════
export function triggerPlayerHitEffect(scene, damage) {
  // Shake plus fort selon les dégâts
  const intensity = Math.min(0.006 + damage * 0.0008, 0.016);
  scene.cameras.main.shake(160, intensity);

  // Flash rouge sur tout l'écran
  const flash = scene.add.rectangle(
    scene.centerX, scene.centerY,
    scene.scale.width, scene.scale.height,
    0xff0000, 0.28
  ).setDepth(1200).setScrollFactor(0);

  scene.tweens.add({
    targets: flash, alpha: 0, duration: 280, ease: 'Quad.Out',
    onComplete: () => flash.destroy(),
  });

  // Flash blanc sur le vaisseau (playerVisual est un Container → tint sur les enfants)
  if (scene.playerVisual?.active) {
    (scene.playerVisual.list || []).forEach(child => child.setTintFill?.(0xffffff));
    scene.time.delayedCall(80, () => {
      if (scene.playerVisual?.active) {
        (scene.playerVisual.list || []).forEach(child => child.clearTint?.());
      }
    });
  }

  // Vignette rouge temporaire
  const vignette = scene.add.graphics().setDepth(1199).setScrollFactor(0);
  vignette.fillStyle(0xff0000, 0.15);
  vignette.fillRect(0, 0, scene.scale.width, scene.scale.height);
  scene.tweens.add({
    targets: vignette, alpha: 0, duration: 600, ease: 'Quad.Out',
    onComplete: () => vignette.destroy(),
  });
}

// ═══════════════════════════════════════════════════════════
//  COMBO — multiplicateur avec UI et decay
// ═══════════════════════════════════════════════════════════
export function registerKill(scene, x, y, enemyType) {
  const gf  = scene.gf;
  const now = scene.time.now;

  // Incrément combo
  gf.combo      = Math.min(gf.combo + 1, 20);
  gf.streakCount++;
  gf.lastKillTime = now;

  // Reset le timer de decay
  if (gf.comboTimer) gf.comboTimer.remove();
  gf.comboTimer = scene.time.delayedCall(gf.comboDecayMs, () => {
    _decayCombo(scene);
  });

  // Multiplicateur (paliers 4 / 8 / 12 / 16+)
  const mult = _getMultiplier(gf.combo);

  // Texte kill streak (DOUBLE, TRIPLE…)
  const streakLabel = _getStreakLabel(gf.streakCount);
  if (streakLabel) {
    _showStreakText(scene, x, y, streakLabel, gf.streakCount);
  }

  // Mise à jour UI combo
  _updateComboUI(scene, gf.combo, mult);
}

function _decayCombo(scene) {
  const gf = scene.gf;
  gf.combo      = 0;
  gf.streakCount = 0;
  _updateComboUI(scene, 0, 1);
}

function _getMultiplier(combo) {
  if (combo >= 16) return 4;
  if (combo >= 8)  return 3;
  if (combo >= 4)  return 2;
  return 1;
}

function _getStreakLabel(streak) {
  if (streak === 2)  return 'DOUBLE';
  if (streak === 3)  return 'TRIPLE';
  if (streak === 5)  return 'RAMPAGE';
  if (streak === 10) return 'UNSTOPPABLE';
  if (streak === 20) return '★ GODLIKE ★';
  return null;
}

function _showStreakText(scene, x, y, label, streak) {
  const colors = ['#ffffff','#ffffff','#facc15','#f97316','#ef4444','#ff00ff'];
  const color  = colors[Math.min(Math.floor(streak / 3), colors.length - 1)];
  const size   = 18 + Math.min(streak * 1.5, 14);

  // Texte principal
  const t = scene.add.text(x, y - 40, label, {
    fontFamily: '"Courier New", Courier, monospace',
    fontStyle:  'bold',
    fontSize:   `${size}px`,
    color,
    stroke:          '#000000',
    strokeThickness: 3,
  }).setOrigin(0.5).setDepth(1000);

  scene.tweens.add({
    targets: t,
    y:       y - 90,
    alpha:   0,
    scaleX:  1.3, scaleY: 1.3,
    duration: 900,
    ease:    'Quad.Out',
    onComplete: () => t.destroy(),
  });
}

// ── UI Combo ──────────────────────────────────────────────────
function _buildComboUI(scene) {
  const gf = scene.gf;
  const x  = scene.scale.width - 160;
  const y  = scene.scale.height - 90;

  // Fond du compteur combo
  const bg = scene.add.graphics().setDepth(1005).setScrollFactor(0);
  bg.fillStyle(0x070e1c, 0.82);
  bg.fillRoundedRect(x - 10, y - 8, 148, 60, 8);
  bg.lineStyle(1, 0x1a3652, 0.6);
  bg.strokeRoundedRect(x - 10, y - 8, 148, 60, 8);

  // Label "COMBO"
  scene.add.text(x, y, 'COMBO', {
    fontFamily: '"Courier New", Courier, monospace',
    fontStyle:  'bold',
    fontSize:   '10px',
    color:      '#3a6a88',
  }).setDepth(1006).setScrollFactor(0);

  // Valeur du multiplicateur
  gf.comboText = scene.add.text(x + 128, y + 18, 'x1', {
    fontFamily: '"Courier New", Courier, monospace',
    fontStyle:  'bold',
    fontSize:   '26px',
    color:      '#3a6a88',
  }).setOrigin(1, 0.5).setDepth(1006).setScrollFactor(0);

  // Barre de progression combo
  const barX = x, barY = y + 34, barW = 128, barH = 8;

  const barBg = scene.add.graphics().setDepth(1005).setScrollFactor(0);
  barBg.fillStyle(0x020811, 0.9);
  barBg.fillRoundedRect(barX, barY, barW, barH, 4);
  barBg.lineStyle(1, 0x1a3652, 0.4);
  barBg.strokeRoundedRect(barX, barY, barW, barH, 4);

  gf.comboBarFill = scene.add.graphics().setDepth(1006).setScrollFactor(0);
  gf.comboBg      = bg;
  gf.comboBarX    = barX;
  gf.comboBarY    = barY;
  gf.comboBarW    = barW;
  gf.comboBarH    = barH;
}

function _updateComboUI(scene, combo, mult) {
  const gf = scene.gf;
  if (!gf.comboText) return;

  const colors = {
    1: { text: '#3a6a88', bar: 0x1a4a7a },
    2: { text: '#facc15', bar: 0xd4a000 },
    3: { text: '#f97316', bar: 0xd45a00 },
    4: { text: '#ef4444', bar: 0xcc0000 },
  };
  const c = colors[mult] || colors[1];

  gf.comboText.setText(`x${mult}`).setColor(c.text);

  // Barre : progression dans le palier actuel
  const paliers = [0, 4, 8, 12, 16, 20];
  const palierIdx  = mult - 1;
  const palierMin  = paliers[palierIdx] || 0;
  const palierMax  = paliers[palierIdx + 1] || 20;
  const progress   = Math.min((combo - palierMin) / (palierMax - palierMin), 1);
  const fillW      = Math.max(0, Math.floor(gf.comboBarW * progress));

  gf.comboBarFill.clear();
  if (fillW > 0) {
    gf.comboBarFill.fillStyle(c.bar, 0.9);
    gf.comboBarFill.fillRoundedRect(gf.comboBarX, gf.comboBarY, fillW, gf.comboBarH, 4);
  }

  // Pulse le texte à chaque combo
  if (combo > 0) {
    scene.tweens.add({
      targets:  gf.comboText,
      scaleX:   { from: 1.3, to: 1 },
      scaleY:   { from: 1.3, to: 1 },
      duration: 200,
      ease:     'Back.Out',
    });
  }
}

// ── Export utilitaire ─────────────────────────────────────────
export function getComboMultiplier(scene) {
  return _getMultiplier(scene.gf?.combo || 0);
}
