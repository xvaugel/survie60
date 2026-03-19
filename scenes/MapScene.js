// ============================================================
//  MapScene.js v3 — Carte galactique animée + frame métal
//  Nœuds dessinés sur canvas HTML via scene.add.dom()
//  Flux lumineux animés, scanner tournant, étoiles scintillantes
// ============================================================

import { loadProgress } from '../systems/storage.js';

const NODES = [
  { level: 1,  label: 'SECTEUR I',    zone: 'Initiation' },
  { level: 6,  label: 'SECTEUR II',   zone: 'Ceinture de débris' },
  { level: 11, label: 'SECTEUR III',  zone: 'Nébuleuse rouge' },
  { level: 16, label: 'SECTEUR IV',   zone: 'Champ de mines' },
  { level: 21, label: 'SECTEUR V',    zone: 'Frontière obscure' },
  { level: 26, label: 'SECTEUR VI',   zone: 'Zone de quarantaine' },
  { level: 31, label: 'SECTEUR VII',  zone: 'Abîme stellaire' },
  { level: 36, label: 'SECTEUR VIII', zone: 'Cœur du vide' },
  { level: 41, label: 'SECTEUR IX',   zone: 'Singularité' },
  { level: 46, label: 'SECTEUR X',    zone: 'Néant final' },
];

export class MapScene extends Phaser.Scene {
  constructor() { super('MapScene'); }

  preload() {
    if (!this.textures.exists('bg_map')) {
      this.load.image('bg_map', 'assets/backgrounds/bg_map_galaxy.webp');
    }
    for (let i = 1; i <= 10; i++) {
      const key = `enemy-boss-level-${i}`;
      if (!this.textures.exists(key))
        this.load.image(key, `assets/sprites/enemy-boss-level-${i}.webp`);
    }
  }

  create() {
    const W  = this.scale.width;
    const H  = this.scale.height;

    // ── Fond Phaser ──────────────────────────────────────────
    this.cameras.main.setBackgroundColor('#020814');
    if (this.textures.exists('bg_map')) {
      this.add.image(W/2, H/2, 'bg_map').setDisplaySize(W, H).setAlpha(0.28);
    }

    const progress  = loadProgress();
    const unlocked  = progress.unlockedCheckpoints || [1];
    const checkpoint= progress.checkpointLevel || 1;
    const coins     = progress.coins ?? 0;

    // Positions en zigzag sur toute la hauteur
    const positions = this._calcPositions(W, H);

    // ── DOM overlay — carte SVG animée + frame ───────────────
    const html = this._buildMapHTML(W, H, positions, unlocked, checkpoint, coins);
    const domEl = this.add.dom(W/2, H/2).createFromHTML(html).setDepth(10);
    domEl.node.style.width  = W + 'px';
    domEl.node.style.height = H + 'px';

    // ── Bind events ──────────────────────────────────────────
    this._bindMapEvents(domEl, progress, unlocked);

    this.cameras.main.fadeIn(350, 0, 0, 0);
  }

  _calcPositions(W, H) {
    const topY    = 80;
    const bottomY = H - 80;
    const count   = NODES.length;
    const stepY   = (bottomY - topY) / (count - 1);
    const cols    = [W * 0.28, W * 0.52, W * 0.72];
    return NODES.map((_, i) => ({
      x: Math.round(cols[i % 3]),
      y: Math.round(bottomY - i * stepY),
    }));
  }

  _buildMapHTML(W, H, positions, unlocked, checkpoint, coins) {
    const isCurrent = (i) => {
      if (i === NODES.length - 1) return unlocked.includes(NODES[i].level) && NODES[i].level <= checkpoint;
      return unlocked.includes(NODES[i].level) && NODES[i].level <= checkpoint && NODES[i+1].level > checkpoint;
    };

    // Construire les paths SVG entre nœuds
    let pathsHTML = '';
    for (let i = 0; i < positions.length - 1; i++) {
      const a = positions[i], b = positions[i+1];
      const isOpen = unlocked.includes(NODES[i+1].level);
      const mx = (a.x + b.x) / 2 + (i % 2 === 0 ? 55 : -55);
      const my = (a.y + b.y) / 2;
      const d  = `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`;
      const pathId = `p${i}`;

      if (isOpen) {
        // Trace de base
        pathsHTML += `<path d="${d}" fill="none" stroke="rgba(40,140,255,0.18)" stroke-width="2.5" stroke-linecap="round"/>`;
        // Flux animé
        pathsHTML += `<path id="${pathId}" d="${d}" fill="none" stroke="rgba(109,210,255,0.7)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="14 200">
          <animate attributeName="stroke-dashoffset" from="220" to="0" dur="${2.6 + i*0.3}s" repeatCount="indefinite"/>
        </path>`;
        // Étincelles
        for (let s = 0; s < 2; s++) {
          const delay = (s * (2.6 + i*0.3) / 2).toFixed(1);
          pathsHTML += `<circle r="2.8" fill="rgba(109,228,255,0.95)">
            <animateMotion dur="${(2.6 + i*0.3).toFixed(1)}s" repeatCount="indefinite" begin="${delay}s">
              <mpath href="#${pathId}"/>
            </animateMotion>
          </circle>`;
        }
      } else {
        pathsHTML += `<path d="${d}" fill="none" stroke="rgba(20,60,110,0.3)" stroke-width="1.5" stroke-dasharray="4 10" stroke-linecap="round"/>`;
      }
    }

    // Nœuds
    let nodesHTML = '';
    positions.forEach((pos, i) => {
      const node    = NODES[i];
      const isOpen  = unlocked.includes(node.level);
      const current = isCurrent(i);
      const R       = current ? 26 : 20;
      const bossLevel = node.level - 1;
      const hasBoss = bossLevel > 0 && bossLevel % 5 === 0 && isOpen;
      const side    = pos.x < W / 2 ? 1 : -1;
      const mx      = pos.x + side * 72;
      const my      = pos.y - 10;

      if (isOpen) {
        // Anneau pulsant nœud actuel
        if (current) {
          nodesHTML += `<circle cx="${pos.x}" cy="${pos.y}" r="${R+14}" fill="none" stroke="rgba(109,228,255,0.2)" stroke-width="1.5">
            <animate attributeName="r" values="${R+10};${R+28};${R+10}" dur="2.2s" repeatCount="indefinite"/>
            <animate attributeName="opacity" values="0.5;0;0.5" dur="2.2s" repeatCount="indefinite"/>
          </circle>`;
        }

        // Cercle principal
        const strokeColor = current ? 'rgba(109,228,255,0.9)' : 'rgba(56,180,255,0.65)';
        const strokeW     = current ? '2.5' : '1.5';
        nodesHTML += `
          <circle cx="${pos.x}" cy="${pos.y}" r="${R}" fill="url(#nodeGrad)"
            stroke="${strokeColor}" stroke-width="${strokeW}"/>`;

        // Scanner tournant
        if (current) {
          nodesHTML += `<g transform="translate(${pos.x},${pos.y})">
            <path d="M-${R+7},0 A${R+7},${R+7} 0 0,1 ${R+7},0" fill="none"
              stroke="rgba(109,228,255,0.55)" stroke-width="2" stroke-linecap="round">
              <animateTransform attributeName="transform" type="rotate"
                from="0" to="360" dur="2.8s" repeatCount="indefinite"/>
            </path>
          </g>`;
        }

        // Numéro
        nodesHTML += `<text x="${pos.x}" y="${pos.y+1}" fill="white"
          font-family="Inter,Arial,sans-serif" font-weight="900"
          font-size="${current?'15':'12'}" text-anchor="middle" dominant-baseline="middle">${i+1}</text>`;

        // Labels
        const labelY = pos.y + R + 14;
        nodesHTML += `<text x="${pos.x}" y="${labelY}" fill="${current?'#00e8ff':'#60b0d8'}"
          font-family="Inter,Arial,sans-serif" font-weight="700" font-size="12"
          text-anchor="middle" letter-spacing="2">${node.label}</text>`;
        nodesHTML += `<text x="${pos.x}" y="${labelY+16}" fill="#2a6a88"
          font-family="Inter,Arial,sans-serif" font-size="11"
          text-anchor="middle">${node.zone}</text>`;

        // Zone interactive nœud
        nodesHTML += `<circle cx="${pos.x}" cy="${pos.y}" r="${R+12}"
          fill="transparent" class="node-hit" data-level="${node.level}" style="cursor:pointer"/>`;

        // Médaillon boss
        if (hasBoss) {
          nodesHTML += `
          <g class="boss-medallion" data-boss="${bossLevel}" style="cursor:pointer">
            <line x1="${pos.x + side*28}" y1="${pos.y}" x2="${mx - side*18}" y2="${my}"
              stroke="rgba(245,166,35,0.3)" stroke-width="1.2"/>
            <circle cx="${mx}" cy="${my}" r="20" fill="rgba(26,10,0,0.92)"
              stroke="rgba(245,166,35,0.8)" stroke-width="1.5">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="1.6s" repeatCount="indefinite"/>
            </circle>
            <clipPath id="boss-clip-${bossLevel}">
              <circle cx="${mx}" cy="${my}" r="17"/>
            </clipPath>
            <image href="assets/sprites/enemy-boss-level-${Math.ceil(bossLevel/5)}.webp"
              x="${mx-17}" y="${my-17}" width="34" height="34"
              clip-path="url(#boss-clip-${bossLevel})"
              preserveAspectRatio="xMidYMid slice"/>
            <circle cx="${mx}" cy="${my}" r="26" fill="rgba(245,166,35,0)" stroke="rgba(245,166,35,0.15)" stroke-width="1"/>
            <text x="${mx}" y="${my-26}" fill="#cc7700"
              font-family="Inter,Arial,sans-serif" font-weight="700" font-size="10"
              text-anchor="middle">LVL ${bossLevel}</text>
            <text x="${mx}" y="${my+32}" fill="#f5a623"
              font-family="Inter,Arial,sans-serif" font-weight="700" font-size="9"
              text-anchor="middle" letter-spacing="2">BOSS</text>
          </g>`;
        }

      } else {
        // Verrouillé
        nodesHTML += `<circle cx="${pos.x}" cy="${pos.y}" r="${R}"
          fill="rgba(10,24,50,0.7)" stroke="rgba(20,60,110,0.35)" stroke-width="1.5"/>`;
        nodesHTML += `<text x="${pos.x}" y="${pos.y+1}" fill="rgba(60,110,170,0.5)"
          font-family="Inter,Arial,sans-serif" font-size="14"
          text-anchor="middle" dominant-baseline="middle">×</text>`;
        // Label suivant si secteur précédent débloqué
        if (i > 0 && unlocked.includes(NODES[i-1]?.level)) {
          nodesHTML += `<text x="${pos.x}" y="${pos.y+R+14}" fill="rgba(30,70,120,0.6)"
            font-family="Inter,Arial,sans-serif" font-size="11"
            text-anchor="middle">${node.label}</text>`;
        }
      }
    });

    return `
<style>
  * { box-sizing:border-box; margin:0; padding:0; }
  #map-root {
    font-family: Inter, Arial, sans-serif;
    width:100vw; height:100vh;
    position:relative; pointer-events:none; overflow:hidden;
  }

  /* Frame */
  .f-c { position:absolute; pointer-events:none; z-index:4; background-size:contain; background-repeat:no-repeat; }
  .f-tl { top:-4px; left:-4px; width:180px; height:118px; background-image:url('assets/ui/ui-corner-tl.webp'); background-position:top left; }
  .f-tr { top:-4px; right:-4px; width:180px; height:116px; background-image:url('assets/ui/ui-corner-tr.webp'); background-position:top right; }
  .f-bl { bottom:-4px; left:-4px; width:100px; height:122px; background-image:url('assets/ui/ui-corner-bl.webp'); background-position:bottom left; }
  .f-br { bottom:-4px; right:-4px; width:100px; height:122px; background-image:url('assets/ui/ui-corner-br.webp'); background-position:bottom right; }
  .f-bt { position:absolute; top:-14px; left:155px; right:155px; height:38px; pointer-events:none; z-index:3;
    background-image:url('assets/ui/ui-border-top.webp'); background-size:100% 100%; }
  .f-bb { position:absolute; bottom:-14px; left:90px; right:90px; height:38px; pointer-events:none; z-index:3;
    background-image:url('assets/ui/ui-border-bottom.webp'); background-size:100% 100%; }

  /* Titre */
  .map-title {
    position:absolute; top:18px; left:50%; transform:translateX(-50%);
    display:inline-flex; align-items:center; gap:14px; pointer-events:none; z-index:5;
    color:#6de3ff; font-size:.82rem; font-weight:900; letter-spacing:.2em; text-transform:uppercase;
    white-space:nowrap;
  }
  .map-title-line {
    display:block; width:70px; height:1px;
    background:linear-gradient(90deg,transparent,rgba(109,227,255,0.55));
  }
  .map-title-line.right { background:linear-gradient(270deg,transparent,rgba(109,227,255,0.55)); }

  /* Badge pièces */
  .map-coins {
    position:absolute; top:14px; right:24px; z-index:5;
    display:flex; align-items:center; gap:8px; pointer-events:none;
    background:linear-gradient(180deg,rgba(10,24,51,.9),rgba(6,13,28,.95));
    border:1px solid rgba(110,210,255,0.2); border-radius:12px;
    padding:7px 14px; color:#ffd089; font-weight:900; font-size:.9rem;
  }
  .coin-dot { width:14px; height:14px; border-radius:50%;
    background:linear-gradient(180deg,#ffd26a,#ff9800); flex:0 0 auto; }

  /* Tooltip */
  .map-tooltip {
    position:absolute; pointer-events:none; z-index:20;
    background:rgba(4,10,22,0.97); border:1px solid rgba(94,195,255,0.35);
    border-radius:10px; padding:12px 16px; min-width:180px;
    opacity:0; transition:opacity .18s ease;
  }
  .map-tooltip.visible { opacity:1; }
  .tt-title { color:#00c8ff; font-size:.82rem; font-weight:700; letter-spacing:.1em; text-transform:uppercase; margin-bottom:4px; }
  .tt-zone  { color:#4a7090; font-size:.75rem; margin-bottom:4px; }
  .tt-levels{ color:#2a5a72; font-size:.72rem; }
  .tt-accent{ position:absolute; left:14px; right:14px; bottom:6px; height:1.5px; border-radius:999px;
    background:linear-gradient(90deg,transparent,rgba(101,228,255,.7),transparent); }

  /* Bouton retour — même style que les boutons bleus du menu */
  .map-back {
    position:absolute; bottom:22px; left:50%; transform:translateX(-50%);
    pointer-events:all; z-index:5;
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 200px; padding: 16px 32px; border-radius: 13px;
    cursor: pointer; color: white; font-weight: 900;
    letter-spacing: .08em; text-transform: uppercase;
    border: 1px solid rgba(104,211,255,.22);
    background: linear-gradient(180deg, rgba(9,21,44,.96), rgba(6,13,28,.98));
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.02), 0 0 18px rgba(0,140,255,.14);
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    font-family: inherit; font-size: .92rem;
    position: absolute; bottom: 22px; left: 50%;
    transform: translateX(-50%);
    overflow: hidden;
  }
  .map-back::before {
    content: ""; position: absolute; inset: 0;
    background: linear-gradient(180deg, rgba(255,255,255,.05), transparent 35%);
    pointer-events: none;
  }
  .map-back::after {
    content: ""; position: absolute; left: 18px; right: 18px; bottom: 7px;
    height: 2px; border-radius: 999px;
    background: linear-gradient(90deg, transparent, rgba(101,228,255,.9), transparent);
  }
  .map-back:hover {
    transform: translateX(-50%) translateY(-2px);
    border-color: rgba(104,211,255,.4);
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.02), 0 0 28px rgba(0,160,255,.22);
  }
  .map-back:active { transform: translateX(-50%) translateY(0); }

  /* SVG interactif */
  #map-svg { position:absolute; inset:0; pointer-events:all; }
  .node-hit:hover ~ circle { opacity:.8; }
</style>

<div id="map-root">
  <!-- Coins frame -->
  <div class="f-c f-tl"></div>
  <div class="f-c f-tr"></div>
  <div class="f-c f-bl"></div>
  <div class="f-c f-br"></div>
  <div class="f-c f-bt"></div>
  <div class="f-c f-bb"></div>

  <!-- Titre -->
  <div class="map-title">
    <span class="map-title-line"></span>
    CARTE GALACTIQUE
    <span class="map-title-line right"></span>
  </div>

  <!-- Badge pièces -->
  <div class="map-coins">
    <div class="coin-dot"></div>
    <span>${coins}</span>
  </div>

  <!-- SVG carte -->
  <svg id="map-svg" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="nodeGrad" cx="38%" cy="32%" r="62%">
        <stop offset="0%" stop-color="#60d4ff" stop-opacity="1"/>
        <stop offset="100%" stop-color="#005590" stop-opacity="1"/>
      </radialGradient>
    </defs>
    ${pathsHTML}
    ${nodesHTML}
  </svg>

  <!-- Tooltip -->
  <div class="map-tooltip" id="map-tooltip">
    <div class="tt-title" id="tt-title"></div>
    <div class="tt-zone"  id="tt-zone"></div>
    <div class="tt-levels" id="tt-levels"></div>
    <div class="tt-accent"></div>
  </div>

  <!-- Bouton retour -->
  <button class="map-back" id="map-back">← Retour au menu</button>
</div>`;
  }

  _bindMapEvents(domEl, progress, unlocked) {
    const el  = domEl.node;
    const tip = el.querySelector('#map-tooltip');

    const launch = (level, isBoss=false) => {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.registry.set('currentLevel', level);
        this.scene.start('SurvivalScene', {
          upgrades:    { ...progress.upgrades },
          weaponState: undefined,
          isBossReplay: isBoss,
        });
      });
    };

    // Nœuds
    el.querySelectorAll('.node-hit').forEach(zone => {
      const level = parseInt(zone.dataset.level);
      const node  = NODES.find(n => n.level === level);
      if (!node) return;

      zone.addEventListener('mouseenter', (e) => {
        const rect = el.querySelector('#map-svg').getBoundingClientRect();
        const cx   = parseFloat(zone.getAttribute('cx'));
        const cy   = parseFloat(zone.getAttribute('cy'));
        const scaleX = rect.width  / parseFloat(el.querySelector('#map-svg').getAttribute('viewBox').split(' ')[2]);
        const scaleY = rect.height / parseFloat(el.querySelector('#map-svg').getAttribute('viewBox').split(' ')[3]);
        let tx = cx * scaleX + 20;
        let ty = cy * scaleY - 30;
        if (tx + 200 > rect.width) tx = cx * scaleX - 220;
        ty = Math.max(10, Math.min(ty, rect.height - 100));
        tip.style.left = tx + 'px';
        tip.style.top  = ty + 'px';
        el.querySelector('#tt-title').textContent  = node.label;
        el.querySelector('#tt-zone').textContent   = node.zone;
        el.querySelector('#tt-levels').textContent = `Niveaux ${node.level} – ${node.level + 4}`;
        tip.classList.add('visible');
      });
      zone.addEventListener('mouseleave', () => tip.classList.remove('visible'));
      zone.addEventListener('click', () => launch(level));
    });

    // Boss médaillons
    el.querySelectorAll('.boss-medallion').forEach(m => {
      const bossLevel = parseInt(m.dataset.boss);
      m.addEventListener('click', () => launch(bossLevel, true));
    });

    // Retour menu
    el.querySelector('#map-back')?.addEventListener('click', () => {
      this.cameras.main.fadeOut(280, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('MenuScene'));
    });
  }
}
