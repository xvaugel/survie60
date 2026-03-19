// ============================================================
//  MenuScene.js v3 — Menu HTML overlay avec style mockup
//  Le fond Phaser gère les étoiles animées.
//  L'UI est injectée en HTML pur via scene.add.dom()
//  pour un rendu CSS précis correspondant au mockup.
// ============================================================

import { initAudio, playMusic, stopMusic } from '../systems/AudioConfig.js';
import { loadProgress } from '../systems/storage.js';

export class MenuScene extends Phaser.Scene {
  constructor() { super('MenuScene'); }

  preload() {
    // Fond étoilé
    if (!this.textures.exists('menu-space-bg')) {
      this.load.image('menu-space-bg', 'assets/backgrounds/menu-space-bg.webp');
    }
    // Sprites de jeu (chargés ici pour être disponibles dans SurvivalScene)
    const gameSprites = [
      { key: 'ship-hull',     url: 'assets/sprites/ship-hull-basic.png' },
      { key: 'weapon-basic',  url: 'assets/sprites/weapon-basic.png' },
      { key: 'enemy-basic',   url: 'assets/sprites/enemy-basic.png' },
      { key: 'enemy-fast',    url: 'assets/sprites/enemy-fast.png' },
      { key: 'enemy-tank',    url: 'assets/sprites/enemy-tank.png' },
      { key: 'enemy-zigzag',  url: 'assets/sprites/enemy-zigzag.png' },
      { key: 'enemy-boss',    url: 'assets/sprites/enemy-boss.png' },
    ];
    gameSprites.forEach(({ key, url }) => {
      if (!this.textures.exists(key)) this.load.image(key, url);
    });

    // Assets UI frame
    const uiAssets = [
      'ui-corner-tl', 'ui-corner-tr', 'ui-corner-bl', 'ui-corner-br',
      'ui-border-top', 'ui-border-top-thin', 'ui-border-bottom', 'ui-border-bottom-thin',
    ];
    uiAssets.forEach(key => {
      if (!this.textures.exists(key))
        this.load.image(key, `assets/ui/${key}.webp`);
    });

    // Audio
    const files = [
      { key: 'button',           url: 'assets/audio/button.mp3' },
      { key: 'coin',             url: 'assets/audio/coin.mp3' },
      { key: 'game-over',        url: 'assets/audio/game-over.mp3' },
      { key: 'music-menu',       url: 'assets/audio/music-menu.mp3' },
      { key: 'player-explosion', url: 'assets/audio/player-explosion.mp3' },
      { key: 'rouge-explosion',  url: 'assets/audio/rouge-explosion.mp3' },
    ];
    files.forEach(f => { if (!this.cache.audio.exists(f.key)) this.load.audio(f.key, f.url); });
  }

  create() {
    initAudio(this.game);

    const W  = this.scale.width;
    const H  = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    // ── Fond Phaser : image + étoiles animées ─────────────
    this.cameras.main.setBackgroundColor('#020611');

    if (this.textures.exists('menu-space-bg')) {
      const bg = this.add.image(cx, cy, 'menu-space-bg')
        .setDisplaySize(W, H).setAlpha(0.52);
      this.tweens.add({
        targets: bg, x: cx + 20, y: cy - 14, scale: 1.06,
        duration: 28000, yoyo: true, repeat: -1, ease: 'Sine.InOut',
      });
    }

    // Étoiles procédurales
    const stars = this.add.graphics();
    for (let i = 0; i < 100; i++) {
      const sx  = Phaser.Math.Between(0, W);
      const sy  = Phaser.Math.Between(0, H);
      const big = Math.random() > 0.88;
      stars.fillStyle(0xffffff, big ? 0.7 : 0.25);
      stars.fillRect(sx, sy, big ? 2 : 1, big ? 2 : 1);
    }

    // Halos colorés
    const halo1 = this.add.circle(W * 0.18, H * 0.12, 280, 0x4581ff, 0.06);
    const halo2 = this.add.circle(W * 0.80, H * 0.18, 220, 0x2ed0ff, 0.05);
    const halo3 = this.add.circle(W * 0.52, H * 0.82, 300, 0x8254ff, 0.07);
    this.tweens.add({ targets: [halo1, halo2, halo3], alpha: { from: 0.04, to: 0.12 }, duration: 3500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // ── UI HTML ───────────────────────────────────────────
    const progress = loadProgress();
    const html     = this._buildHTML(progress);

    // Activer le DOM dans Phaser (nécessaire pour scene.add.dom)
    const domEl = this.add.dom(cx, cy).createFromHTML(html);
    domEl.setPosition(cx, cy);

    // ── Events HTML → Phaser ──────────────────────────────
    this._bindEvents(domEl, progress);

    // Musique
    this.load.once('complete', () => playMusic(this, 'music-menu'));
    if (this.cache.audio.exists('music-menu')) playMusic(this, 'music-menu');

    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  // ─────────────────────────────────────────────────────────
  //  HTML DU MENU
  // ─────────────────────────────────────────────────────────
  _buildHTML(progress) {
    const coins = progress.coins ?? 0;
    return `
<style>
  :root {
    --bg-0: #020611; --bg-1: #050d1b; --bg-2: #091427;
    --panel: rgba(6,16,34,0.88); --panel-2: rgba(8,22,48,0.92);
    --line: rgba(94,195,255,0.22); --line-strong: rgba(120,220,255,0.58);
    --text: #eef8ff; --muted: #8aa9c8;
    --cyan: #6de3ff; --cyan-2: #29b8ff; --cyan-3: #122f52;
    --orange: #ffb14a; --orange-2: #ff7a18; --orange-3: #3f1d08;
    --green: #57f5aa; --red: #ff5d67;
    --shadow: 0 0 0 1px rgba(130,220,255,0.08), 0 0 30px rgba(0,140,255,0.12), inset 0 0 0 1px rgba(255,255,255,0.025);
    --radius-panel: 22px; --radius-card: 16px; --radius-chip: 12px;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }

  #menu-root {
    font-family: Inter, Arial, Helvetica, sans-serif;
    color: var(--text);
    width: 100vw; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }

  .menu-shell {
    position: relative;
    width: min(820px, calc(100vw - 40px));
    pointer-events: all;
  }

  /* Panneau principal */
  .menu-panel {
    position: relative;
    background: linear-gradient(180deg, rgba(7,18,38,0.72), rgba(4,10,22,0.82));
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: var(--shadow);
    overflow: visible;
    backdrop-filter: blur(4px);
    padding: 40px 44px 36px;
  }

  /* Reflet interne */
  .menu-panel::before {
    content: "";
    position: absolute; inset: 1px;
    border-radius: calc(var(--radius-panel) - 2px);
    background: linear-gradient(110deg, transparent 28%, rgba(255,255,255,0.03) 38%, transparent 50%);
    pointer-events: none;
  }

  /* Accent bas */
  .menu-panel::after {
    content: "";
    position: absolute; left: 28px; right: 28px; bottom: 12px;
    height: 3px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(109,227,255,0.9), transparent);
    pointer-events: none;
  }

  /* Frame UI — coins et barres images */
  .ui-frame { position: relative; }

  .ui-frame .f-corner {
    position: absolute; pointer-events: none; z-index: 4;
    background-size: contain; background-repeat: no-repeat;
  }
  .f-corner-tl {
    top: -6px; left: -6px; width: 170px; height: 112px;
    background-image: var(--img-tl);
    background-position: top left;
  }
  .f-corner-tr {
    top: -6px; right: -6px; width: 170px; height: 110px;
    background-image: var(--img-tr);
    background-position: top right;
  }
  .f-corner-bl {
    bottom: -6px; left: -6px; width: 90px; height: 110px;
    background-image: var(--img-bl);
    background-position: bottom left;
  }
  .f-corner-br {
    bottom: -6px; right: -6px; width: 90px; height: 110px;
    background-image: var(--img-br);
    background-position: bottom right;
  }
  .f-border-top {
    position: absolute; top: -14px; left: 140px; right: 140px;
    height: 32px; pointer-events: none; z-index: 3;
    background-image: var(--img-border-top);
    background-size: 100% 100%; background-repeat: no-repeat;
  }
  .f-border-bottom {
    position: absolute; bottom: -16px; left: 80px; right: 80px;
    height: 32px; pointer-events: none; z-index: 3;
    background-image: var(--img-border-bottom);
    background-size: 100% 100%; background-repeat: no-repeat;
  }

  /* Header */
  .menu-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 32px;
  }

  .logo-area {
    display: flex; align-items: center; gap: 14px;
  }

  .logo-icon {
    width: 42px; height: 42px; border-radius: 11px; flex: 0 0 auto;
    background: radial-gradient(circle at 50% 40%, rgba(170,240,255,.72), rgba(0,180,255,.22) 42%, transparent 52%),
      linear-gradient(180deg, rgba(35,116,255,.35), rgba(15,45,100,.55));
    border: 1px solid rgba(127,225,255,.35);
    box-shadow: 0 0 18px rgba(0,160,255,.28);
    position: relative;
  }
  .logo-icon::after {
    content: ""; position: absolute; inset: 9px;
    clip-path: polygon(50% 0%,100% 35%,82% 100%,18% 100%,0% 35%);
    background: linear-gradient(180deg, #d5fbff, #66dcff 65%, #178de8);
  }

  .logo-name {
    font-size: 1.3rem; font-weight: 900;
    letter-spacing: .1em; text-transform: uppercase; color: var(--text);
  }

  .coin-badge {
    display: flex; align-items: center; gap: 10px;
    background: linear-gradient(180deg, rgba(10,24,51,.88), rgba(6,13,28,.95));
    border: 1px solid rgba(110,210,255,0.18);
    border-radius: 14px; padding: 10px 18px;
    color: #ffd089; font-weight: 900; letter-spacing: .06em; font-size: 1rem;
  }

  .coin-dot {
    width: 18px; height: 18px; border-radius: 999px;
    background: linear-gradient(180deg, #ffd26a, #ff9800);
    box-shadow: 0 0 14px rgba(255,153,0,.4);
    flex: 0 0 auto;
  }

  /* Eyebrow */
  .eyebrow {
    display: inline-flex; align-items: center; gap: 10px;
    color: var(--cyan); font-weight: 900;
    letter-spacing: .18em; margin-bottom: 10px;
    text-transform: uppercase; font-size: .88rem;
  }
  .eyebrow::before {
    content: ""; width: 40px; height: 2px;
    background: linear-gradient(90deg, transparent, var(--cyan));
  }

  /* Titre */
  .menu-title {
    font-size: clamp(2.2rem, 5vw, 3.8rem);
    line-height: .92; letter-spacing: .02em; text-transform: uppercase;
    text-shadow: 0 0 26px rgba(99,222,255,0.16);
    margin-bottom: 14px; font-weight: 900;
  }

  /* Sous-titre */
  .menu-sub {
    color: #9bb8d6; line-height: 1.7; font-size: .96rem; margin-bottom: 28px;
    max-width: 480px;
  }

  /* Chips */
  .chips {
    display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 32px;
  }
  .chip {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-radius: var(--radius-chip);
    border: 1px solid rgba(105,218,255,0.16);
    background: linear-gradient(180deg, rgba(9,23,48,.92), rgba(7,14,30,.96));
    color: #c8eaff; font-size: .84rem; font-weight: 700;
    letter-spacing: .05em; text-transform: uppercase;
  }
  .chip-dot {
    width: 7px; height: 7px; border-radius: 999px;
    background: var(--cyan); box-shadow: 0 0 10px rgba(75,219,255,0.5);
  }
  .chip.orange .chip-dot { background: var(--orange); box-shadow: 0 0 10px rgba(255,120,0,.45); }
  .chip.green  .chip-dot { background: var(--green);  box-shadow: 0 0 10px rgba(87,245,170,.45); }

  /* Boutons */
  .btn-row { display: flex; gap: 14px; flex-wrap: wrap; }

  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 180px; padding: 16px 26px; border-radius: 13px;
    text-decoration: none; color: white; font-weight: 900;
    letter-spacing: .08em; text-transform: uppercase; cursor: pointer;
    border: 1px solid rgba(104,211,255,.22);
    background: linear-gradient(180deg, rgba(9,21,44,.96), rgba(6,13,28,.98));
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.02), 0 0 18px rgba(0,140,255,.14);
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    position: relative; overflow: hidden; font-family: inherit; font-size: .92rem;
  }
  .btn::before {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,.05), transparent 35%);
    pointer-events: none;
  }
  .btn::after {
    content: ""; position: absolute; left: 18px; right: 18px; bottom: 7px;
    height: 2px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(101,228,255,.9), transparent);
  }
  .btn:hover { transform: translateY(-2px); border-color: rgba(104,211,255,.4); }
  .btn:active { transform: translateY(0); }

  @keyframes pulse-glow {
    0%,100% {
      box-shadow:
        0 0 10px 2px rgba(255,110,0,.50),
        0 0 35px 5px rgba(255,80,0,.25),
        0 0 70px 8px rgba(255,60,0,.10),
        inset 0 1px 0 rgba(255,200,80,.08);
    }
    50% {
      box-shadow:
        0 0 16px 3px rgba(255,130,0,.72),
        0 0 52px 8px rgba(255,90,0,.38),
        0 0 100px 14px rgba(255,60,0,.18),
        inset 0 1px 0 rgba(255,220,80,.14);
    }
  }
  @keyframes slide-shine {
    0%   { left: -80%; }
    100% { left: 140%; }
  }

  .btn-play {
    border-color: rgba(255,140,0,.75);
    background: linear-gradient(180deg, rgba(60,22,0,.85), rgba(18,8,2,.92));
    color: #ffe8b0;
    animation: pulse-glow 2.4s ease-in-out infinite;
    overflow: hidden;
  }
  .btn-play::before {
    content: "";
    position: absolute;
    top: 0; width: 35%; height: 100%;
    background: linear-gradient(105deg, transparent, rgba(255,200,80,.09) 50%, transparent);
    transform: skewX(-20deg);
    animation: slide-shine 3s ease-in-out infinite;
    pointer-events: none; z-index: 1;
  }
  .btn-play:hover {
    animation: none;
    box-shadow:
      0 0 18px 4px rgba(255,130,0,.75),
      0 0 56px 8px rgba(255,90,0,.42),
      0 0 100px 14px rgba(255,60,0,.18),
      inset 0 1px 0 rgba(255,220,80,.15);
    border-color: rgba(255,160,0,.9);
    transform: translateY(-2px);
  }
  .btn-play::after {
    background: linear-gradient(90deg, transparent, rgba(255,176,74,.95), transparent);
    height: 1.5px; opacity: 1;
  }

  /* Séparateur */
  .divider {
    height: 1px; margin: 28px 0;
    background: linear-gradient(90deg, transparent, rgba(94,195,255,0.22), transparent);
  }

  /* Navigation secondaire */
  .nav-row {
    display: flex; gap: 8px; flex-wrap: wrap;
  }
  .nav-btn {
    padding: 10px 18px; border-radius: 10px; cursor: pointer;
    border: 1px solid transparent;
    background: transparent; color: #8aa9c8;
    font-family: inherit; font-size: .85rem; font-weight: 700;
    letter-spacing: .07em; text-transform: uppercase;
    transition: .18s ease;
  }
  .nav-btn:hover {
    border-color: rgba(108,219,255,.2);
    background: rgba(20,56,110,.22);
    color: #c8eaff;
    box-shadow: inset 0 0 18px rgba(31,176,255,.06);
  }
</style>

<div id="menu-root">
  <div class="menu-shell">
    <div class="menu-panel ui-frame" style="
      --img-tl: url('assets/ui/ui-corner-tl.webp');
      --img-tr: url('assets/ui/ui-corner-tr.webp');
      --img-bl: url('assets/ui/ui-corner-bl.webp');
      --img-br: url('assets/ui/ui-corner-br.webp');
      --img-border-top: url('assets/ui/ui-border-top.webp');
      --img-border-bottom: url('assets/ui/ui-border-bottom.webp');
    ">
      <div class="f-corner f-corner-tl"></div>
      <div class="f-corner f-corner-tr"></div>
      <div class="f-corner f-corner-bl"></div>
      <div class="f-corner f-corner-br"></div>
      <div class="f-border-top"></div>
      <div class="f-border-bottom"></div>

      <!-- Header -->
      <div class="menu-header">
        <div class="logo-area">
          <div class="logo-icon"></div>
          <span class="logo-name">Void Survivors</span>
        </div>
        <div class="coin-badge">
          <div class="coin-dot"></div>
          <span id="coin-count">${coins}</span>
        </div>
      </div>

      <!-- Titre + accroche -->
      <div class="eyebrow">Arcade Space Shooter</div>
      <h1 class="menu-title">Blast your way<br>through the void</h1>
      <p class="menu-sub">
        Affronte des vagues d'ennemis, améliore ton vaisseau, débloque des armes dévastatrices.
        Chaque run est unique — jusqu'où iras-tu ?
      </p>

      <!-- Chips -->
      <div class="chips">
        <div class="chip"><span class="chip-dot"></span>Build dynamique</div>
        <div class="chip orange"><span class="chip-dot"></span>Boss de fin</div>
        <div class="chip green"><span class="chip-dot"></span>Upgrades de run</div>
      </div>

      <!-- Boutons principaux -->
      <div class="btn-row">
        <button class="btn btn-play" id="btn-play">▶ &nbsp;Jouer maintenant</button>
        <button class="btn" id="btn-hangar">Hangar</button>
        <button class="btn" id="btn-map">Carte galactique</button>
      </div>

      <div class="divider"></div>

      <!-- Navigation secondaire -->
      <div class="nav-row">
        <button class="nav-btn" id="btn-continue">Continuer la run</button>
        <button class="nav-btn" id="btn-credits">Crédits</button>
      </div>

    </div>
  </div>
</div>`;
  }

  // ─────────────────────────────────────────────────────────
  //  BINDING EVENTS
  // ─────────────────────────────────────────────────────────
  _bindEvents(domEl, progress) {
    const el = domEl.node;

    const go = (fn) => {
      this.sound?.play?.('button', { volume: 0.25 });
      stopMusic(this);
      this.cameras.main.fadeOut(320, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', fn);
    };

    // Jouer
    el.querySelector('#btn-play')?.addEventListener('click', () => {
      go(() => {
        const p = loadProgress();
        this.registry.set('currentLevel', 1);
        this.scene.start('SurvivalScene', { upgrades: p.upgrades });
      });
    });

    // Hangar
    el.querySelector('#btn-hangar')?.addEventListener('click', () => {
      go(() => this.scene.start('ShopScene', { fromLevel: false }));
    });

    // Carte galactique
    el.querySelector('#btn-map')?.addEventListener('click', () => {
      go(() => this.scene.start('MapScene'));
    });

    // Continuer (dernier checkpoint)
    const btnContinue = el.querySelector('#btn-continue');
    const checkpoint  = progress.checkpointLevel || 1;
    if (checkpoint > 1) {
      btnContinue.textContent = `Continuer — Niveau ${checkpoint}`;
      btnContinue.style.color = '#6de3ff';
      btnContinue.addEventListener('click', () => {
        go(() => {
          this.registry.set('currentLevel', checkpoint);
          this.scene.start('SurvivalScene', { upgrades: progress.upgrades });
        });
      });
    } else {
      btnContinue.style.opacity = '0.35';
      btnContinue.style.cursor  = 'default';
    }
  }
}
