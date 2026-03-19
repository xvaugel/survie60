// ============================================================
//  SupplySystem.js — Ravitaillement inter-niveaux
//
//  Remplace ShopSystem pour la boutique entre les niveaux.
//  5 upgrades temporaires (par run), prix progressifs.
//  Les armes/modules permanents sont dans ShopScene (Hangar).
//
//  Export : openSupplyOverlay(scene)
// ============================================================

import { playSfx } from './AudioConfig.js';

const P = {
  bg:       0x05080f,
  panel:    0x080f1c,
  border:   0x1a3652,
  cyan:     0x00c8ff,
  cyanS:    0x38bdf8,
  gold:     0xf5a623,
  green:    0x22c55e,
  red:      0xff4455,
  gray:     0x2a3a4c,
};
const FONT  = { fontFamily: '"Courier New", Courier, monospace', fontStyle: 'bold' };
const FONTB = { fontFamily: '"Courier New", Courier, monospace' };

// ─────────────────────────────────────────────────────────────
//  CATALOGUE DES UPGRADES DE RUN
// ─────────────────────────────────────────────────────────────
const UPGRADES = [
  {
    id:       'fireRate',
    name:     'CADENCE',
    desc:     'Cadence de tir\n−10% cooldown',
    basePrice: 10,
    maxStacks: 5,
    color:    0x38bdf8,
    icon:     'cadence',
    imageKey: 'upgrade-firerate',
    apply: (scene, stacks) => {
      const mult = Math.max(0.45, 1 - stacks * 0.10);
      scene.autoShootDelay = Math.max(120, Math.round(650 * mult));
    },
  },
  {
    id:       'damage',
    name:     'DÉGÂTS',
    desc:     'Dégâts des balles\n+20% par stack',
    basePrice: 12,
    maxStacks: 4,
    color:    0xef4444,
    icon:     'damage',
    imageKey: 'upgrade-power-damage',
    apply: (scene, stacks) => {
      scene.bulletDamageMultiplier = 1 + stacks * 0.20;
    },
  },
  {
    id:       'speed',
    name:     'VITESSE',
    desc:     'Vitesse du vaisseau\n+15 px/s par stack',
    basePrice: 8,
    maxStacks: 4,
    color:    0x22c55e,
    icon:     'speed',
    imageKey: 'upgrade-speedup',
    apply: (scene, stacks) => {
      scene.playerSpeed = 220 + stacks * 15;
    },
  },
  {
    id:       'heal',
    name:     'SOIN',
    desc:     '+25 HP immédiat\nPas de limite',
    basePrice: 14,
    maxStacks: Infinity,
    color:    0xf5a623,
    icon:     'heal',
    imageKey: 'upgrade-health',
    apply: (scene) => {
      const max = scene.maxPlayerLife || 100;
      scene.playerLife = Math.min(max, (scene.playerLife || 0) + 25);
    },
  },
  {
    id:       'shield',
    name:     'BOUCLIER',
    desc:     'Absorbe 1 hit\nMax 2 charges',
    basePrice: 18,
    maxStacks: 2,
    color:    0x06b6d4,
    icon:     'shield',
    imageKey: 'upgrade-shield',
    apply: (scene, stacks) => {
      // Injecte dans ModuleRuntime si disponible, sinon flag direct
      if (scene.moduleRuntime?.shield) {
        scene.moduleRuntime.shield.active  = true;
        scene.moduleRuntime.shield.charged = true;
      } else {
        scene.tempShieldCharges = stacks;
      }
    },
  },
];

// Prix progressif : basePrice × 1 + 0.6 × (stack actuel)
function getPrice(upgrade, currentStacks) {
  return Math.round(upgrade.basePrice * (1 + 0.6 * currentStacks));
}

// ─────────────────────────────────────────────────────────────
//  DESSIN DES ICÔNES
// ─────────────────────────────────────────────────────────────
function drawUpgradeIcon(g, cx, cy, icon, color, r = 20) {
  g.fillStyle(color, 0.12); g.fillCircle(cx, cy, r + 4);
  g.lineStyle(1.5, color, 0.5); g.strokeCircle(cx, cy, r);
  g.fillStyle(color, 0.9);

  switch (icon) {
    case 'cadence':
      // Flèche vers le haut = tir rapide
      g.fillTriangle(cx, cy - r * 0.7, cx - r * 0.5, cy + r * 0.3, cx + r * 0.5, cy + r * 0.3);
      g.fillRect(cx - r * 0.15, cy + r * 0.1, r * 0.3, r * 0.5);
      break;
    case 'damage':
      // Cible / explosion
      g.fillStyle(color, 0.3); g.fillCircle(cx, cy, r * 0.65);
      g.fillStyle(color, 0.9);
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        const x1 = cx + Math.cos(a) * r * 0.4;
        const y1 = cy + Math.sin(a) * r * 0.4;
        const x2 = cx + Math.cos(a) * r * 0.85;
        const y2 = cy + Math.sin(a) * r * 0.85;
        g.lineStyle(2, color, 0.9); g.lineBetween(x1, y1, x2, y2);
      }
      g.fillStyle(color, 1); g.fillCircle(cx, cy, r * 0.2);
      break;
    case 'speed':
      // Double chevron vers la droite
      for (let i = 0; i < 2; i++) {
        const ox = cx - r * 0.3 + i * r * 0.4;
        g.fillTriangle(ox + r * 0.4, cy, ox, cy - r * 0.55, ox, cy + r * 0.55);
      }
      break;
    case 'heal':
      // Croix médicale
      g.fillRect(cx - r * 0.15, cy - r * 0.6, r * 0.3, r * 1.2);
      g.fillRect(cx - r * 0.6, cy - r * 0.15, r * 1.2, r * 0.3);
      break;
    case 'shield':
      // Écusson
      g.fillStyle(color, 0.25);
      g.fillTriangle(cx, cy - r * 0.7, cx - r * 0.65, cy - r * 0.1, cx, cy + r * 0.75);
      g.fillTriangle(cx, cy - r * 0.7, cx + r * 0.65, cy - r * 0.1, cx, cy + r * 0.75);
      g.lineStyle(2, color, 0.9);
      g.strokeTriangle(cx - r * 0.65, cy - r * 0.1, cx + r * 0.65, cy - r * 0.1, cx, cy + r * 0.75);
      g.lineBetween(cx - r * 0.65, cy - r * 0.1, cx, cy - r * 0.7);
      g.lineBetween(cx + r * 0.65, cy - r * 0.1, cx, cy - r * 0.7);
      g.lineStyle(1.5, 0xffffff, 0.4);
      g.lineBetween(cx, cy - r * 0.45, cx, cy + r * 0.5);
      break;
  }
}

// ─────────────────────────────────────────────────────────────
//  CARTE UPGRADE
// ─────────────────────────────────────────────────────────────
function buildCard(scene, x, y, w, h, upgrade, stacks, coins, onBuy, container) {
  const price  = getPrice(upgrade, stacks);
  const maxed  = stacks >= upgrade.maxStacks;
  const canBuy = !maxed && coins >= price;
  const R      = 10;

  // ── Fond ──────────────────────────────────────────────────
  const g = scene.add.graphics();
  g.fillStyle(0x040c18, 0.97);
  g.fillRoundedRect(x, y, w, h, R);
  g.lineStyle(maxed ? 2 : 1.5, maxed ? upgrade.color : P.border, maxed ? 0.8 : 0.35);
  g.strokeRoundedRect(x, y, w, h, R);
  g.fillStyle(upgrade.color, maxed ? 1 : 0.6);
  g.fillRoundedRect(x + 12, y + h - 3, w - 24, 2, 1);
  container.add(g);

  // ── Image (50% de la hauteur) ─────────────────────────────
  const imgH   = Math.round(h * 0.48);
  const imgCx  = x + w / 2;
  const imgCy  = y + imgH / 2;
  const imgSize = Math.min(w - 8, imgH - 4);

  if (upgrade.imageKey && scene.textures.exists(upgrade.imageKey)) {
    const img = scene.add.image(imgCx, imgCy, upgrade.imageKey)
      .setDisplaySize(imgSize, imgSize)
      .setAlpha(maxed ? 1 : 0.95);
    container.add(img);
  } else {
    const iconG = scene.add.graphics();
    drawUpgradeIcon(iconG, imgCx, imgCy, upgrade.icon, upgrade.color, Math.min(imgSize * 0.38, 28));
    container.add(iconG);
  }

  // Séparateur image / infos
  const sepG = scene.add.graphics();
  sepG.lineStyle(1, upgrade.color, 0.25);
  sepG.lineBetween(x + 10, y + imgH, x + w - 10, y + imgH);
  container.add(sepG);

  // ── Nom ───────────────────────────────────────────────────
  const nameY = y + imgH + 10;
  container.add(scene.add.text(x + w / 2, nameY, upgrade.name, {
    ...FONT, fontSize: '17px', color: '#ffffff',
    stroke: '#000000', strokeThickness: 3,
  }).setOrigin(0.5, 0));

  // ── Description ───────────────────────────────────────────
  const descY = nameY + 26;
  container.add(scene.add.text(x + w / 2, descY, upgrade.desc, {
    ...FONTB, fontSize: '13px', color: '#9ecfdf',
    wordWrap: { width: w - 16 }, align: 'center', lineSpacing: 3,
  }).setOrigin(0.5, 0));

  // ── Stacks ────────────────────────────────────────────────
  const stackY = y + h - 46;
  if (upgrade.maxStacks !== Infinity) {
    for (let i = 0; i < upgrade.maxStacks; i++) {
      const dotG = scene.add.graphics();
      const dx   = x + w / 2 - (upgrade.maxStacks - 1) * 9 + i * 18;
      dotG.fillStyle(i < stacks ? upgrade.color : 0x1a3652, i < stacks ? 1 : 0.5);
      dotG.fillCircle(dx, stackY, i < stacks ? 6 : 5);
      if (i < stacks) {
        dotG.lineStyle(1.5, 0xffffff, 0.4);
        dotG.strokeCircle(dx, stackY, 6);
      }
      container.add(dotG);
    }
  } else if (stacks > 0) {
    container.add(scene.add.text(x + w / 2, stackY, `×${stacks} acheté`, {
      ...FONT, fontSize: '13px', color: `#${upgrade.color.toString(16).padStart(6,'0')}`,
    }).setOrigin(0.5));
  }

  // ── Bouton prix ───────────────────────────────────────────
  const btnH = 34;
  const btnY = y + h - btnH - 2;
  const btnW = w - 8;
  const btnX = x + 4;

  const btnG = scene.add.graphics();
  const bColor = maxed ? upgrade.color : canBuy ? upgrade.color : 0x2a3a4c;
  btnG.fillStyle(maxed ? 0x0a1e12 : canBuy ? 0x081828 : 0x080808, 0.98);
  btnG.fillRoundedRect(btnX, btnY, btnW, btnH, { tl: 0, tr: 0, bl: R - 2, br: R - 2 });
  btnG.lineStyle(1.5, bColor, maxed ? 0.7 : canBuy ? 0.8 : 0.2);
  btnG.strokeRoundedRect(btnX, btnY, btnW, btnH, { tl: 0, tr: 0, bl: R - 2, br: R - 2 });
  container.add(btnG);

  if (maxed) {
    container.add(scene.add.text(btnX + btnW / 2, btnY + btnH / 2, '✓  MAX', {
      ...FONT, fontSize: '15px', color: `#${upgrade.color.toString(16).padStart(6,'0')}`,
    }).setOrigin(0.5));
  } else {
    // Coin icon
    const coinG = scene.add.graphics();
    coinG.fillStyle(P.gold, 1);     coinG.fillCircle(btnX + 18, btnY + btnH / 2, 8);
    coinG.fillStyle(0xf8d060, 1);   coinG.fillCircle(btnX + 18, btnY + btnH / 2, 6);
    coinG.fillStyle(0xffffff, 0.35); coinG.fillEllipse(btnX + 16, btnY + btnH / 2 - 2, 4, 3);
    container.add(coinG);

    const priceLabel = canBuy ? String(price) : `${price} — manque`;
    const priceT = scene.add.text(btnX + btnW / 2 + 6, btnY + btnH / 2, priceLabel, {
      ...FONT, fontSize: '16px',
      color: canBuy ? '#f5a623' : '#4a4a4a',
      stroke: canBuy ? '#000000' : 'none', strokeThickness: canBuy ? 2 : 0,
    }).setOrigin(0.5);
    container.add(priceT);

    if (canBuy) {
      const zone = scene.add.rectangle(btnX + btnW / 2, btnY + btnH / 2, btnW, btnH, 0, 0.001)
        .setInteractive({ useHandCursor: true }).setDepth(8);
      zone.on('pointerover', () => {
        btnG.clear();
        btnG.fillStyle(0x081828, 0.98);
        btnG.fillRoundedRect(btnX, btnY, btnW, btnH, { tl:0, tr:0, bl:R-2, br:R-2 });
        btnG.lineStyle(2, upgrade.color, 0.9);
        btnG.strokeRoundedRect(btnX, btnY, btnW, btnH, { tl:0, tr:0, bl:R-2, br:R-2 });
        priceT.setColor('#ffffff');
      });
      zone.on('pointerout', () => {
        btnG.clear();
        btnG.fillStyle(0x040c18, 0.98);
        btnG.fillRoundedRect(btnX, btnY, btnW, btnH, { tl:0, tr:0, bl:R-2, br:R-2 });
        btnG.lineStyle(1.5, upgrade.color, 0.7);
        btnG.strokeRoundedRect(btnX, btnY, btnW, btnH, { tl:0, tr:0, bl:R-2, br:R-2 });
        priceT.setColor('#f5a623');
      });
      zone.on('pointerup', () => onBuy(upgrade));
      container.add(zone);
    }
  }
}

// ─────────────────────────────────────────────────────────────
//  OVERLAY PRINCIPAL
// ─────────────────────────────────────────────────────────────
export function openSupplyOverlay(scene) {
  if (scene.crosshair) scene.crosshair.setVisible(false);
  scene.input.setDefaultCursor('default');
  if (scene.game?.canvas) scene.game.canvas.style.cursor = 'default';

  // Charger les images manquantes PUIS construire l'overlay
  const toLoad = UPGRADES.filter(u => u.imageKey && !scene.textures.exists(u.imageKey));

  if (toLoad.length > 0) {
    toLoad.forEach(u => {
      scene.load.image(u.imageKey, `assets/upgrades/${u.imageKey}.webp`);
    });
    // Attendre la fin du chargement avant de construire
    scene.load.once('complete', () => _openOverlay(scene));
    scene.load.start();
  } else {
    // Tout est déjà en cache, construire directement
    _openOverlay(scene);
  }
}

function _openOverlay(scene) {
  if (!scene.runStacks) scene.runStacks = {};
  UPGRADES.forEach(u => { if (!scene.runStacks[u.id]) scene.runStacks[u.id] = 0; });

  const nextLevel = scene.currentLevel + 1;

  // Fond Phaser semi-transparent
  const bgRect = scene.add.rectangle(
    scene.scale.width / 2, scene.scale.height / 2,
    scene.scale.width, scene.scale.height,
    0x000000, 0.78
  ).setDepth(1490);

  // DOM overlay
  let domEl = null;

  function buildOverlay() {
    domEl?.destroy();

    const html = _buildSupplyHTML(scene);
    domEl = scene.add.dom(scene.scale.width / 2, scene.scale.height / 2)
      .createFromHTML(html)
      .setDepth(1500);

    // Anim entrée
    const node = domEl.node.querySelector('#supply-root');
    if (node) {
      node.style.opacity = '0';
      node.style.transform = 'translateY(14px)';
      node.style.transition = 'opacity 0.24s ease, transform 0.24s ease';
      requestAnimationFrame(() => {
        node.style.opacity = '1';
        node.style.transform = 'translateY(0)';
      });
    }

    // Events
    _bindSupplyEvents(domEl, scene, nextLevel,
      () => { bgRect.destroy(); buildOverlay(); },  // refresh après achat
      () => { bgRect.destroy(); domEl?.destroy(); goNext(); },
      () => { bgRect.destroy(); domEl?.destroy(); goMenu(); }
    );
  }

  function goNext() {
    if (scene.crosshair) scene.crosshair.setVisible(true);
    scene.input.setDefaultCursor('none');
    if (scene.game?.canvas) scene.game.canvas.style.cursor = 'none';
    scene.registry.set('currentLevel', nextLevel);
    scene.scene.restart({
      upgrades:    scene.runUpgrades,
      runStacks:   scene.runStacks,
      weaponState: scene.weaponState,
      moduleState: scene.moduleState,
    });
  }

  function goMenu() {
    scene.scene.start('MenuScene');
  }

  buildOverlay();
}

// ── HTML du ravitaillement ────────────────────────────────────
function _buildSupplyHTML(scene) {
  const coins  = scene.coins ?? 0;
  const level  = scene.currentLevel ?? 1;

  const cardsHTML = UPGRADES.map(u => {
    const stacks  = scene.runStacks[u.id] ?? 0;
    const price   = getPrice(u, stacks);
    const maxed   = stacks >= u.maxStacks;
    const canBuy  = !maxed && coins >= price;
    const colorHex = '#' + u.color.toString(16).padStart(6, '0');

    // Dots stacks
    let dotsHTML = '';
    if (u.maxStacks !== Infinity) {
      dotsHTML = '<div class="s-dots">' +
        Array.from({length: u.maxStacks}, (_, i) =>
          `<span class="s-dot${i < stacks ? ' active' : ''}" style="--c:${colorHex}"></span>`
        ).join('') + '</div>';
    } else if (stacks > 0) {
      dotsHTML = `<div class="s-dots"><span style="color:${colorHex};font-size:11px;font-weight:700;">×${stacks} acheté</span></div>`;
    } else {
      dotsHTML = '<div class="s-dots"></div>';
    }

    // Bouton
    let btnHTML = '';
    if (maxed) {
      btnHTML = `<button class="s-btn s-btn-maxed" style="--c:${colorHex}" disabled>✓ MAX</button>`;
    } else if (canBuy) {
      btnHTML = `<button class="s-btn s-btn-buy" data-id="${u.id}" style="--c:${colorHex}">
        <span class="s-coin"></span>${price}
      </button>`;
    } else {
      btnHTML = `<button class="s-btn s-btn-locked" disabled>
        <span class="s-coin s-coin-off"></span>${price}
      </button>`;
    }

    const imgHTML = u.imageKey
      ? `<img class="s-card-img" src="assets/upgrades/${u.imageKey}.webp" alt="${u.name}">`
      : `<div class="s-card-img s-icon-fallback" style="--c:${colorHex}"></div>`;

    return `
    <article class="s-card${maxed ? ' maxed' : ''}" style="--c:${colorHex}">
      <div class="s-card-top">${imgHTML}</div>
      <div class="s-card-body">
        <h3 class="s-card-name">${u.name}</h3>
        <p class="s-card-desc">${u.desc.replace('\n','<br>')}</p>
        ${dotsHTML}
        ${btnHTML}
      </div>
    </article>`;
  }).join('');

  return `
<style>
  :root {
    --line: rgba(94,195,255,0.22);
    --panel: rgba(6,16,34,0.92);
    --gold: #f5a623;
    --cyan: #6de3ff;
    --text: #eef8ff;
    --muted: #8aa9c8;
    --radius: 14px;
  }
  * { box-sizing:border-box; margin:0; padding:0; }

  #supply-root {
    font-family: Inter, Arial, sans-serif;
    width: 100vw; height: 100vh;
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }

  .s-shell {
    width: min(980px, calc(100vw - 40px));
    pointer-events: all;
    position: relative;
  }

  /* Panneau */
  .s-panel {
    background: linear-gradient(180deg, rgba(7,18,38,0.94), rgba(4,10,22,0.97));
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 28px 32px 24px;
    position: relative;
    overflow: visible;
    box-shadow: 0 0 0 1px rgba(130,220,255,0.06), 0 0 40px rgba(0,140,255,0.1);
  }

  /* Coins image */
  .f-corner { position:absolute; pointer-events:none; z-index:4; background-size:contain; background-repeat:no-repeat; }
  .f-tl { top:-6px; left:-6px; width:150px; height:100px; background-image:url('assets/ui/ui-corner-tl.webp'); background-position:top left; }
  .f-tr { top:-6px; right:-6px; width:150px; height:98px; background-image:url('assets/ui/ui-corner-tr.webp'); background-position:top right; }
  .f-bl { bottom:-6px; left:-6px; width:80px; height:100px; background-image:url('assets/ui/ui-corner-bl.webp'); background-position:bottom left; }
  .f-br { bottom:-6px; right:-6px; width:80px; height:100px; background-image:url('assets/ui/ui-corner-br.webp'); background-position:bottom right; }
  .f-bt { position:absolute; top:-12px; left:130px; right:130px; height:30px; pointer-events:none; z-index:3; background-image:url('assets/ui/ui-border-top.webp'); background-size:100% 100%; background-repeat:no-repeat; }
  .f-bb { position:absolute; bottom:-12px; left:70px; right:70px; height:30px; pointer-events:none; z-index:3; background-image:url('assets/ui/ui-border-bottom.webp'); background-size:100% 100%; background-repeat:no-repeat; }

  /* Header */
  .s-header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 18px; padding-bottom: 16px;
    border-bottom: 1px solid rgba(94,195,255,0.14);
  }
  .s-title {
    display: flex; align-items: center; gap: 10px;
    color: var(--cyan); font-size: 1.1rem; font-weight: 900;
    letter-spacing: .12em; text-transform: uppercase;
  }
  .s-title-icon { font-size: 1.1rem; }
  .s-subtitle { color: var(--muted); font-size: .82rem; margin-top: 2px; letter-spacing:.04em; }

  .s-coins {
    display: flex; align-items: center; gap: 8px;
    background: linear-gradient(180deg, rgba(10,24,51,.9), rgba(6,13,28,.95));
    border: 1px solid rgba(110,210,255,0.2); border-radius: 12px;
    padding: 8px 16px; color: #ffd089; font-weight: 900; font-size: .95rem;
  }
  .s-coin-dot {
    width: 16px; height: 16px; border-radius: 50%;
    background: linear-gradient(180deg, #ffd26a, #ff9800);
    box-shadow: 0 0 10px rgba(255,153,0,.4); flex:0 0 auto;
  }

  /* Grille cartes */
  .s-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 12px;
    margin-bottom: 16px;
  }

  /* Carte */
  .s-card {
    background: linear-gradient(180deg, rgba(6,14,30,.96), rgba(4,10,22,.99));
    border: 1px solid rgba(94,195,255,0.14);
    border-radius: 12px;
    overflow: hidden;
    display: flex; flex-direction: column;
    transition: border-color .18s ease, transform .18s ease;
    clip-path: polygon(0 6%, 6% 0, 100% 0, 100% 94%, 94% 100%, 0 100%);
    position: relative;
  }
  .s-card::after {
    content:""; position:absolute; left:12px; right:12px; bottom:3px;
    height:2px; border-radius:999px;
    background: linear-gradient(90deg, transparent, var(--c), transparent);
    opacity: .6; pointer-events:none;
  }
  .s-card:hover { border-color: rgba(109,227,255,0.3); transform: translateY(-3px); }
  .s-card.maxed { border-color: rgba(var(--c), 0.5); }

  .s-card-top {
    aspect-ratio: 1; overflow: hidden;
    border-bottom: 1px solid rgba(94,195,255,0.1);
  }
  .s-card-img { width:100%; height:100%; object-fit:cover; display:block; }

  .s-card-body { padding: 10px 10px 12px; display:flex; flex-direction:column; gap:6px; flex:1; }
  .s-card-name { font-size: .88rem; font-weight:900; letter-spacing:.08em; text-transform:uppercase; color: var(--text); }
  .s-card-desc { font-size: .76rem; color: var(--muted); line-height: 1.5; flex:1; }

  /* Dots */
  .s-dots { display:flex; gap:5px; align-items:center; min-height:14px; }
  .s-dot { width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.15); }
  .s-dot.active { background: var(--c); border-color: var(--c); box-shadow: 0 0 6px var(--c); }

  /* Boutons carte */
  .s-btn {
    width:100%; padding: 9px 0; border-radius:0 0 10px 10px;
    border: none; font-family:inherit; font-weight:900; font-size:.8rem;
    letter-spacing:.08em; text-transform:uppercase; cursor:pointer;
    display:flex; align-items:center; justify-content:center; gap:7px;
    margin: 0 -0px -0px; transition: opacity .15s;
  }
  .s-btn-buy {
    background: linear-gradient(180deg, rgba(var(--c-rgb),0.12), rgba(0,0,0,0.3));
    color: var(--gold);
    border-top: 1px solid rgba(94,195,255,0.12);
  }
  .s-btn-buy:hover { opacity:.85; }
  .s-btn-maxed { background:rgba(255,255,255,0.03); color:var(--c); border-top:1px solid rgba(255,255,255,0.06); cursor:default; }
  .s-btn-locked { background:rgba(255,255,255,0.02); color:rgba(255,255,255,0.2); border-top:1px solid rgba(255,255,255,0.04); cursor:default; }
  .s-coin { width:13px; height:13px; border-radius:50%; background:linear-gradient(180deg,#ffd26a,#ff9800); flex:0 0 auto; }
  .s-coin-off { background:rgba(255,255,255,0.15); }

  /* Footer */
  .s-footer { display:flex; align-items:center; justify-content:space-between; margin-top:4px; }
  .s-info { color:rgba(94,195,255,0.4); font-size:.76rem; letter-spacing:.06em; }

  /* Boutons nav */
  .s-nav { display:flex; gap:12px; }
  .s-nav-btn {
    padding: 13px 28px; border-radius: 11px;
    font-family:inherit; font-weight:900; font-size:.88rem;
    letter-spacing:.1em; text-transform:uppercase; cursor:pointer;
    border: 1px solid rgba(104,211,255,.22);
    background: linear-gradient(180deg, rgba(9,21,44,.96), rgba(6,13,28,.98));
    color: white; position:relative; overflow:hidden;
    transition: transform .18s ease, border-color .18s ease;
  }
  .s-nav-btn::after {
    content:""; position:absolute; left:14px; right:14px; bottom:6px;
    height:1.5px; border-radius:999px;
    background: linear-gradient(90deg, transparent, rgba(101,228,255,.85), transparent);
  }
  .s-nav-btn:hover { transform:translateY(-2px); border-color:rgba(104,211,255,.4); }
  .s-nav-continue {
    border-color: rgba(255,140,0,.75);
    background: linear-gradient(180deg, rgba(60,22,0,.85), rgba(18,8,2,.92));
    color: #ffe8b0;
    animation: pulse-glow-supply 2.4s ease-in-out infinite;
  }
  .s-nav-continue::after {
    background: linear-gradient(90deg, transparent, rgba(255,176,74,.9), transparent);
  }
  @keyframes pulse-glow-supply {
    0%,100% { box-shadow: 0 0 10px 2px rgba(255,110,0,.5), 0 0 35px 5px rgba(255,80,0,.22); }
    50%      { box-shadow: 0 0 16px 3px rgba(255,130,0,.7), 0 0 52px 8px rgba(255,90,0,.35); }
  }
</style>

<div id="supply-root">
  <div class="s-shell">
    <div class="s-panel">
      <!-- Frame coins -->
      <div class="f-corner f-tl"></div>
      <div class="f-corner f-tr"></div>
      <div class="f-corner f-bl"></div>
      <div class="f-corner f-br"></div>
      <div class="f-corner f-bt"></div>
      <div class="f-corner f-bb"></div>

      <!-- Header -->
      <div class="s-header">
        <div>
          <div class="s-title"><span class="s-title-icon">⚡</span> Ravitaillement</div>
          <div class="s-subtitle">Niveau ${level} terminé — choisissez vos upgrades</div>
        </div>
        <div class="s-coins">
          <div class="s-coin-dot"></div>
          <span>${coins}</span>
        </div>
      </div>

      <!-- Cartes upgrades -->
      <div class="s-grid">${cardsHTML}</div>

      <!-- Footer -->
      <div class="s-footer">
        <span class="s-info">★ Les upgrades durent jusqu'à la fin de la run</span>
        <div class="s-nav">
          <button class="s-nav-btn" id="s-btn-menu">Menu</button>
          <button class="s-nav-btn s-nav-continue" id="s-btn-continue">▶ Continuer</button>
        </div>
      </div>

    </div>
  </div>
</div>`;
}

// ── Binding events DOM ────────────────────────────────────────
function _bindSupplyEvents(domEl, scene, nextLevel, onRefresh, onContinue, onMenu) {
  const el = domEl.node;

  // Achats
  el.querySelectorAll('.s-btn-buy').forEach(btn => {
    btn.addEventListener('click', () => {
      const id     = btn.dataset.id;
      const upg    = UPGRADES.find(u => u.id === id);
      if (!upg) return;
      const stacks = scene.runStacks[id] ?? 0;
      const price  = getPrice(upg, stacks);
      if ((scene.coins ?? 0) < price) return;
      scene.coins -= price;
      scene.runStacks[id] = stacks + 1;
      upg.apply(scene, scene.runStacks[id]);
      playSfx(scene, 'coin');
      onRefresh();
    });
  });

  el.querySelector('#s-btn-continue')?.addEventListener('click', onContinue);
  el.querySelector('#s-btn-menu')?.addEventListener('click', onMenu);
}

// ─────────────────────────────────────────────────────────────
//  Bouton navigation
// ─────────────────────────────────────────────────────────────
function _makeNavBtn(scene, x, y, w, label, color, onClick) {
  const h    = 44;
  const cont = scene.add.container(x, y);
  cont.setSize(w, h);
  cont.setInteractive(new Phaser.Geom.Rectangle(-w/2,-h/2,w,h), Phaser.Geom.Rectangle.Contains);

  const g = scene.add.graphics();
  g.fillStyle(0x060e1c, 0.97); g.fillRoundedRect(-w/2,-h/2,w,h,7);
  g.lineStyle(1.5, color, 0.6); g.strokeRoundedRect(-w/2,-h/2,w,h,7);
  g.fillStyle(P.cyanS, 0.4); g.fillRect(-w/2+14, h/2-5, w-28, 2);

  const txt = scene.add.text(0, 0, label, { ...FONT, fontSize: '15px', color: '#f0f8ff' }).setOrigin(0.5);
  cont.add([g, txt]);

  cont.on('pointerover',  () => scene.tweens.add({ targets: cont, scaleX: 1.04, scaleY: 1.04, duration: 80 }));
  cont.on('pointerout',   () => scene.tweens.add({ targets: cont, scaleX: 1,    scaleY: 1,    duration: 80 }));
  cont.on('pointerdown',  () => scene.tweens.add({ targets: cont, scaleX: 0.96, scaleY: 0.96, duration: 55 }));
  cont.on('pointerup',    () => scene.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 55,
    onComplete: onClick }));
  return cont;
}
