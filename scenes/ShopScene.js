// ============================================================
//  ShopScene.js v3 — Hangar centré style menu
//  Layout : panneau centré | gauche vaisseau+slots | droite boutique
//           inventaire pleine largeur en bas
// ============================================================

import { stopMusic }    from '../systems/AudioConfig.js';
import { loadProgress, saveProgress, purchaseModule, equipModule, unequipModule }
  from '../systems/storage.js';
import { MODULE_CATALOG, sanitizeModuleState } from '../systems/ModuleSystem.js';

const SLOT_DEFS = [
  { idx:0, id:'weapon', label:'AVANT',   sub:'Arme',    color:'#38bdf8', accepts:['weapon'],  pos:'top'   },
  { idx:1, id:'left',   label:'GAUCHE',  sub:'Module',  color:'#f5a623', accepts:['support'], pos:'left'  },
  { idx:2, id:'right',  label:'DROIT',   sub:'Module',  color:'#f5a623', accepts:['support'], pos:'right' },
  { idx:3, id:'rear',   label:'ARRIÈRE', sub:'Canon',   color:'#ff8844', accepts:['support'], pos:'bottom'},
];

// Images disponibles pour les modules
const MOD_IMAGES = {
  basic:    'assets/weapons/weapon-basic-gun.webp',
  spread:   'assets/weapons/weapon_spread.webp',
  double:   'assets/weapons/weapon_double.webp',
  firerate: 'assets/upgrades/upgrade-firerate.webp',
  turret:   'assets/weapons/weapon-turret.webp',
  rear_gun: 'assets/weapons/weapon-rear-gun.webp',
  shield:   'assets/upgrades/upgrade-shield.webp',
  regen:    'assets/upgrades/upgrade-health.webp',
  magnet:   'assets/modules/module-magnet-coin.webp',
  laser:    'assets/weapons/weapon_laser.webp',
};

export class ShopScene extends Phaser.Scene {
  constructor() { super({ key: 'ShopScene' }); }

  init(data) {
    this.fromLevel = data?.fromLevel ?? false;
    this.levelDone = data?.level ?? 1;
  }

  preload() {
    if (!this.textures.exists('bg_atelier'))
      this.load.image('bg_atelier', 'assets/backgrounds/bg_atelier.webp');
    if (!this.cache.audio.exists('sound_atelier'))
      this.load.audio('sound_atelier', 'assets/audio/sound_atelier_upgrade.mp3');
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;

    stopMusic(this);
    this.input.setDefaultCursor('default');
    if (this.game?.canvas) this.game.canvas.style.cursor = 'default';

    // Fond Phaser
    this.cameras.main.setBackgroundColor('#020611');
    if (this.textures.exists('bg_atelier')) {
      this.add.image(W/2, H/2, 'bg_atelier').setDisplaySize(W, H).setAlpha(0.52);
    }

    this._progress  = loadProgress();
    this._modState  = sanitizeModuleState(this._progress.modules);
    this._activeTab = 'weapon';

    // Ghost drag dans le body (évite les problèmes de position Phaser)
    document.getElementById('hg-drag-ghost')?.remove();
    this._ghost = document.createElement('div');
    this._ghost.id = 'hg-drag-ghost';
    this._ghost.style.cssText = `
      position:fixed; pointer-events:none; z-index:99999;
      width:68px; height:68px; border-radius:10px; display:none;
      background:rgba(8,22,50,0.96); border:2px solid rgba(109,228,255,0.8);
      align-items:center; justify-content:center;
      box-shadow:0 0 20px rgba(109,228,255,0.5);
      transform:translate(-50%,-50%);
    `;
    document.body.appendChild(this._ghost);

    // Créer le DOM initial
    const html = this._buildHTML();
    this._dom = this.add.dom(W/2, H/2).createFromHTML(html).setDepth(10);
    this._el = {
      root:  this._dom.node,
      coins: this._dom.node.querySelector('#hg-coins'),
      meta:  this._dom.node.querySelector('#hg-meta'),
      hint:  this._dom.node.querySelector('#hg-hint'),
      slots: this._dom.node.querySelector('#slots-container'),
      tabs:  this._dom.node.querySelector('#hg-tabs'),
      cards: this._dom.node.querySelector('#hg-cards'),
      inv:   this._dom.node.querySelector('#hg-inv'),
    };

    this._bindEvents();
    this._injectFrame();
    this.cameras.main.fadeIn(300, 0, 0, 0);
  }

  _injectFrame() {
    document.getElementById('hangar-frame')?.remove();
    const f = document.createElement('div');
    f.id = 'hangar-frame';
    f.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;overflow:visible;';
    f.innerHTML = `<style>
      #hangar-frame .hf{position:absolute;background-size:contain;background-repeat:no-repeat;}
      #hangar-frame .hf-tl{top:0;left:0;width:200px;height:130px;background-image:url('assets/ui/ui-corner-tl.webp');background-position:top left;}
      #hangar-frame .hf-tr{top:0;right:0;width:200px;height:128px;background-image:url('assets/ui/ui-corner-tr.webp');background-position:top right;}
      #hangar-frame .hf-bl{bottom:0;left:0;width:115px;height:138px;background-image:url('assets/ui/ui-corner-bl.webp');background-position:bottom left;}
      #hangar-frame .hf-br{bottom:0;right:0;width:115px;height:138px;background-image:url('assets/ui/ui-corner-br.webp');background-position:bottom right;}
      #hangar-frame .hf-bt{top:0;left:170px;right:170px;height:38px;background-image:url('assets/ui/ui-border-top.webp');background-size:100% 100%;}
      #hangar-frame .hf-bb{bottom:0;left:96px;right:96px;height:38px;background-image:url('assets/ui/ui-border-bottom.webp');background-size:100% 100%;}
    </style>
    <div class="hf hf-tl"></div><div class="hf hf-tr"></div>
    <div class="hf hf-bl"></div><div class="hf hf-br"></div>
    <div class="hf hf-bt"></div><div class="hf hf-bb"></div>`;
    document.body.appendChild(f);
    this._frameEl = f;
  }

  shutdown() {
    this._frameEl?.remove();
    this._frameEl = null;
    this._ghost?.remove();
    this._ghost = null;
    if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
    if (this._onMouseUp)   window.removeEventListener('mouseup',   this._onMouseUp);
  }


  _buildHTML() {
    return `
<style>
  * { box-sizing:border-box; margin:0; padding:0; }

  #shop-root {
    font-family: Inter, Arial, sans-serif;
    width:100vw; height:100vh;
    display:flex; align-items:center; justify-content:center;
    pointer-events:none;
    overflow:visible;
  }

  /* ── Panneau principal centré ─────────────────── */
  .hg-shell {
    width: min(1300px, calc(100vw - 80px));
    pointer-events: all;
    position: relative;
    overflow: visible;
  }

  .hg-panel {
    background: linear-gradient(180deg, rgba(7,18,38,0.72), rgba(4,10,22,0.82));
    border: 1px solid rgba(94,195,255,0.2);
    border-radius: 6px;
    backdrop-filter: blur(4px);
    box-shadow: 0 0 0 1px rgba(130,220,255,0.06), 0 0 40px rgba(0,140,255,0.1);
    overflow: visible;
    position: relative;
    display: flex;
    flex-direction: column;
    max-height: calc(100vh - 120px);
  }


  /* ── Header ──────────────────────────────────── */
  .hg-header {
    display:flex; align-items:center; justify-content:space-between;
    padding:14px 24px; border-bottom:1px solid rgba(94,195,255,0.12);
    flex-shrink:0;
  }
  .hg-title {
    display:flex; align-items:center; gap:10px;
    color:#6de3ff; font-size:.88rem; font-weight:900; letter-spacing:.16em; text-transform:uppercase;
  }
  .hg-title::before { content:""; width:32px; height:1.5px; background:linear-gradient(90deg,transparent,#6de3ff); }
  .hg-meta { color:#7ab0cc; font-size:.75rem; letter-spacing:.08em; }
  .hg-coins {
    display:flex; align-items:center; gap:8px;
    background:rgba(10,24,51,.88); border:1px solid rgba(110,210,255,0.2);
    border-radius:11px; padding:7px 14px; color:#ffd089; font-weight:900; font-size:.88rem;
  }
  .hg-coin { width:13px; height:13px; border-radius:50%; background:linear-gradient(180deg,#ffd26a,#ff9800); flex:0 0 auto; }

  /* ── Corps : 2 colonnes ──────────────────────── */
  .hg-body {
    display:grid; grid-template-columns:350px 1fr;
    height: 520px;
    overflow:hidden;
  }

  /* ── Colonne gauche — vaisseau + slots ───────── */
  .hg-left {
    border-right:1px solid rgba(94,195,255,0.1);
    padding:16px; display:flex; flex-direction:column; gap:10px; align-items:center;
  }
  .hg-section-lbl {
    color:#6a9ab8; font-size:.72rem; font-weight:700; letter-spacing:.12em;
    text-transform:uppercase; align-self:flex-start;
  }

  /* Zone vaisseau avec slots positionnés */
  .hg-ship-zone {
    position:relative; width:300px; height:280px; flex-shrink:0;
  }
  .hg-ship-center {
    position:absolute; top:55%; left:50%;
    transform:translate(-50%,-50%);
    display:flex; align-items:center; justify-content:center;
    width:80px; height:80px;
  }
  .hg-ship-glow {
    position:absolute; width:140px; height:140px; border-radius:50%;
    background:radial-gradient(circle,rgba(56,180,255,0.08),transparent 70%);
    top:50%; left:50%; transform:translate(-50%,-50%); pointer-events:none;
  }

  /* Slots */
  .hg-slot {
    position:absolute; width:90px;
    display:flex; flex-direction:column; align-items:center;
  }
  .hg-slot[data-pos=top]    { top:4px;  left:50%; transform:translateX(-50%); }
  .hg-slot[data-pos=left]   { left:2px; top:50%;  transform:translateY(-50%); }
  .hg-slot[data-pos=right]  { right:2px;top:50%;  transform:translateY(-50%); }
  .hg-slot[data-pos=bottom] { bottom:4px;left:50%;transform:translateX(-50%); }

  .hg-slot-box {
    width:88px; background:rgba(4,12,28,0.85);
    border:1px dashed rgba(94,195,255,0.2); border-radius:8px;
    padding:6px 4px; display:flex; flex-direction:column;
    align-items:center; gap:2px; cursor:pointer;
    transition:.15s ease; position:relative;
  }
  .hg-slot-box.droptarget { border-color:rgba(109,228,255,0.5)!important; border-style:solid!important; }
  .hg-slot-box.hover-active { border-color:rgba(109,228,255,0.9)!important; border-style:solid!important; background:rgba(15,40,80,0.98)!important; box-shadow:0 0 12px rgba(109,228,255,0.4)!important; }
  .hg-slot-box.weapon-slot { border-color:rgba(56,180,255,0.3); }
  .hg-slot-box.support-slot { border-color:rgba(245,166,35,0.25); }
  .hg-slot-box.filled.weapon-slot { border-style:solid; border-color:rgba(56,180,255,0.6); }
  .hg-slot-box.filled.support-slot { border-style:solid; border-color:rgba(245,166,35,0.5); }
  .hg-slot-box.locked { opacity:.4; cursor:default; border-color:rgba(255,136,68,0.2)!important; }
  .hg-slot-box:hover:not(.locked) { border-color:rgba(109,228,255,0.45); }

  .hg-slot-img { width:42px; height:42px; object-fit:contain; }
  .hg-slot-icon { width:42px; height:42px; border-radius:7px; background:rgba(56,180,255,0.08); display:flex; align-items:center; justify-content:center; font-size:14px; }
  .hg-slot-lbl  { color:#5a90b0; font-size:.62rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; }
  .hg-slot-name { font-size:.72rem; font-weight:700; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:62px; margin-top:1px; }
  .hg-slot-rm {
    position:absolute; top:2px; right:2px; width:14px; height:14px;
    background:rgba(255,50,50,0.1); border:none; border-radius:3px;
    color:rgba(255,80,80,0.5); font-size:9px; cursor:pointer;
    display:none; align-items:center; justify-content:center; font-family:inherit;
  }
  .hg-slot-box.filled .hg-slot-rm { display:flex; }
  .hg-slot-rm:hover { background:rgba(255,50,50,0.3); color:#ff5555; }

  /* ── Colonne droite — boutique ───────────────── */
  .hg-right { display:flex; flex-direction:column; overflow:hidden; }

  .hg-tabs { display:flex; border-bottom:1px solid rgba(94,195,255,0.1); flex-shrink:0; }
  .hg-tab {
    flex:1; padding:11px 8px; text-align:center;
    color:#6a9ab8; font-size:.72rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase;
    cursor:pointer; border-bottom:2px solid transparent; transition:.15s;
  }
  .hg-tab.active { color:#6de3ff; border-bottom-color:#6de3ff; background:rgba(109,228,255,0.04); }

  .hg-cards {
    flex:1; padding:10px; overflow-y:auto;
    display:grid; grid-template-columns:repeat(3,1fr); gap:10px; align-content:start;
  }
  .hg-cards.tab-support {
    grid-template-columns:repeat(4,1fr);
  }
  .hg-cards::-webkit-scrollbar { width:3px; }
  .hg-cards::-webkit-scrollbar-thumb { background:rgba(94,195,255,0.2); border-radius:2px; }

  /* Carte module */
  .hg-card {
    background:rgba(4,12,28,0.88); border:1px solid rgba(94,195,255,0.12);
    border-radius:9px; overflow:hidden; transition:.18s ease;
    clip-path:polygon(0 7%,7% 0,100% 0,100% 93%,93% 100%,0 100%);
    position:relative; display:flex; flex-direction:column;
  }
  .hg-card::after {
    content:""; position:absolute; left:8px; right:8px; bottom:3px;
    height:1.5px; border-radius:999px;
    background:linear-gradient(90deg,transparent,var(--cc,rgba(56,180,255,0.5)),transparent);
    pointer-events:none;
  }
  .hg-card:hover { border-color:rgba(109,228,255,0.28); transform:translateY(-2px); }
  .hg-card.owned    { border-color:rgba(34,197,94,0.35); }
  .hg-card.equipped { border-color:rgba(109,228,255,0.55); background:rgba(8,22,50,0.95); }

  .hg-card-img {
    aspect-ratio:16/9; background:rgba(6,16,38,0.8);
    border-bottom:1px solid rgba(94,195,255,0.08);
    display:flex; align-items:center; justify-content:center; overflow:hidden;
  }
  .hg-card-img img { width:100%; height:100%; object-fit:cover; display:block; }
  .hg-card-img .hg-card-emoji { font-size:24px; opacity:.75; }

  .hg-card-body { padding:7px 8px 9px; flex:1; display:flex; flex-direction:column; gap:3px; }
  .hg-card-name { color:#eef8ff; font-size:.78rem; font-weight:900; letter-spacing:.05em; text-transform:uppercase; margin-bottom:3px; }
  .hg-card-desc { color:#7ab0cc; font-size:.68rem; line-height:1.4; flex:1; }
  .hg-card-tag {
    font-size:.56rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase;
    padding:2px 5px; border-radius:3px; align-self:flex-start;
  }
  .hg-card-tag.owned    { background:rgba(34,197,94,0.1); color:#22c55e; }
  .hg-card-tag.equipped { background:rgba(109,228,255,0.1); color:#6de3ff; }
  .hg-card-tag.locked   { background:rgba(255,100,100,0.08); color:#ff6666; }

  .hg-card-btn {
    width:100%; padding:6px 0; border:none;
    background:rgba(56,180,255,0.07); border-top:1px solid rgba(94,195,255,0.1);
    color:#6de3ff; font-family:inherit; font-size:.62rem; font-weight:700;
    letter-spacing:.07em; text-transform:uppercase; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:4px; transition:.15s;
  }
  .hg-card-btn:hover:not(:disabled) { background:rgba(56,180,255,0.15); }
  .hg-card-btn:disabled { opacity:.3; cursor:default; }
  .hg-card-btn .btn-c { width:9px; height:9px; border-radius:50%; background:linear-gradient(180deg,#ffd26a,#ff9800); flex:0 0 auto; }

  /* ── Inventaire pleine largeur ───────────────── */
  .hg-inventory {
    border-top:1px solid rgba(94,195,255,0.12);
    padding:10px 20px; display:flex; align-items:center; gap:10px; flex-shrink:0;
  }
  .hg-inv-lbl { color:#6a9ab8; font-size:.65rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; white-space:nowrap; flex-shrink:0; }
  .hg-inv-list { display:flex; gap:7px; flex:1; overflow-x:auto; padding:3px 0; align-items:center; }
  .hg-inv-list::-webkit-scrollbar { height:3px; }
  .hg-inv-list::-webkit-scrollbar-thumb { background:rgba(94,195,255,0.2); border-radius:2px; }

  .hg-inv-item {
    width:68px; height:68px; border-radius:10px; flex:0 0 68px;
    background:rgba(4,12,28,0.88); border:1px solid rgba(94,195,255,0.2);
    display:flex; flex-direction:column; align-items:center; justify-content:center;
    cursor:grab; transition:.15s; position:relative; overflow:hidden;
    user-select:none; -webkit-user-drag:element;
  }
  .hg-inv-item:hover { border-color:rgba(109,228,255,0.5); transform:translateY(-2px); }
  .hg-inv-item.equipped { border-color:rgba(109,228,255,0.6); background:rgba(10,30,60,0.95); }
  .hg-inv-item.dragging { opacity:.35; cursor:grabbing; }
  .hg-inv-item img { width:54px; height:54px; object-fit:contain; }
  .hg-inv-item .inv-emoji { font-size:20px; }
  .hg-inv-item .inv-lbl {
    position:absolute; bottom:0; left:0; right:0;
    background:rgba(0,0,0,0.72); color:#8ab4cc;
    font-size:.45rem; font-weight:700; text-align:center;
    padding:1px 2px; text-transform:uppercase; white-space:nowrap; overflow:hidden;
  }
  .hg-inv-hint { color:#5a8aaa; font-size:.65rem; font-style:italic; white-space:nowrap; flex-shrink:0; }

  /* ── Footer ──────────────────────────────────── */
  .hg-footer {
    padding:11px 20px; border-top:1px solid rgba(94,195,255,0.1);
    display:flex; align-items:center; justify-content:space-between; flex-shrink:0;
  }
  .hg-footer-hint { color:#5a90b0; font-size:.68rem; letter-spacing:.05em; }
  .hg-btns { display:flex; gap:10px; }

  .btn-menu {
    padding:11px 24px; border-radius:10px; cursor:pointer;
    border:1px solid rgba(104,211,255,.22);
    background:linear-gradient(180deg,rgba(9,21,44,.96),rgba(6,13,28,.98));
    color:white; font-family:inherit; font-size:.8rem; font-weight:900;
    letter-spacing:.08em; text-transform:uppercase;
    position:relative; overflow:hidden; transition:.18s ease;
  }
  .btn-menu::after { content:""; position:absolute; left:14px; right:14px; bottom:6px; height:1.5px; border-radius:999px; background:linear-gradient(90deg,transparent,rgba(101,228,255,.85),transparent); }
  .btn-menu:hover { transform:translateY(-2px); border-color:rgba(104,211,255,.4); }

  .btn-play {
    padding:11px 28px; border-radius:10px; cursor:pointer;
    border:1px solid rgba(255,140,0,.75);
    background:linear-gradient(180deg,rgba(60,22,0,.85),rgba(18,8,2,.92));
    color:#ffe8b0; font-family:inherit; font-size:.88rem; font-weight:900;
    letter-spacing:.1em; text-transform:uppercase;
    position:relative; overflow:hidden;
    animation:shop-pulse 2.4s ease-in-out infinite;
  }
  .btn-play::after { content:""; position:absolute; left:14px; right:14px; bottom:6px; height:1.5px; border-radius:999px; background:linear-gradient(90deg,transparent,rgba(255,176,74,.9),transparent); }
  .btn-play:hover { animation:none; transform:translateY(-2px); box-shadow:0 0 18px 4px rgba(255,130,0,.7),0 0 52px 8px rgba(255,90,0,.35); }
  @keyframes shop-pulse {
    0%,100% { box-shadow:0 0 10px 2px rgba(255,110,0,.5),0 0 35px 5px rgba(255,80,0,.22); }
    50%      { box-shadow:0 0 16px 3px rgba(255,130,0,.7),0 0 52px 8px rgba(255,90,0,.35); }
  }

  @keyframes ship-float {
    0%,100% { transform:translateY(0px); }
    50%      { transform:translateY(-6px); }
  }
</style>

<div id="shop-root">
  <div class="hg-shell">
    <div class="hg-panel">

      <!-- Frame injecté dans body via _injectFrame() -->

      <!-- HEADER -->
      <div class="hg-header">
        <div class="hg-title">⚙ Hangar</div>
        <div class="hg-meta" id="hg-meta">Configuration vaisseau</div>
        <div class="hg-coins"><div class="hg-coin"></div><span id="hg-coins">0</span></div>
      </div>

      <!-- BODY -->
      <div class="hg-body">

        <!-- Gauche : vaisseau + slots -->
        <div class="hg-left">
          <div class="hg-section-lbl">Vaisseau</div>
          <div class="hg-ship-zone" id="ship-zone">
            <div class="hg-ship-glow"></div>
            <!-- Vaisseau image centré -->
            <div class="hg-ship-center">
              <img src="assets/sprites/hanger-ship.webp"
                style="width:110px;height:110px;object-fit:contain;
                  filter:drop-shadow(0 0 12px rgba(109,228,255,0.5));
                  animation:ship-float 3s ease-in-out infinite;"
                onerror="this.style.display='none'">
            </div>
            <!-- Slots injectés par JS -->
            <div id="slots-container"></div>
          </div>
        </div>

        <!-- Droite : boutique -->
        <div class="hg-right">
          <div class="hg-tabs" id="hg-tabs"></div>
          <div class="hg-cards" id="hg-cards"></div>
        </div>
      </div>

      <!-- INVENTAIRE pleine largeur -->
      <div class="hg-inventory">
        <div class="hg-inv-lbl">Possédés :</div>
        <div class="hg-inv-list" id="hg-inv"></div>
        <div class="hg-inv-hint">Glisser vers un slot</div>
      </div>

      <!-- FOOTER -->
      <div class="hg-footer">
        <div class="hg-footer-hint" id="hg-hint"></div>
        <div class="hg-btns">
          <button class="btn-menu" id="btn-menu">← Menu</button>
          <button class="btn-play" id="btn-play">▶ Jouer</button>
        </div>
      </div>

    </div>
  </div>
</div>`;
  }

  // ─────────────────────────────────────────────────────────
  //  BIND
  // ─────────────────────────────────────────────────────────
  _bindEvents() {
    this._refresh();
    this._initDragDrop();
    this._bindNavButtons();
  }

  _bindNavButtons() {
    const el = this._el.root;
    el.querySelector('#btn-menu')?.addEventListener('click', () => {
      this._frameEl?.remove();
      this._ghost?.remove();
      if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
      if (this._onMouseUp)   window.removeEventListener('mouseup', this._onMouseUp);
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });
    el.querySelector('#btn-play')?.addEventListener('click', () => {
      const p = loadProgress();
      this._frameEl?.remove();
      this._ghost?.remove();
      if (this._onMouseMove) window.removeEventListener('mousemove', this._onMouseMove);
      if (this._onMouseUp)   window.removeEventListener('mouseup', this._onMouseUp);
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.registry.set('currentLevel', p.checkpointLevel || 1);
        this.scene.start('SurvivalScene', { upgrades: p.upgrades });
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  //  REFRESH
  // ─────────────────────────────────────────────────────────
  _refresh() {
    this._progress = loadProgress();
    this._modState = sanitizeModuleState(this._progress.modules);
    // Mise à jour directe du innerHTML — pas de destroy/recreate
    const E = this._el;
    E.coins.textContent = String(this._progress.coins ?? 0);
    E.meta.textContent  = this.fromLevel
      ? `Niveau ${this.levelDone} terminé` : 'Configuration vaisseau';
    const eq = this._modState.slots.filter(Boolean).length;
    E.hint.textContent  = eq > 0
      ? `${eq} module${eq>1?'s':''} équipé${eq>1?'s':''}` : 'Aucun module équipé';

    this._renderSlots();
    this._renderTabs();
    this._renderCards();
    this._renderInventory();
  }

  // ─────────────────────────────────────────────────────────
  //  SLOTS
  // ─────────────────────────────────────────────────────────
  _renderSlots() {
    const cont = this._el.slots;
    cont.innerHTML = '';

    SLOT_DEFS.forEach(def => {
      const modId   = this._modState.slots[def.idx];
      const mod     = modId ? MODULE_CATALOG[modId] : null;
      const locked  = def.id === 'rear' && !this._modState.rearUnlocked;
      const filled  = !!mod && !locked;
      const colorHex= def.color;

      const wrap = document.createElement('div');
      wrap.className = 'hg-slot';
      wrap.dataset.pos = def.pos;

      const typeClass = def.accepts[0] === 'weapon' ? 'weapon-slot' : 'support-slot';
      const box = document.createElement('div');
      box.className = `hg-slot-box ${typeClass} ${filled?'filled':''} ${locked?'locked':''}`;
      box.dataset.slotIdx = def.idx;

      // Icône
      let iconHTML = '';
      if (locked) {
        iconHTML = `<div class="hg-slot-icon">🔒</div>`;
      } else if (filled) {
        const imgSrc = MOD_IMAGES[modId];
        const fallbackEmoji = this._modEmoji(modId);
        iconHTML = imgSrc
          ? `<img class="hg-slot-img" src="${imgSrc}" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'hg-slot-icon',textContent:'${fallbackEmoji}'}))">`
          : `<div class="hg-slot-icon">${fallbackEmoji}</div>`;
      } else {
        iconHTML = `<div class="hg-slot-icon" style="border:1px dashed rgba(94,195,255,0.2);color:rgba(94,195,255,0.3);font-size:16px;">+</div>`;
      }

      const nameColor = locked ? '#7a4400' : filled ? colorHex : '#1a3a52';
      const nameText  = locked ? '300p' : filled ? mod.name : 'Vide';

      box.innerHTML = `
        ${iconHTML}
        <div class="hg-slot-lbl">${def.label}</div>
        <div class="hg-slot-name" style="color:${nameColor};">${nameText}</div>
        ${filled ? `<button class="hg-slot-rm" data-slot="${def.idx}">✕</button>` : ''}
      `;

      if (locked) {
        box.style.cursor = 'pointer';
        box.addEventListener('click', () => this._buyRear());
      }

      wrap.appendChild(box);
      cont.appendChild(wrap);
    });

    // Boutons retirer
    cont.querySelectorAll('.hg-slot-rm').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.slot);
        if (idx === 0) equipModule('basic', 0);
        else unequipModule(idx);
        this._refresh();
        try { this.sound?.play?.('sound_atelier', { volume: 0.4 }); } catch(e) {}
      });
    });
  }

  // ─────────────────────────────────────────────────────────
  //  TABS
  // ─────────────────────────────────────────────────────────
  _renderTabs() {
    const el = this._el.tabs;
    const tabs = [{id:'weapon',label:'Armement'},{id:'support',label:'Modules'}];
    el.innerHTML = tabs.map(t =>
      `<div class="hg-tab ${this._activeTab===t.id?'active':''}" data-tab="${t.id}">${t.label}</div>`
    ).join('');
    el.querySelectorAll('.hg-tab').forEach(t =>
      t.addEventListener('click', () => { this._activeTab = t.dataset.tab; this._refresh(); })
    );
  }

  // ─────────────────────────────────────────────────────────
  //  CARTES BOUTIQUE
  // ─────────────────────────────────────────────────────────
  _renderCards() {
    const el    = this._el.cards;
    // Adapter le nombre de colonnes selon l'onglet
    el.className = `hg-cards ${this._activeTab === 'support' ? 'tab-support' : ''}`;
    const coins = this._progress.coins ?? 0;
    const items = Object.values(MODULE_CATALOG)
      .filter(m => m.slot === this._activeTab && m.id !== 'basic');

    el.innerHTML = items.map(item => {
      const owned    = this._modState.owned.includes(item.id);
      const equipped = this._modState.slots.includes(item.id);
      const canBuy   = !owned && coins >= item.cost;
      const cc       = this._colorHex(item.color);

      let tag = '', btn = '';
      if (equipped) {
        tag = `<span class="hg-card-tag equipped">Équipé</span>`;
        btn = `<button class="hg-card-btn" disabled>Équipé ✓</button>`;
      } else if (owned) {
        tag = `<span class="hg-card-tag owned">Possédé</span>`;
        btn = `<button class="hg-card-btn btn-equip" data-id="${item.id}" style="color:#22c55e;background:rgba(34,197,94,0.08);">Équiper</button>`;
      } else {
        tag = `<span class="hg-card-tag locked">À débloquer</span>`;
        btn = canBuy
          ? `<button class="hg-card-btn btn-buy" data-id="${item.id}"><div class="btn-c"></div>${item.cost}</button>`
          : `<button class="hg-card-btn" disabled style="color:#2a4a6a;"><div class="btn-c" style="opacity:.3;"></div>${item.cost}</button>`;
      }

      // Image
      const imgSrc = item.icon ? `assets/weapons/${item.icon}.webp` : (MOD_IMAGES[item.id] || null);
      const imgHTML = imgSrc
        ? `<img src="${imgSrc}" onerror="this.outerHTML='<div class=hg-card-emoji>${this._modEmoji(item.id)}</div>'">`
        : `<div class="hg-card-emoji">${this._modEmoji(item.id)}</div>`;

      return `<div class="hg-card ${owned?'owned':''} ${equipped?'equipped':''}" style="--cc:${cc}">
        <div class="hg-card-img">${imgHTML}</div>
        <div class="hg-card-body">
          <div class="hg-card-name">${item.name}</div>
          <div class="hg-card-desc">${item.desc.replace(/\\n/g,'<br>')}</div>
          ${tag}
        </div>
        ${btn}
      </div>`;
    }).join('');

    el.querySelectorAll('.btn-buy').forEach(b => b.addEventListener('click', () => {
      const item = MODULE_CATALOG[b.dataset.id];
      if (!item || (this._progress.coins ?? 0) < item.cost) return;
      purchaseModule(b.dataset.id);
      requestAnimationFrame(() => this._refresh());
      try { this.sound?.play?.('coin', { volume: 0.3 }); } catch(e) {}
    }));

    el.querySelectorAll('.btn-equip').forEach(b => b.addEventListener('click', () => {
      const mod = MODULE_CATALOG[b.dataset.id];
      if (!mod) return;
      const idx = mod.slot === 'weapon' ? 0
        : this._modState.slots.findIndex((s,i) => i>0 && !s && !(i===3 && !this._modState.rearUnlocked));
      if (idx < 0) { this._flash('Aucun slot disponible'); return; }
      equipModule(b.dataset.id, idx);
      requestAnimationFrame(() => this._refresh());
      try { this.sound?.play?.('sound_atelier', { volume: 0.4 }); } catch(e) {}
    }));
  }

  // ─────────────────────────────────────────────────────────
  //  INVENTAIRE
  // ─────────────────────────────────────────────────────────
  _renderInventory() {
    const el   = this._el.inv;
    const owned= this._modState.owned || [];

    if (owned.length === 0) {
      el.innerHTML = `<div style="color:#1a4a6a;font-size:.7rem;padding:0 8px;">Aucun module possédé</div>`;
      return;
    }

    el.innerHTML = owned.map(id => {
      const mod = MODULE_CATALOG[id];
      if (!mod) return '';
      const eq  = this._modState.slots.includes(id);
      const cc  = this._colorHex(mod.color);
      const imgSrc = mod.icon ? `assets/weapons/${mod.icon}.webp` : (MOD_IMAGES[id] || null);
      const fallback = this._modEmoji(id);
      const inner = imgSrc
        ? `<img src="${imgSrc}" style="width:46px;height:46px;object-fit:contain;" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'inv-emoji',textContent:'${fallback}'}))">`
        : `<span class="inv-emoji">${fallback}</span>`;

      return `<div class="hg-inv-item ${eq?'equipped':''}"
        data-id="${id}"
        style="border-color:${cc}44;" title="${mod.name}">
        ${inner}
        <div class="inv-lbl">${mod.name}</div>
      </div>`;
    }).join('');
  }

  // ─────────────────────────────────────────────────────────
  //  DRAG & DROP
  // ─────────────────────────────────────────────────────────
  _initDragDrop() {
    const ghost   = this._ghost;
    let dragId    = null;
    let dragging  = false;

    // Handler mousedown — stocké pour rebinding après refresh
    this._onMouseDown = (e) => {
      const item = e.target.closest('.hg-inv-item');
      if (!item) return;
      e.preventDefault();
      dragId   = item.dataset.id;
      dragging = true;
      item.classList.add('dragging');

      const mod    = MODULE_CATALOG[dragId];
      const imgSrc = mod?.icon ? `assets/weapons/${mod.icon}.webp` : (MOD_IMAGES[dragId] || null);
      ghost.innerHTML = imgSrc
        ? `<img src="${imgSrc}" style="width:52px;height:52px;object-fit:contain;">`
        : `<span style="font-size:24px;">${this._modEmoji(dragId)}</span>`;
      ghost.style.left    = e.clientX + 'px';
      ghost.style.top     = e.clientY + 'px';
      ghost.style.display = 'flex';
      this._highlightSlots(dragId, true);
    };

    // Binder sur le root initial
    this._el.root.addEventListener('mousedown', this._onMouseDown);

    // DRAG MOVE
    this._onMouseMove = (e) => {
      if (!dragging) return;
      ghost.style.left = e.clientX + 'px';
      ghost.style.top  = e.clientY + 'px';
      // Highlight slot sous curseur
      this._el.root.querySelectorAll('.hg-slot-box').forEach(b => b.classList.remove('hover-active'));
      const slot = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.hg-slot-box');
      if (slot) slot.classList.add('hover-active');
    };
    window.addEventListener('mousemove', this._onMouseMove);

    // DRAG END
    this._onMouseUp = (e) => {
      if (!dragging) return;
      dragging = false;
      ghost.style.display = 'none';
      this._el.root.querySelectorAll('.hg-inv-item.dragging').forEach(i => i.classList.remove('dragging'));
      this._el.root.querySelectorAll('.hg-slot-box.hover-active').forEach(b => b.classList.remove('hover-active'));
      this._highlightSlots(null, false);

      const box = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.hg-slot-box');
      if (box && dragId) {
        const idx = parseInt(box.dataset.slotIdx);
        if (!isNaN(idx)) {
          const def = SLOT_DEFS[idx];
          const mod = MODULE_CATALOG[dragId];
          if (mod && def.accepts.includes(mod.slot) && !(idx === 3 && !this._modState.rearUnlocked)) {
            equipModule(dragId, idx);
            this._refresh();
            try { this.sound?.play?.('sound_atelier', { volume: 0.4 }); } catch(e) {}
          } else {
            this._shakeSlot(box);
          }
        }
      }
      dragId = null;
    };
    window.addEventListener('mouseup', this._onMouseUp);
  }


  // ─────────────────────────────────────────────────────────
  //  DRAG HELPERS
  // ─────────────────────────────────────────────────────────
  _highlightSlots(modId, on) {
    if (!this._el?.root) return;
    this._el.root.querySelectorAll('.hg-slot-box').forEach(box => {
      if (!on) { box.classList.remove('droptarget'); return; }
      const idx = parseInt(box.dataset.slotIdx);
      const def = SLOT_DEFS[idx];
      const mod = MODULE_CATALOG[modId];
      const ok  = mod && def && def.accepts.includes(mod.slot)
                  && !(idx === 3 && !this._modState.rearUnlocked);
      box.classList.toggle('droptarget', ok);
    });
  }

  _shakeSlot(el) {
    el?.animate([
      {transform:'translateX(-5px)'},{transform:'translateX(5px)'},
      {transform:'translateX(-4px)'},{transform:'translateX(4px)'},
      {transform:'translateX(0)'}
    ], {duration:280, easing:'ease-out'});
  }

  // ─────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────
  _modEmoji(id) {
    return ({basic:'🔹',spread:'💥',double:'⚡',laser:'🔆',
      turret:'🎯',rear_gun:'🔁',shield:'🛡',regen:'💚',magnet:'🧲'})[id] || '⚙';
  }

  _colorHex(c) {
    if (!c) return '#38bdf8';
    if (typeof c === 'string') return c;
    return '#' + c.toString(16).padStart(6,'0');
  }
}
