// ============================================================
//  BossVictoryScene.js — Écran de victoire boss épique
//
//  Reçoit via data :
//    level, kills, coinsEarned, lifeRemaining, maxLife,
//    bossReward, upgrades, weaponState, moduleState
// ============================================================

import { loadProgress } from '../systems/storage.js';
import { stopMusic }     from '../systems/AudioConfig.js';

const FONT  = { fontFamily: '"Courier New", Courier, monospace', fontStyle: 'bold' };
const FONTB = { fontFamily: '"Courier New", Courier, monospace' };

export class BossVictoryScene extends Phaser.Scene {
  constructor() { super('BossVictoryScene'); }

  init(data) {
    this.victoryData = {
      level:         data.level         ?? 5,
      kills:         data.kills         ?? 0,
      coinsEarned:   data.coinsEarned   ?? 0,
      lifeRemaining: data.lifeRemaining ?? 0,
      maxLife:       data.maxLife       ?? 100,
      bossReward:    data.bossReward    ?? 25,
      upgrades:      data.upgrades      ?? {},
      weaponState:   data.weaponState,
      moduleState:   data.moduleState,
    };
  }

  create() {
    const W  = this.scale.width;
    const H  = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;
    const d  = this.victoryData;

    stopMusic(this);

    // Restaurer le curseur (caché pendant le gameplay)
    this.input.setDefaultCursor('default');
    if (this.game?.canvas) this.game.canvas.style.cursor = 'default';

    // ── Fond noir absolu ──────────────────────────────────────
    this.cameras.main.setBackgroundColor('#000000');
    const bgRect = this.add.rectangle(cx, cy, W, H, 0x000000, 1).setDepth(0);

    // ── Étoiles de fond ───────────────────────────────────────
    this._buildStarfield(W, H);

    // ── Séquence principale ───────────────────────────────────
    this._runSequence(W, H, cx, cy, d);
  }

  // ─────────────────────────────────────────────────────────
  //  ÉTOILES
  // ─────────────────────────────────────────────────────────
  _buildStarfield(W, H) {
    const g = this.add.graphics().setDepth(1).setAlpha(0);
    for (let i = 0; i < 120; i++) {
      const x   = Phaser.Math.Between(0, W);
      const y   = Phaser.Math.Between(0, H);
      const big = Math.random() > 0.88;
      g.fillStyle(0xffffff, big ? 0.8 : 0.25);
      g.fillRect(x, y, big ? 2 : 1, big ? 2 : 1);
    }
    this.tweens.add({ targets: g, alpha: 1, duration: 1200, delay: 400 });
  }

  // ─────────────────────────────────────────────────────────
  //  SÉQUENCE PRINCIPALE
  // ─────────────────────────────────────────────────────────
  _runSequence(W, H, cx, cy, d) {
    const sectorNum = Math.floor(d.level / 5);
    const sectorName = [
      '', 'SECTEUR I', 'SECTEUR II', 'SECTEUR III', 'SECTEUR IV',
      'SECTEUR V', 'SECTEUR VI', 'SECTEUR VII', 'SECTEUR VIII', 'SECTEUR IX', 'SECTEUR X',
    ][sectorNum] || `SECTEUR ${sectorNum}`;

    let t = 0; // curseur de temps

    // ── 0ms : Flash rouge résiduel ───────────────────────
    const flash = this.add.rectangle(cx, cy, W, H, 0xff0000, 0.5).setDepth(100);
    this.tweens.add({ targets: flash, alpha: 0, duration: 600, ease: 'Quad.Out',
      onComplete: () => flash.destroy() });

    // ── 200ms : Ligne scan horizontale ───────────────────
    this.time.delayedCall(200, () => {
      const scan = this.add.rectangle(cx, -4, W, 3, 0xff2244, 0.9).setDepth(50);
      this.tweens.add({
        targets: scan, y: H + 4, duration: 700, ease: 'Quad.In',
        onComplete: () => scan.destroy(),
      });
    });

    // ── 600ms : "BOSS ÉLIMINÉ" en rouge, glitch ───────────
    t = 600;
    this.time.delayedCall(t, () => {
      const eliminated = this.add.text(cx, cy - 120, 'BOSS ÉLIMINÉ', {
        ...FONT, fontSize: '52px', color: '#ff2244',
        stroke: '#000000', strokeThickness: 8,
      }).setOrigin(0.5).setDepth(10).setAlpha(0);

      this.tweens.add({ targets: eliminated, alpha: 1, duration: 80 });

      // Effet glitch : vibrations rapides
      let glitchCount = 0;
      const glitch = this.time.addEvent({
        delay: 60, repeat: 8,
        callback: () => {
          eliminated.x = cx + Phaser.Math.Between(-6, 6);
          eliminated.y = (cy - 120) + Phaser.Math.Between(-3, 3);
          eliminated.setColor(glitchCount % 2 === 0 ? '#ff2244' : '#ffffff');
          glitchCount++;
          if (glitchCount >= 8) {
            eliminated.x = cx; eliminated.y = cy - 120;
            eliminated.setColor('#ff2244');
          }
        },
      });
      this._eliminated = eliminated;
    });

    // ── 1000ms : Ligne séparatrice rouge ──────────────────
    t = 1000;
    this.time.delayedCall(t, () => {
      const line = this.add.graphics().setDepth(10).setAlpha(0);
      line.lineStyle(1.5, 0xff2244, 0.6);
      line.lineBetween(cx - 300, cy - 75, cx + 300, cy - 75);
      this.tweens.add({ targets: line, alpha: 1, duration: 300 });
    });

    // ── 1100ms : Nom du secteur (machine à écrire) ────────
    t = 1100;
    this.time.delayedCall(t, () => {
      const full   = `${sectorName} — NIVEAU ${d.level}`;
      const target = this.add.text(cx, cy - 52, '', {
        ...FONT, fontSize: '28px', color: '#00c8ff',
      }).setOrigin(0.5).setDepth(10);
      this._typewrite(target, full, 38);
    });

    // ── 1600ms : Ligne séparatrice cyan ───────────────────
    t = 1600;
    this.time.delayedCall(t, () => {
      const line2 = this.add.graphics().setDepth(10).setAlpha(0);
      line2.lineStyle(1, 0x00c8ff, 0.3);
      line2.lineBetween(cx - 280, cy - 18, cx + 280, cy - 18);
      this.tweens.add({ targets: line2, alpha: 1, duration: 300 });
    });

    // ── 1700ms : Stats une par une ────────────────────────
    const stats = [
      { label: 'ENNEMIS ÉLIMINÉS', value: String(d.kills),          color: '#e2e8f0', icon: '⚔' },
      { label: 'VIE RESTANTE',     value: `${d.lifeRemaining}/${d.maxLife}`, color: this._lifeColor(d.lifeRemaining, d.maxLife), icon: '♥' },
      { label: 'PIÈCES GAGNÉES',   value: `+${d.coinsEarned}`,     color: '#f5a623', icon: '◉' },
      { label: 'BONUS BOSS',       value: `+${d.bossReward}`,      color: '#ffd700', icon: '★' },
    ];

    stats.forEach((stat, i) => {
      this.time.delayedCall(1700 + i * 280, () => {
        this._spawnStat(cx, cy + 14 + i * 44, stat);
        this.sound?.play?.('coin', { volume: 0.15, rate: 0.8 + i * 0.08 });
      });
    });

    // ── 3000ms : Total pièces ─────────────────────────────
    t = 3000;
    this.time.delayedCall(t, () => {
      const total = d.coinsEarned + d.bossReward;
      const totalLine = this.add.graphics().setDepth(10).setAlpha(0);
      totalLine.lineStyle(1, 0xf5a623, 0.5);
      totalLine.lineBetween(cx - 280, cy + 196, cx + 280, cy + 196);
      this.tweens.add({ targets: totalLine, alpha: 1, duration: 200 });

      const totalT = this.add.text(cx, cy + 210, `TOTAL  +${total} PIÈCES`, {
        ...FONT, fontSize: '22px', color: '#ffd700',
      }).setOrigin(0.5).setDepth(10).setAlpha(0);
      this.tweens.add({ targets: totalT, alpha: 1, y: cy + 204, duration: 400, ease: 'Back.Out' });

      // Pluie de pièces
      this._coinRain(W, H);
    });

    // ── 3800ms : "ACCÈS ATELIER" + prompt ─────────────────
    t = 3800;
    this.time.delayedCall(t, () => {
      this._showContinuePrompt(cx, cy, W, H, d);
    });
  }

  // ─────────────────────────────────────────────────────────
  //  EFFET MACHINE À ÉCRIRE
  // ─────────────────────────────────────────────────────────
  _typewrite(textObj, fullStr, msPerChar = 45) {
    let idx = 0;
    const ev = this.time.addEvent({
      delay: msPerChar, repeat: fullStr.length - 1,
      callback: () => {
        idx++;
        textObj.setText(fullStr.substring(0, idx));
        if (Math.random() > 0.6) this.sound?.play?.('button', { volume: 0.06, rate: 2.5 });
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  LIGNE DE STAT
  // ─────────────────────────────────────────────────────────
  _spawnStat(cx, y, stat) {
    const cont = this.add.container(cx, y + 20).setDepth(10).setAlpha(0);

    // Icône
    const icon = this.add.text(-220, 0, stat.icon, {
      ...FONTB, fontSize: '18px', color: stat.color,
    }).setOrigin(0, 0.5);

    // Label
    const lbl = this.add.text(-196, 0, stat.label, {
      ...FONTB, fontSize: '17px', color: '#3a6a88',
    }).setOrigin(0, 0.5);

    // Points de remplissage
    const dots = this.add.text(0, 0, '·'.repeat(18), {
      ...FONTB, fontSize: '14px', color: '#1a3a52',
    }).setOrigin(0.5, 0.5);

    // Valeur (compte à rebours animé pour kills)
    const val = this.add.text(220, 0, stat.value, {
      ...FONT, fontSize: '20px', color: stat.color,
    }).setOrigin(1, 0.5);

    cont.add([icon, lbl, dots, val]);

    // Ligne de séparation fine
    const sep = this.add.graphics().setDepth(10).setAlpha(0);
    sep.lineStyle(1, 0x1a3652, 0.4);
    sep.lineBetween(cx - 220, y + 22, cx + 220, y + 22);

    this.tweens.add({
      targets: cont, alpha: 1, y: y, duration: 300, ease: 'Back.Out',
    });
    this.tweens.add({ targets: sep, alpha: 1, duration: 300, delay: 150 });
  }

  // ─────────────────────────────────────────────────────────
  //  PLUIE DE PIÈCES
  // ─────────────────────────────────────────────────────────
  _coinRain(W, H) {
    for (let i = 0; i < 22; i++) {
      this.time.delayedCall(i * 55 + Phaser.Math.Between(0, 120), () => {
        const cx2  = Phaser.Math.Between(W * 0.1, W * 0.9);
        const coin = this.add.graphics().setDepth(20);
        coin.fillStyle(0xf5a623, 1);    coin.fillCircle(0, 0, 7);
        coin.fillStyle(0xf8d060, 1);    coin.fillCircle(0, 0, 5);
        coin.fillStyle(0xffffff, 0.35); coin.fillEllipse(-2, -2, 4, 3);
        coin.x = cx2;
        coin.y = -20;

        this.tweens.add({
          targets: coin,
          y: H + 20,
          x: cx2 + Phaser.Math.Between(-60, 60),
          duration: Phaser.Math.Between(900, 1600),
          ease: 'Quad.In',
          onComplete: () => coin.destroy(),
        });

        // Son pièce aléatoire
        if (i % 4 === 0) {
          this.sound?.play?.('coin', {
            volume: 0.12,
            rate: Phaser.Math.FloatBetween(0.85, 1.3),
          });
        }
      });
    }
  }

  // ─────────────────────────────────────────────────────────
  //  PROMPT CONTINUER — HTML DOM avec frame
  // ─────────────────────────────────────────────────────────
  _showContinuePrompt(cx, cy, W, H, d) {
    const html = `
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  #vict-root {
    font-family: Inter, Arial, sans-serif;
    width: 100vw; height: 100vh;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 32px; pointer-events: none;
  }
  .vict-panel {
    pointer-events: all;
    position: relative;
    background: linear-gradient(180deg, rgba(4,10,22,0.96), rgba(2,6,14,0.98));
    border: 1px solid rgba(94,195,255,0.25);
    border-radius: 6px;
    padding: 20px 40px 18px;
    display: flex; flex-direction: column; align-items: center; gap: 10px;
    overflow: visible;
    opacity: 0; transform: translateY(16px);
    transition: opacity .4s ease, transform .4s ease;
    min-width: 520px;
  }
  .vict-panel.visible { opacity: 1; transform: translateY(0); }

  /* Frame coins */
  .f-c { position:absolute; pointer-events:none; z-index:4; background-size:contain; background-repeat:no-repeat; }
  .f-tl { top:-5px; left:-5px; width:110px; height:72px; background-image:url('assets/ui/ui-corner-tl.webp'); background-position:top left; }
  .f-tr { top:-5px; right:-5px; width:110px; height:70px; background-image:url('assets/ui/ui-corner-tr.webp'); background-position:top right; }
  .f-bl { bottom:-5px; left:-5px; width:64px; height:78px; background-image:url('assets/ui/ui-corner-bl.webp'); background-position:bottom left; }
  .f-br { bottom:-5px; right:-5px; width:64px; height:78px; background-image:url('assets/ui/ui-corner-br.webp'); background-position:bottom right; }
  .f-bt { position:absolute; top:-10px; left:90px; right:90px; height:24px; pointer-events:none; z-index:3; background-image:url('assets/ui/ui-border-top-thin.webp'); background-size:100% 100%; }
  .f-bb { position:absolute; bottom:-10px; left:54px; right:54px; height:24px; pointer-events:none; z-index:3; background-image:url('assets/ui/ui-border-bottom-thin.webp'); background-size:100% 100%; }

  .vict-label {
    color: #6de3ff; font-size: .82rem; font-weight: 900;
    letter-spacing: .16em; text-transform: uppercase;
    display: flex; align-items: center; gap: 10px;
  }
  .vict-label::before, .vict-label::after {
    content: ""; flex: 1; height: 1px; min-width: 40px;
    background: linear-gradient(90deg, transparent, rgba(109,227,255,0.4));
  }
  .vict-label::after { background: linear-gradient(270deg, transparent, rgba(109,227,255,0.4)); }

  .vict-btn {
    padding: 14px 48px; border-radius: 11px; cursor: pointer;
    border: 1px solid rgba(255,140,0,.75);
    background: linear-gradient(180deg, rgba(60,22,0,.88), rgba(18,8,2,.94));
    color: #ffe8b0; font-family: inherit; font-weight: 900;
    font-size: .95rem; letter-spacing: .1em; text-transform: uppercase;
    position: relative; overflow: hidden;
    animation: vict-pulse 2.4s ease-in-out infinite;
    transition: transform .18s ease;
  }
  .vict-btn::after {
    content: ""; position: absolute; left: 14px; right: 14px; bottom: 6px;
    height: 1.5px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(255,176,74,.9), transparent);
  }
  .vict-btn:hover { animation: none; transform: translateY(-2px);
    box-shadow: 0 0 18px 4px rgba(255,130,0,.7), 0 0 56px 8px rgba(255,90,0,.35); }
  @keyframes vict-pulse {
    0%,100% { box-shadow: 0 0 10px 2px rgba(255,110,0,.5), 0 0 35px 5px rgba(255,80,0,.22); }
    50%      { box-shadow: 0 0 16px 3px rgba(255,130,0,.7), 0 0 52px 8px rgba(255,90,0,.35); }
  }
  .vict-hint {
    color: rgba(94,195,255,0.35); font-size: .72rem;
    letter-spacing: .08em; text-transform: uppercase;
  }
</style>
<div id="vict-root">
  <div class="vict-panel" id="vict-panel">
    <div class="f-c f-tl"></div>
    <div class="f-c f-tr"></div>
    <div class="f-c f-bl"></div>
    <div class="f-c f-br"></div>
    <div class="f-c f-bt"></div>
    <div class="f-c f-bb"></div>
    <div class="vict-label">▶ Accès atelier débloqué</div>
    <button class="vict-btn" id="vict-btn">Continuer</button>
    <div class="vict-hint">Cliquer ou appuyer sur une touche</div>
  </div>
</div>`;

    const domEl = this.add.dom(W / 2, H / 2)
      .createFromHTML(html)
      .setDepth(20);

    // Forcer la taille du conteneur DOM à couvrir tout l'écran
    domEl.node.style.width  = W + 'px';
    domEl.node.style.height = H + 'px';

    // Anim entrée
    this.time.delayedCall(100, () => {
      const panel = domEl.node.querySelector('#vict-panel');
      if (panel) panel.classList.add('visible');
      this._readyToContinue = true;
    });

    // Effet scan ligne Phaser par-dessus
    const scanLine = this.add.rectangle(cx - 260, H - 130, 2, 4, 0x00c8ff, 0.8).setDepth(17);
    this.tweens.add({
      targets: scanLine, x: cx + 260, duration: 600, ease: 'Quad.InOut',
      onComplete: () => scanLine.destroy(),
    });

    // Events
    domEl.node.querySelector('#vict-btn')?.addEventListener('click', () => {
      domEl.destroy(); this._continue(d);
    });
    this.input.keyboard.once('keydown', () => {
      if (!this._readyToContinue) return;
      domEl.destroy(); this._continue(d);
    });
  }

  // ─────────────────────────────────────────────────────────
  //  CONTINUER → ShopScene
  // ─────────────────────────────────────────────────────────
  _continue(d) {
    if (!this._readyToContinue) return;
    this._readyToContinue = false;

    // Flash blanc + fadeout
    const W  = this.scale.width;
    const H  = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    const flash = this.add.rectangle(cx, cy, W, H, 0xffffff, 0).setDepth(500);
    this.tweens.add({
      targets: flash, alpha: 0.8, duration: 120,
      onComplete: () => {
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          const progress = loadProgress();
          this.scene.start('ShopScene', {
            fromLevel:   true,
            level:       d.level,
            upgrades:    d.upgrades,
            weaponState: d.weaponState,
            moduleState: d.moduleState,
          });
        });
      },
    });
  }

  // ─────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────
  _lifeColor(remaining, max) {
    const r = remaining / max;
    if (r > 0.6) return '#22c55e';
    if (r > 0.3) return '#f5a623';
    return '#ff4455';
  }
}
