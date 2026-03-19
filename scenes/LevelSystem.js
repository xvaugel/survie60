import { openSupplyOverlay } from '../systems/SupplySystem.js';
// LevelSystem.js — ajout du déblocage des checkpoints dans unlockCheckpoint
import { loadProgress, saveProgress, unlockCheckpoint } from '../systems/storage.js';
// ShopSystem overlay remplacé par ShopScene

export function initLevelState(scene) {
  const progress        = loadProgress();
  const storedCheckpoint = Number.isFinite(progress.checkpointLevel) ? progress.checkpointLevel : 1;
  const registryLevel   = scene.registry.get('currentLevel');

  scene.currentLevel  = Number.isFinite(registryLevel) ? registryLevel : storedCheckpoint;
  scene.registry.set('currentLevel', scene.currentLevel);

  scene.levelDuration  = 10;
  scene.levelTimer     = 0;
  scene.isBossLevel    = scene.currentLevel % 5 === 0;
  scene.bossSpawned    = false;
  scene.levelCompleted = false;
}

export function createLevelUI(scene) {
  scene.levelTextUI = scene.add.text(scene.centerX, 92, `Niveau ${scene.currentLevel}`, {
    fontSize: '28px', color: '#c4b5fd', fontStyle: 'bold',
  }).setOrigin(0.5, 0).setDepth(900).setScrollFactor(0);

  scene.centerText = scene.add.text(
    scene.centerX, scene.centerY - 120,
    `Niveau ${scene.currentLevel}${scene.currentLevel === 1 ? ' — initiation' : ''}`,
    { fontSize: '28px', color: '#ffffff', align: 'center' }
  ).setOrigin(0.5).setDepth(900).setScrollFactor(0);

  scene.time.delayedCall(2200, () => scene.centerText?.destroy());
}

export function updateLevelTimer(scene, delta) {
  // Niveau boss : pas de timer — le niveau se termine uniquement quand le boss est mort
  if (scene.isBossLevel) {
    if (scene.timeText) scene.timeText.setText('BOSS');
    return false;
  }

  scene.levelTimer += delta / 1000;

  if (scene.timeText) {
    const remaining = Math.max(0, scene.levelDuration - scene.levelTimer);
    const rounded   = Math.ceil(remaining);
    const mm = String(Math.floor(rounded / 60)).padStart(2, '0');
    const ss = String(rounded % 60).padStart(2, '0');
    scene.timeText.setText(`${mm}:${ss}`);
  }

  if (!scene.levelCompleted && scene.levelTimer >= scene.levelDuration) {
    endLevel(scene);
    return true;
  }
  return false;
}

export function endLevel(scene) {
  if (scene.gameOver || scene.levelCompleted) return;

  scene.levelCompleted = true;
  scene.gameOver       = true;
  scene.persistRunCoins();

  if (scene.player?.body) scene.player.body.setVelocity(0, 0);
  scene.enemies.getChildren().forEach(e => { if (e.body) e.body.setVelocity(0, 0); });
  scene.bullets.getChildren().forEach(b => { b.vx = 0; b.vy = 0; if (b.body) b.body.setVelocity(0, 0); });
  if (scene.enemyProjectiles) {
    scene.enemyProjectiles.getChildren().forEach(p => { p.vx = 0; p.vy = 0; if (p.body) p.body.setVelocity(0, 0); });
  }

  const nextLevel = scene.currentLevel + 1;

  // Sauvegarde checkpoint tous les 5 niveaux
  if (scene.currentLevel % 5 === 0) {
    const progress = loadProgress();
    progress.checkpointLevel = nextLevel;
    saveProgress(progress);
    // Débloque aussi le checkpoint suivant sur la carte
    unlockCheckpoint(nextLevel);
  }

  // Overlay de fin de niveau, puis ShopScene
  if (scene.crosshair) scene.crosshair.setVisible(false);
  scene.input.setDefaultCursor('default');
  if (scene.game?.canvas) scene.game.canvas.style.cursor = 'default';

  _showLevelCompleteOverlay(scene, scene.currentLevel);
}

// ─────────────────────────────────────────────────────────────
//  Overlay de fin de niveau — rapide et propre
// ─────────────────────────────────────────────────────────────
function _showLevelCompleteOverlay(scene, level) {
  const W  = scene.scale.width;
  const H  = scene.scale.height;

  // Fond Phaser semi-transparent
  const bg = scene.add.rectangle(W/2, H/2, W, H, 0x000000, 0.72)
    .setDepth(1990).setScrollFactor(0);

  // Sons
  scene.sound?.play?.('coin', { volume: 0.15, rate: 0.9  });
  scene.time.delayedCall(200, () => scene.sound?.play?.('coin', { volume: 0.15, rate: 1.05 }));

  // HTML DOM
  const kills = scene.score ?? 0;
  const coins = scene.coins ?? 0;

  const html = `
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  #lvl-root {
    font-family: Inter, Arial, sans-serif;
    width: 100vw; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .lvl-panel {
    pointer-events: all; position: relative;
    background: linear-gradient(180deg, rgba(5,16,30,0.97), rgba(2,8,18,0.99));
    border: 1px solid rgba(94,195,255,0.25);
    border-radius: 6px;
    padding: 28px 44px 24px;
    min-width: 480px; overflow: visible;
    opacity: 0; transform: translateY(-12px);
    transition: opacity .32s ease, transform .38s cubic-bezier(0.34,1.56,0.64,1);
  }
  .lvl-panel.visible { opacity: 1; transform: translateY(0); }

  /* Frame */
  .f-c { position:absolute; pointer-events:none; z-index:4; background-size:contain; background-repeat:no-repeat; }
  .f-tl { top:-5px; left:-5px; width:120px; height:78px; background-image:url('assets/ui/ui-corner-tl.webp'); background-position:top left; }
  .f-tr { top:-5px; right:-5px; width:120px; height:76px; background-image:url('assets/ui/ui-corner-tr.webp'); background-position:top right; }
  .f-bl { bottom:-5px; left:-5px; width:66px; height:80px; background-image:url('assets/ui/ui-corner-bl.webp'); background-position:bottom left; }
  .f-br { bottom:-5px; right:-5px; width:66px; height:80px; background-image:url('assets/ui/ui-corner-br.webp'); background-position:bottom right; }
  .f-bt { position:absolute; top:-10px; left:100px; right:100px; height:24px; pointer-events:none; z-index:3;
    background-image:url('assets/ui/ui-border-top-thin.webp'); background-size:100% 100%; }
  .f-bb { position:absolute; bottom:-10px; left:56px; right:56px; height:24px; pointer-events:none; z-index:3;
    background-image:url('assets/ui/ui-border-bottom-thin.webp'); background-size:100% 100%; }

  /* Titre */
  .lvl-title {
    text-align: center; margin-bottom: 16px;
    color: #6de3ff; font-size: 1.2rem; font-weight: 900;
    letter-spacing: .14em; text-transform: uppercase;
  }
  .lvl-title span { color: #ffffff; }

  /* Séparateur */
  .lvl-sep {
    height: 1px; margin-bottom: 18px;
    background: linear-gradient(90deg, transparent, rgba(94,195,255,0.3), transparent);
  }

  /* Stats */
  .lvl-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; margin-bottom: 20px; }
  .lvl-stat { display: flex; flex-direction: column; align-items: center; gap: 3px; }
  .lvl-stat-label { color: #3a6a88; font-size: .75rem; font-weight: 700; letter-spacing: .1em; text-transform: uppercase; }
  .lvl-stat-value { font-size: 1.6rem; font-weight: 900; letter-spacing: .04em; }

  /* Bouton */
  .lvl-btn {
    width: 100%; padding: 13px 0; border-radius: 10px; cursor: pointer;
    border: 1px solid rgba(255,140,0,.75);
    background: linear-gradient(180deg, rgba(60,22,0,.85), rgba(18,8,2,.92));
    color: #ffe8b0; font-family: inherit; font-weight: 900;
    font-size: .88rem; letter-spacing: .1em; text-transform: uppercase;
    position: relative; overflow: hidden;
    animation: lvl-pulse 2.4s ease-in-out infinite;
    transition: transform .18s ease;
  }
  .lvl-btn::after {
    content:""; position:absolute; left:14px; right:14px; bottom:6px;
    height:1.5px; border-radius:999px;
    background: linear-gradient(90deg, transparent, rgba(255,176,74,.9), transparent);
  }
  .lvl-btn:hover { animation:none; transform:translateY(-2px);
    box-shadow: 0 0 18px 4px rgba(255,130,0,.7), 0 0 52px 8px rgba(255,90,0,.35); }
  @keyframes lvl-pulse {
    0%,100% { box-shadow: 0 0 10px 2px rgba(255,110,0,.5), 0 0 35px 5px rgba(255,80,0,.22); }
    50%      { box-shadow: 0 0 16px 3px rgba(255,130,0,.7), 0 0 52px 8px rgba(255,90,0,.35); }
  }
</style>
<div id="lvl-root">
  <div class="lvl-panel" id="lvl-panel">
    <div class="f-c f-tl"></div><div class="f-c f-tr"></div>
    <div class="f-c f-bl"></div><div class="f-c f-br"></div>
    <div class="f-c f-bt"></div><div class="f-c f-bb"></div>

    <div class="lvl-title">Niveau <span>${level}</span> — Complété</div>
    <div class="lvl-sep"></div>

    <div class="lvl-stats">
      <div class="lvl-stat">
        <div class="lvl-stat-label">⚔ Ennemis</div>
        <div class="lvl-stat-value" style="color:#e2e8f0">${kills}</div>
      </div>
      <div class="lvl-stat">
        <div class="lvl-stat-label">◉ Pièces</div>
        <div class="lvl-stat-value" style="color:#f5a623">+${coins}</div>
      </div>
    </div>

    <button class="lvl-btn" id="lvl-btn">▶ Continuer</button>
  </div>
</div>`;

  const domEl = scene.add.dom(W/2, H/2).createFromHTML(html).setDepth(2000);
  domEl.node.style.width  = W + 'px';
  domEl.node.style.height = H + 'px';

  // Anim entrée
  let ready = false;
  scene.time.delayedCall(100, () => {
    domEl.node.querySelector('#lvl-panel')?.classList.add('visible');
  });
  scene.time.delayedCall(1400, () => { ready = true; });

  const goNext = () => {
    if (!ready) return;
    ready = false;
    bg.destroy();
    domEl.destroy();
    openSupplyOverlay(scene);
  };

  domEl.node.querySelector('#lvl-btn')?.addEventListener('click', goNext);
  scene.input.once('pointerdown', goNext);
  scene.input.keyboard?.once('keydown', goNext);
}
