// ============================================================
//  ShopSystem.js — Boutique inter-niveaux v3
//  Deux onglets :
//    · ARSENAL  — armes temporaires (run actuelle)
//    · MODULES  — modules permanents (persistent entre runs)
//
//  Exports publics inchangés :
//    · buildShopOverlayV2(scene, shopData)
//    · openShopOverlay(scene)
// ============================================================

import { loadProgress, saveProgress, purchaseModule, equipModule, unequipModule } from './storage.js';
import { MODULE_CATALOG, createDefaultModuleState, sanitizeModuleState } from './ModuleSystem.js';

// ─────────────────────────────────────────────────────────────
//  PALETTE & FONTS
// ─────────────────────────────────────────────────────────────
const P = {
  panelBg:  0x080f1c,
  border:   0x1a3652,
  cyan:     0x00c8ff,
  cyanSoft: 0x38bdf8,
  cyanDim:  0x003d52,
  gold:     0xf5a623,
  gray:     0x3a4a5c,
  green:    0x22c55e,
};
const FONT_BOLD = { fontFamily: '"Courier New", Courier, monospace', fontStyle: 'bold' };
const FONT_BODY = { fontFamily: '"Courier New", Courier, monospace' };

// ─────────────────────────────────────────────────────────────
//  HELPERS GRAPHIQUES (réutilisés dans les deux onglets)
// ─────────────────────────────────────────────────────────────

function drawPanel(g, x, y, w, h, opts = {}) {
  const {
    r = 12, fillColor = P.panelBg, fillAlpha = 0.96,
    borderColor = P.border, borderAlpha = 0.7,
    accentColor = P.cyanSoft, accentAlpha = 0.85,
    glowColor = P.cyanSoft, glowAlpha = 0.05,
  } = opts;
  g.clear();
  if (glowAlpha > 0) { g.fillStyle(glowColor, glowAlpha); g.fillRoundedRect(x-3, y-3, w+6, h+6, r+2); }
  g.fillStyle(fillColor, fillAlpha);  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(1.5, borderColor, borderAlpha); g.strokeRoundedRect(x, y, w, h, r);
  g.lineStyle(1, P.cyan, 0.1);               g.strokeRoundedRect(x+1, y+1, w-2, h-2, r-1);
  g.fillStyle(accentColor, accentAlpha);      g.fillRoundedRect(x+20, y+h-4, w-40, 2, 1);
}

function drawBtn(g, w, h, color, hovered, disabled) {
  const r = 7;
  g.clear();
  g.fillStyle(0x070e1c, 0.97);  g.fillRoundedRect(-w/2, -h/2, w, h, r);
  g.lineStyle(1.5, disabled ? P.gray : color, disabled ? 0.2 : (hovered ? 0.85 : 0.6));
  g.strokeRoundedRect(-w/2, -h/2, w, h, r);
  g.fillStyle(0xffffff, disabled ? 0.01 : (hovered ? 0.055 : 0.03));
  g.fillRoundedRect(-w/2+2, -h/2+2, w-4, h*0.35, r-2);
  g.fillStyle(disabled ? P.gray : P.cyanSoft, disabled ? 0.2 : 0.6);
  g.fillRect(-w/2+16, h/2-6, w-32, 2);
}

function createBtn(scene, x, y, w, h, label, color, onClick) {
  const disabled = !onClick || label === 'PAS ASSEZ';
  const cont = scene.add.container(x, y);
  cont.setSize(w, h);
  if (!disabled) cont.setInteractive(new Phaser.Geom.Rectangle(-w/2,-h/2,w,h), Phaser.Geom.Rectangle.Contains);
  const g = scene.add.graphics();
  drawBtn(g, w, h, disabled ? P.gray : color, false, disabled);
  const txt = scene.add.text(0, 0, label, { ...FONT_BOLD, fontSize: '14px', color: disabled ? '#2a3a4c' : '#f0f8ff' }).setOrigin(0.5);
  cont.add([g, txt]);
  cont.setAlpha(disabled ? 0.55 : 1);
  cont._g = g; cont._txt = txt; cont._color = color; cont._disabled = disabled; cont._w = w; cont._h = h;
  if (!disabled) {
    cont.on('pointerover',  () => { scene.tweens.add({ targets: cont, scaleX: 1.03, scaleY: 1.03, duration: 80 }); drawBtn(g, w, h, color, true,  false); });
    cont.on('pointerout',   () => { scene.tweens.add({ targets: cont, scaleX: 1,    scaleY: 1,    duration: 80 }); drawBtn(g, w, h, color, false, false); });
    cont.on('pointerdown',  () => { scene.tweens.add({ targets: cont, scaleX: 0.97, scaleY: 0.97, duration: 55 }); scene.sound?.play?.('button', { volume: 0.3 }); });
    cont.on('pointerup',    () => { scene.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 55, onComplete: () => onClick?.() }); });
  }
  return cont;
}

function createCoinBadge(scene, x, y, coins) {
  const cont = scene.add.container(x, y);
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a1525, 0.98); bg.fillRoundedRect(0, 0, 148, 38, 19);
  bg.lineStyle(1.5, P.gold, 0.75); bg.strokeRoundedRect(0, 0, 148, 38, 19);
  const coin = scene.add.graphics();
  coin.fillStyle(P.gold, 1);     coin.fillCircle(24, 19, 11);
  coin.fillStyle(0xf8d060, 1);   coin.fillCircle(24, 19, 8);
  coin.fillStyle(0xffffff, 0.4); coin.fillEllipse(21, 15, 5, 3);
  const val = scene.add.text(44, 19, String(coins), { ...FONT_BOLD, fontSize: '20px', color: '#f5a623' }).setOrigin(0, 0.5);
  cont.add([bg, coin, val]);
  cont._valueText = val;
  return cont;
}

// ─────────────────────────────────────────────────────────────
//  ONGLETS
// ─────────────────────────────────────────────────────────────
function createTabBar(scene, x, y, w, activeTab, onSwitch) {
  const cont = scene.add.container(x, y);
  const tabs  = ['ARSENAL', 'MODULES'];
  const tabW  = (w - 8) / 2;

  tabs.forEach((label, i) => {
    const tx     = 4 + i * (tabW + 2);
    const active = (label === activeTab);
    const bg = scene.add.graphics();
    bg.fillStyle(active ? 0x0d2240 : 0x060d18, active ? 0.95 : 0.6);
    bg.fillRoundedRect(tx, 0, tabW, 36, 6);
    bg.lineStyle(1.5, active ? P.cyan : P.border, active ? 0.8 : 0.3);
    bg.strokeRoundedRect(tx, 0, tabW, 36, 6);
    if (active) {
      bg.fillStyle(P.cyan, 0.8);
      bg.fillRoundedRect(tx + 16, 32, tabW - 32, 2, 1);
    }
    const txt = scene.add.text(tx + tabW/2, 18, label, {
      ...FONT_BOLD, fontSize: '13px',
      color: active ? '#00c8ff' : '#3a5a72',
    }).setOrigin(0.5);

    if (!active) {
      const zone = scene.add.rectangle(tx + tabW/2, 18, tabW, 36, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => txt.setColor('#7dd3fc'));
      zone.on('pointerout',  () => txt.setColor('#3a5a72'));
      zone.on('pointerup',   () => onSwitch(label));
      cont.add(zone);
    }
    cont.add([bg, txt]);
  });
  return cont;
}

// ─────────────────────────────────────────────────────────────
//  CARTE D'ITEM (Arsenal)
// ─────────────────────────────────────────────────────────────
function createArsenalCard(scene, x, y, w, h, item) {
  const cont = scene.add.container(x, y);
  const hoverHalo = scene.add.graphics();
  hoverHalo.fillStyle(P.cyanSoft, 0.12);
  hoverHalo.fillRoundedRect(-5, -5, w+10, h+10, 11);
  hoverHalo.setAlpha(0);

  const bg = scene.add.graphics();
  bg.fillStyle(0x050c18, 0.97); bg.fillRoundedRect(0, 0, w, h, 8);
  bg.lineStyle(1, 0x1e3a52, 0.55); bg.strokeRoundedRect(0, 0, w, h, 8);
  bg.fillStyle(P.cyanSoft, 0.85); bg.fillRoundedRect(14, h-6, w-28, 3, 2);
  bg.lineStyle(1, P.cyanSoft, 0.2); bg.lineBetween(12, 37, w-12, 37);
  bg.lineStyle(1, P.border, 0.4);   bg.lineBetween(12, h-72, w-12, h-72);

  const title = scene.add.text(14, 13, item.title, { ...FONT_BOLD, fontSize: '15px', color: '#e0f0ff' });
  const imgCx = w/2, imgCy = 108;
  const glow1 = scene.add.circle(imgCx, imgCy, 50, P.cyanSoft, 0.07);
  const glow2 = scene.add.circle(imgCx, imgCy, 32, P.cyan, 0.045);

  let visual = null;
  if (item.imageKey && scene.textures.exists(item.imageKey)) {
    visual = scene.add.image(imgCx, imgCy, item.imageKey).setDisplaySize(90, 90).setAlpha(0.95);
  } else if (typeof item.drawFallback === 'function') {
    visual = item.drawFallback(scene, imgCx, imgCy);
  }

  const desc = scene.add.text(14, 178, item.description || '', { ...FONT_BODY, fontSize: '12px', color: '#6a9ab8', lineSpacing: 5, wordWrap: { width: w-28 } });
  const stateLbl = scene.add.text(14, h-68, item.stateLabel || '', { ...FONT_BOLD, fontSize: '12px', color: item.stateColor || '#ff5555' });

  const coinIcon = scene.add.graphics();
  coinIcon.fillStyle(P.gold, 1);    coinIcon.fillCircle(20, h-40, 9);
  coinIcon.fillStyle(0xf8d060, 1);  coinIcon.fillCircle(20, h-40, 6);
  coinIcon.fillStyle(0xffffff, 0.35); coinIcon.fillEllipse(18, h-43, 4, 3);
  const priceText = scene.add.text(34, h-50, String(item.price ?? 0), { ...FONT_BOLD, fontSize: '19px', color: '#f5a623' });

  const hit = scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerover', () => { scene.tweens.killTweensOf(cont); scene.tweens.add({ targets: cont, scaleX: 1.025, scaleY: 1.025, duration: 110 }); scene.tweens.add({ targets: hoverHalo, alpha: 1, duration: 110 }); });
  hit.on('pointerout',  () => { scene.tweens.killTweensOf(cont); scene.tweens.add({ targets: cont, scaleX: 1, scaleY: 1, duration: 110 }); scene.tweens.add({ targets: hoverHalo, alpha: 0, duration: 110 }); });

  cont.add([hoverHalo, bg, title, glow1, glow2, ...(visual ? [visual] : []), desc, stateLbl, coinIcon, priceText, hit]);
  return cont;
}

// ─────────────────────────────────────────────────────────────
//  CARTE MODULE (onglet Modules)
// ─────────────────────────────────────────────────────────────
function createModuleCard(scene, x, y, w, h, modDef, owned, equippedInSlot, coins, onAction) {
  const cont      = scene.add.container(x, y);
  const canAfford = coins >= modDef.cost;
  const isFree    = modDef.cost === 0;

  // Fond
  const bg = scene.add.graphics();
  bg.fillStyle(0x050c18, 0.97); bg.fillRoundedRect(0, 0, w, h, 8);
  bg.lineStyle(1, owned ? 0x1a5a3a : 0x1e3a52, 0.6); bg.strokeRoundedRect(0, 0, w, h, 8);
  bg.fillStyle(owned ? P.green : P.cyanSoft, 0.75); bg.fillRoundedRect(14, h-5, w-28, 2, 1);

  // Badge tier
  const tierColors = ['#3a6a88', '#f5a623', '#ef4444'];
  const tierLabels = ['', '★', '★★'];
  if (modDef.tier > 0) {
    scene.add.text(w-12, 10, tierLabels[modDef.tier], { ...FONT_BOLD, fontSize: '12px', color: tierColors[modDef.tier] }).setOrigin(1, 0);
  }

  // Icône colorée procédurale
  const iconG = scene.add.graphics();
  _drawModuleIcon(iconG, w/2, 56, modDef);

  // Nom
  scene.add.text(w/2, 96, modDef.name, { ...FONT_BOLD, fontSize: '13px', color: '#e0f0ff' }).setOrigin(0.5);

  // Description
  scene.add.text(w/2, 114, modDef.desc, { ...FONT_BODY, fontSize: '11px', color: '#5a8aaa', lineSpacing: 3, wordWrap: { width: w-16 }, align: 'center' }).setOrigin(0.5, 0);

  // Statut
  let statusLabel, statusColor;
  if (equippedInSlot !== null) {
    statusLabel = `SLOT ${equippedInSlot + 1}`; statusColor = '#00c8ff';
  } else if (owned) {
    statusLabel = 'POSSÉDÉ'; statusColor = '#22c55e';
  } else {
    statusLabel = canAfford || isFree ? 'DISPONIBLE' : 'INSUFFISANT';
    statusColor = canAfford || isFree ? '#f5a623' : '#ff5555';
  }
  scene.add.text(w/2, h-52, statusLabel, { ...FONT_BOLD, fontSize: '11px', color: statusColor }).setOrigin(0.5);

  // Prix
  if (!owned && !isFree) {
    const cg = scene.add.graphics();
    cg.fillStyle(P.gold, 1);    cg.fillCircle(w/2-22, h-28, 7);
    cg.fillStyle(0xf8d060, 1);  cg.fillCircle(w/2-22, h-28, 5);
    scene.add.text(w/2-12, h-35, String(modDef.cost), { ...FONT_BOLD, fontSize: '16px', color: canAfford ? '#f5a623' : '#ff5555' });
    cont.add(cg);
  }

  // Zone cliquable
  const hit = scene.add.rectangle(w/2, h/2, w, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerover',  () => scene.tweens.add({ targets: cont, scaleX: 1.03, scaleY: 1.03, duration: 100 }));
  hit.on('pointerout',   () => scene.tweens.add({ targets: cont, scaleX: 1,    scaleY: 1,    duration: 100 }));
  hit.on('pointerup',    () => onAction?.(modDef));

  cont.add([bg, iconG, hit]);
  return cont;
}

function _drawModuleIcon(g, cx, cy, modDef) {
  const c = modDef.color || 0x38bdf8;
  const r = 18;
  // Fond cercle
  g.fillStyle(c, 0.15); g.fillCircle(cx, cy, r+4);
  g.lineStyle(1.5, c, 0.6); g.strokeCircle(cx, cy, r);
  g.fillStyle(c, 0.8);

  // Icône selon le type
  switch(modDef.id) {
    case 'basic':
      g.fillRect(cx-1, cy-r+4, 3, r-4);
      g.fillTriangle(cx-5, cy-r+8, cx+5, cy-r+8, cx, cy-r+2);
      break;
    case 'spread':
      g.fillTriangle(cx, cy-14, cx-2, cy+8, cx+2, cy+8);
      g.fillTriangle(cx-8, cy-10, cx-14, cy+8, cx-4, cy+8);
      g.fillTriangle(cx+8, cy-10, cx+14, cy+8, cx+4, cy+8);
      break;
    case 'double':
      g.fillRect(cx-7, cy-12, 3, 20); g.fillRect(cx+4, cy-12, 3, 20);
      break;
    case 'laser':
      g.lineStyle(3, c, 1); g.lineBetween(cx, cy-14, cx, cy+14);
      g.lineStyle(1, 0xffffff, 0.8); g.lineBetween(cx, cy-14, cx, cy+14);
      g.fillStyle(0xffffff, 0.9); g.fillCircle(cx, cy, 4);
      break;
    case 'turret':
      g.fillRoundedRect(cx-8, cy-6, 16, 12, 3);
      g.fillStyle(0xffffff, 0.8); g.fillRect(cx-1, cy-14, 3, 10);
      g.fillCircle(cx, cy-2, 4);
      break;
    case 'rear_gun':
      g.fillRect(cx-1, cy+4, 3, 14); g.fillTriangle(cx-5, cy+8, cx+5, cy+8, cx, cy+16);
      g.fillStyle(0xffffff, 0.5); g.fillRect(cx-6, cy-6, 12, 4);
      break;
    case 'shield':
      g.lineStyle(2.5, c, 0.9); g.strokeCircle(cx, cy, 14);
      g.lineStyle(2, 0xffffff, 0.5); g.strokeArc = null;
      g.beginPath(); g.arc(cx, cy, 14, -Math.PI*0.7, Math.PI*0.7, false); g.strokePath();
      break;
    case 'regen':
      g.fillStyle(c, 0.9); g.fillRect(cx-1, cy-10, 3, 20);
      g.fillRect(cx-7, cy-3, 14, 3);
      g.fillStyle(0xffffff, 0.5); g.fillCircle(cx, cy-8, 3);
      break;
    case 'magnet':
      g.fillStyle(c, 0.9);
      g.fillRect(cx-10, cy-4, 8, 14); g.fillRect(cx+2, cy-4, 8, 14);
      g.lineStyle(3, c, 0.9); g.beginPath(); g.arc(cx, cy-4, 10, Math.PI, 0, false); g.strokePath();
      g.fillStyle(0xff0000, 0.9); g.fillRect(cx-10, cy-8, 8, 4);
      g.fillStyle(0x3377ff, 0.9); g.fillRect(cx+2,  cy-8, 8, 4);
      break;
    default:
      g.fillCircle(cx, cy, 10);
  }
}

// ─────────────────────────────────────────────────────────────
//  PRÉVISUALISATION VAISSEAU
// ─────────────────────────────────────────────────────────────
function createShipPreview(scene, x, y, slots) {
  const cont = scene.add.container(x, y);
  const weaponType = slots?.[0] || 'basic';

  const halo = scene.add.graphics();
  halo.fillStyle(P.cyanSoft, 0.08); halo.fillEllipse(0, 14, 190, 80);
  const ring = scene.add.graphics();
  ring.lineStyle(1.5, P.cyanSoft, 0.15); ring.strokeEllipse(0, 18, 214, 88);

  let ship = null;
  if (typeof scene.createPlayerVisual === 'function') {
    ship = scene.createPlayerVisual(0, 0);
    if (ship) { ship.setPosition(0, 0); ship.setScale(0.56); }
  }
  if (!ship) ship = _fallbackShip(scene);

  // Lignes d'arme
  const wl = scene.add.graphics();
  wl.lineStyle(3, 0x7dd3fc, 0.88);
  if (weaponType === 'spread') {
    wl.lineBetween(0,-20,-13,-44); wl.lineBetween(0,-20,0,-48); wl.lineBetween(0,-20,13,-44);
  } else if (weaponType === 'double') {
    wl.lineBetween(-7,-18,-7,-44); wl.lineBetween(7,-18,7,-44);
  } else if (weaponType === 'laser') {
    wl.lineStyle(4, 0x00ff88, 0.6); wl.lineBetween(0,-18,0,-60);
    wl.lineStyle(2, 0xffffff, 0.8); wl.lineBetween(0,-18,0,-60);
  } else {
    wl.lineBetween(0,-18,0,-46);
  }

  // Indicateurs modules latéraux
  const modG = scene.add.graphics();
  _drawSlotIndicators(modG, slots);

  cont.add([halo, ring, wl, modG, ship]);
  scene.tweens.add({ targets: cont, y: y-6, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  scene.tweens.add({ targets: ring, angle: 360, duration: 14000, repeat: -1, ease: 'Linear' });
  scene.tweens.add({ targets: halo, alpha: { from:0.7, to:1.5 }, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  return cont;
}

function _drawSlotIndicators(g, slots) {
  // Slot gauche (index 1) et droit (index 2)
  [{ idx: 1, sx: -32, sy: 8 }, { idx: 2, sx: 32, sy: 8 }].forEach(({ idx, sx, sy }) => {
    const id = slots?.[idx];
    const mod = id ? MODULE_CATALOG[id] : null;
    if (mod) {
      g.fillStyle(mod.color || P.cyanSoft, 0.7);
      g.fillRoundedRect(sx-10, sy-8, 20, 16, 4);
      g.lineStyle(1, mod.color || P.cyan, 0.9);
      g.strokeRoundedRect(sx-10, sy-8, 20, 16, 4);
    } else {
      g.fillStyle(P.border, 0.3);
      g.fillRoundedRect(sx-10, sy-8, 20, 16, 4);
      g.lineStyle(1, P.border, 0.4);
      g.strokeRoundedRect(sx-10, sy-8, 20, 16, 4);
      g.lineStyle(1, P.border, 0.4);
      g.lineBetween(sx-4, sy, sx+4, sy);
      g.lineBetween(sx, sy-4, sx, sy+4);
    }
  });
}

function _fallbackShip(scene) {
  const g = scene.add.container(0, 0);
  const hull = scene.add.graphics();
  hull.fillStyle(0xdbeafe, 0.94); hull.lineStyle(1.5, P.cyanSoft, 0.4);
  hull.beginPath(); hull.moveTo(0,-36); hull.lineTo(18,-2); hull.lineTo(12,26); hull.lineTo(0,20); hull.lineTo(-12,26); hull.lineTo(-18,-2); hull.closePath(); hull.fillPath(); hull.strokePath();
  const wings = scene.add.graphics();
  wings.fillStyle(0x708090, 0.82);
  wings.beginPath(); wings.moveTo(-44,4); wings.lineTo(-12,-6); wings.lineTo(-12,16); wings.lineTo(-36,28); wings.closePath(); wings.fillPath();
  wings.beginPath(); wings.moveTo(44,4); wings.lineTo(12,-6); wings.lineTo(12,16); wings.lineTo(36,28); wings.closePath(); wings.fillPath();
  const cpG = scene.add.circle(0,-9,14,P.cyanSoft,0.12);
  const cp  = scene.add.circle(0,-9, 7,0x67e8f9,  0.95);
  const eg1 = scene.add.circle(-11,26,11,P.cyanSoft,0.1);
  const eg2 = scene.add.circle( 11,26,11,P.cyanSoft,0.1);
  const e1  = scene.add.circle(-11,26, 5,0x67e8f9,  0.95);
  const e2  = scene.add.circle( 11,26, 5,0x67e8f9,  0.95);
  scene.tweens.add({ targets:[cpG,eg1,eg2], alpha:{from:0.07,to:0.2}, duration:900, yoyo:true, repeat:-1, ease:'Sine.InOut' });
  g.add([hull, wings, cpG, cp, eg1, eg2, e1, e2]);
  return g;
}

// ─────────────────────────────────────────────────────────────
//  PANNEAU SLOTS MODULES (panneau droit, onglet Modules)
// ─────────────────────────────────────────────────────────────
function buildSlotsPanel(scene, rx, ty, rightW, panH, slots, onSlotClick) {
  const elems = [];
  const slotDefs = [
    { idx: 0, label: 'ARME', y: 68, color: P.cyan },
    { idx: 1, label: 'MODULE GAUCHE', y: 200, color: P.gold },
    { idx: 2, label: 'MODULE DROIT',  y: 332, color: P.gold },
  ];

  slotDefs.forEach(({ idx, label, y, color }) => {
    const slotId = slots[idx];
    const mod    = slotId ? MODULE_CATALOG[slotId] : null;

    // Label slot
    elems.push(scene.add.text(rx + 24, ty + y, label, { ...FONT_BOLD, fontSize: '11px', color: '#3a6a88' }));

    // Boîte slot
    const sg = scene.add.graphics();
    sg.fillStyle(0x060d18, 0.9);
    sg.fillRoundedRect(rx + 24, ty + y + 16, rightW - 48, 72, 8);
    sg.lineStyle(1.5, mod ? (mod.color || color) : P.border, mod ? 0.7 : 0.3);
    sg.strokeRoundedRect(rx + 24, ty + y + 16, rightW - 48, 72, 8);
    if (mod) {
      sg.fillStyle(mod.color || color, 0.06);
      sg.fillRoundedRect(rx + 24, ty + y + 16, rightW - 48, 72, 8);
    }
    elems.push(sg);

    if (mod) {
      // Icône du module équipé
      const iconG = scene.add.graphics();
      _drawModuleIcon(iconG, rx + 60, ty + y + 52, mod);
      elems.push(iconG);
      // Nom
      elems.push(scene.add.text(rx + 86, ty + y + 30, mod.name, { ...FONT_BOLD, fontSize: '13px', color: '#e0f0ff' }));
      elems.push(scene.add.text(rx + 86, ty + y + 50, mod.desc.split('\n')[0], { ...FONT_BODY, fontSize: '11px', color: '#4a7a88', wordWrap: { width: rightW - 120 } }));
      // Bouton retirer
      const removeBtn = createBtn(scene, rx + rightW - 52, ty + y + 52, 56, 28, 'RETIRER', 0xff4444, () => onSlotClick(idx, null));
      elems.push(removeBtn);
    } else {
      elems.push(scene.add.text(rx + rightW/2, ty + y + 52, '— vide —', { ...FONT_BODY, fontSize: '12px', color: '#2a3a4c' }).setOrigin(0.5));
    }
  });

  return elems;
}

// ─────────────────────────────────────────────────────────────
//  buildShopOverlayV2 — layout principal
// ─────────────────────────────────────────────────────────────
export function buildShopOverlayV2(scene, shopData) {
  const SW = scene.scale.width, SH = scene.scale.height;
  const overlay = scene.add.container(0, 0).setDepth(1500);
  overlay.add(scene.add.rectangle(SW/2, SH/2, SW, SH, 0x000000, 0.72));

  const leftW = 710, rightW = 430, panH = 560, gap = 20;
  const lx    = Math.round((SW - leftW - gap - rightW) / 2);
  const ty    = Math.round((SH - panH) / 2) - 22;
  const rx    = lx + leftW + gap;

  // Panneaux
  const panLG = scene.add.graphics(); drawPanel(panLG, lx, ty, leftW, panH); overlay.add(panLG);
  const panRG = scene.add.graphics(); drawPanel(panRG, rx, ty, rightW, panH, { accentColor: P.gold, borderColor: 0x3a2800, borderAlpha: 0.5, glowColor: P.gold, glowAlpha: 0.03 }); overlay.add(panRG);

  // Titre panneau droit
  overlay.add(scene.add.text(rx + 24, ty + 18, 'VAISSEAU', { ...FONT_BOLD, fontSize: '22px', color: '#8fdfff' }));
  const rlG = scene.add.graphics(); rlG.lineStyle(1, P.gold, 0.28); rlG.lineBetween(rx+24, ty+52, rx+rightW-24, ty+52); overlay.add(rlG);

  // Badge pièces
  const coinBadge = createCoinBadge(scene, lx + 24, ty + 16, shopData.coins ?? 0);
  overlay.add(coinBadge);
  const coinVal = coinBadge._valueText;
  coinVal.setText(String(shopData.coins ?? 0));

  // Niveau
  overlay.add(scene.add.text(lx + 182, ty + 26, `Niveau ${shopData.level ?? 1} terminé`, { ...FONT_BODY, fontSize: '16px', color: '#5a8aaa' }));

  // ── Onglets ───────────────────────────────────────────────
  const tabBar = createTabBar(scene, lx + 8, ty + 62, leftW - 16, shopData.activeTab || 'ARSENAL', (tab) => {
    shopData.onTabSwitch?.(tab);
  });
  overlay.add(tabBar);

  // ── Contenu selon onglet ──────────────────────────────────
  const contentY = ty + 110;
  const arsenalElems = [];
  const modulesElems = [];

  if (shopData.activeTab === 'MODULES') {
    // ── Onglet MODULES ────────────────────────────────────
    // Groupes par type
    const groups = [
      { label: 'ARMES', ids: ['basic','spread','double','laser'], slotIdx: 0 },
      { label: 'MODULES SUPPORT', ids: ['turret','rear_gun','shield','regen','magnet'], slotIdx: null },
    ];

    let gY = contentY;
    groups.forEach(group => {
      overlay.add(scene.add.text(lx + 20, gY, group.label, { ...FONT_BOLD, fontSize: '11px', color: '#3a6a88' }));
      gY += 18;

      const cardW = 126, cardH = 170, gap2 = 8;
      group.ids.forEach((id, i) => {
        const mod     = MODULE_CATALOG[id];
        const owned   = shopData.ownedModules?.includes(id);
        const eqSlot  = shopData.equippedSlots?.indexOf(id) ?? -1;
        const eqIdx   = eqSlot >= 0 ? eqSlot : null;
        const cx2     = lx + 20 + i * (cardW + gap2);
        const card    = createModuleCard(scene, cx2, gY, cardW, cardH, mod, owned, eqIdx, shopData.coins ?? 0, (m) => shopData.onModuleAction?.(m, group.slotIdx));
        overlay.add(card);
        modulesElems.push(card);
      });
      gY += cardH + 14;
    });

  } else {
    // ── Onglet ARSENAL (par défaut) ───────────────────────
    const CW = 204, CH = 288, CGAP = 12, btnY = contentY + CH + 14;
    const cards = [], cardBtns = [];

    (shopData.cards || []).forEach((item, i) => {
      const cx2  = lx + 14 + i * (CW + CGAP);
      const card = createArsenalCard(scene, cx2, contentY, CW, CH, item);
      overlay.add(card); cards.push(card);

      const canAct = item.onClick && item.buttonLabel !== 'PAS ASSEZ';
      const btn    = createBtn(scene, cx2 + CW/2, btnY, CW-4, 42, item.buttonLabel || 'ACHETER', canAct ? (item.buttonColor || P.cyan) : P.gray, item.onClick);
      overlay.add(btn); cardBtns.push(btn);
      arsenalElems.push(card, btn);
    });

    // Sauvegarder refs pour refreshUI
    overlay._cards    = cards;
    overlay._cardBtns = cardBtns;
  }

  // ── Panneau droit : vaisseau + slots ─────────────────────
  // Prévisualisation vaisseau
  const shipPrev = createShipPreview(scene, rx + rightW - 130, ty + 160, shopData.equippedSlots || ['basic', null, null]);
  overlay.add(shipPrev);
  overlay._shipPrev = shipPrev;

  // Séparateur
  const sepG = scene.add.graphics(); sepG.lineStyle(1, P.border, 0.4); sepG.lineBetween(rx+18, ty+290, rx+rightW-18, ty+290); overlay.add(sepG);

  // Slots équipés
  const slotElems = buildSlotsPanel(scene, rx, ty, rightW, panH, shopData.equippedSlots || ['basic', null, null], (slotIdx, newId) => {
    shopData.onSlotChange?.(slotIdx, newId);
  });
  slotElems.forEach(e => overlay.add(e));

  // ── Boutons navigation ────────────────────────────────────
  const navY = ty + panH + 24;
  overlay.add(createBtn(scene, lx + 180, navY, 270, 50, 'CONTINUER',      P.cyanSoft, shopData.onContinue));
  overlay.add(createBtn(scene, lx + 476, navY, 270, 50, 'RETOUR AU MENU', P.gold,     shopData.onBackToMenu));

  // Anim entrée
  overlay.setAlpha(0).setY(14);
  scene.tweens.add({ targets: overlay, alpha: 1, y: 0, duration: 260, ease: 'Quad.Out' });

  return {
    overlay,
    coinVal,
    coinValueText: coinVal,
    cards:    overlay._cards    || [],
    cardBtns: overlay._cardBtns || [],
  };
}

// ─────────────────────────────────────────────────────────────
//  openShopOverlay — point d'entrée
// ─────────────────────────────────────────────────────────────
export function openShopOverlay(scene) {
  if (scene.crosshair) scene.crosshair.setVisible(false);
  scene.input.setDefaultCursor('default');
  if (scene.game?.canvas) scene.game.canvas.style.cursor = 'default';

  const nextLevel = scene.currentLevel + 1;

  // ── État armes (arsenal, run courante) ────────────────────
  if (!scene.weaponState) scene.weaponState = { equipped: 'basic', owned: ['basic'] };

  // ── État modules (permanent, depuis storage) ──────────────
  const progress   = loadProgress();
  scene.moduleState = sanitizeModuleState(progress.modules);

  let activeTab = 'ARSENAL';
  let selectedModuleId  = null;   // module sélectionné pour équipement
  let selectedSlotIndex = null;   // slot cible

  const isOwned = id => scene.weaponState?.owned?.includes(id);

  // ── Données cartes Arsenal ────────────────────────────────
  const ARSENAL_ITEMS = [
    { id: 'spread',    title: 'Canon Spread',    description: "Deux tirs en cône\nvers l'avant.", price: 6,  imageKey: 'weapon_spread', btnColor: 0x2563eb },
    { id: 'side-double', title: 'Canon Double',  description: 'Deux tirs parallèles\nplus rapides.', price: 8, imageKey: 'weapon_double', btnColor: 0x7c3aed },
    { id: 'fireRateUp',  title: 'Cadence +1',    description: '+10% cadence\nde tir', price: 5, imageKey: null, btnColor: 0xf59e0b,
      drawFallback: (scene, cx2, cy2) => {
        const g = scene.add.container(cx2, cy2);
        const arrow = scene.add.graphics();
        arrow.fillStyle(P.gold, 1); arrow.fillRect(-6,-3,12,26); arrow.fillTriangle(-16,-1,16,-1,0,-26);
        arrow.fillStyle(0xffffff, 0.2); arrow.fillRect(-4,-1,4,24);
        const lines = scene.add.graphics();
        lines.lineStyle(2, P.cyanSoft, 0.75);
        lines.lineBetween(-28,-12,-14,-12); lines.lineBetween(-32,-1,-18,-1); lines.lineBetween(-28,11,-14,11);
        lines.lineBetween(14,-12,28,-12);   lines.lineBetween(18,-1,32,-1);   lines.lineBetween(14,11,28,11);
        g.add([arrow, lines]); return g;
      },
    },
  ];

  let shopUI = null;

  const equippedLabel = () => {
    const s = scene.moduleState?.slots;
    if (!s) return 'Canon basique';
    const id = s[0];
    return MODULE_CATALOG[id]?.name || 'Canon basique';
  };
  const bonusLabel = () => `+${scene.runUpgrades.fireRate * 10}% cadence`;

  // ── Build cartes Arsenal ──────────────────────────────────
  function buildArsenalCards() {
    return ARSENAL_ITEMS.map(item => {
      const owned    = isOwned(item.id);
      const equipped = scene.weaponState?.equipped === item.id;
      const canBuy   = scene.coins >= item.price;
      let stateLabel, stateColor, buttonLabel, buttonColor, onClick;

      if (item.id === 'fireRateUp') {
        stateLabel = 'UPGRADE'; stateColor = '#00c8ff';
        buttonLabel = canBuy ? 'AMÉLIORER' : 'PAS ASSEZ';
        buttonColor = canBuy ? P.gold : P.gray;
        onClick = canBuy ? () => buyArsenal(item) : null;
      } else if (equipped) {
        stateLabel = 'ÉQUIPÉ'; stateColor = '#00c8ff';
        buttonLabel = 'ÉQUIPÉ ✓'; buttonColor = 0x3a4a5c; onClick = null;
      } else if (owned) {
        stateLabel = 'DÉBLOQUÉ'; stateColor = '#00c8ff';
        buttonLabel = 'ÉQUIPER'; buttonColor = item.btnColor;
        onClick = () => buyArsenal(item);
      } else {
        stateLabel = 'VERROUILLÉ'; stateColor = '#ff5555';
        buttonLabel = canBuy ? 'DÉBLOQUER' : 'PAS ASSEZ';
        buttonColor = canBuy ? P.cyanSoft : P.gray;
        onClick = canBuy ? () => buyArsenal(item) : null;
      }
      return { ...item, stateLabel, stateColor, buttonLabel, buttonColor, onClick };
    });
  }

  // ── Logique Arsenal ───────────────────────────────────────
  function buyArsenal(item) {
    if (item.id === 'fireRateUp') {
      if (scene.coins < item.price) return;
      scene.coins -= item.price;
      scene.runUpgrades.fireRate += 1;
      refresh(); return;
    }
    if (isOwned(item.id)) {
      scene.weaponState.equipped = item.id;
      refresh(); return;
    }
    if (scene.coins < item.price) return;
    scene.coins -= item.price;
    scene.weaponState.owned.push(item.id);
    scene.weaponState.equipped = item.id;
    refresh();
  }

  // ── Logique Modules ───────────────────────────────────────
  function handleModuleAction(mod, preferredSlot) {
    const progress   = loadProgress();
    const modState   = sanitizeModuleState(progress.modules);
    const owned      = modState.owned.includes(mod.id);
    const equippedAt = modState.slots.indexOf(mod.id);

    if (!owned) {
      // Acheter
      if (progress.coins < mod.cost) return;
      const ok = purchaseModule(mod.id, mod.cost);
      if (!ok) return;
      scene.moduleState = sanitizeModuleState(loadProgress().modules);
      // Équiper automatiquement dans le bon slot
      const slotIdx = preferredSlot !== null ? preferredSlot : (mod.slot === 'weapon' ? 0 : _firstEmptySupport(modState.slots));
      if (slotIdx !== null) {
        equipModule(mod.id, slotIdx);
        scene.moduleState = sanitizeModuleState(loadProgress().modules);
      }
    } else if (equippedAt >= 0) {
      // Déjà équipé → déséquiper
      unequipModule(equippedAt);
      scene.moduleState = sanitizeModuleState(loadProgress().modules);
    } else {
      // Possédé mais non équipé → équiper
      const slotIdx = preferredSlot !== null ? preferredSlot : (mod.slot === 'weapon' ? 0 : _firstEmptySupport(modState.slots));
      if (slotIdx !== null) {
        equipModule(mod.id, slotIdx);
        scene.moduleState = sanitizeModuleState(loadProgress().modules);
      }
    }
    refresh();
  }

  function _firstEmptySupport(slots) {
    if (!slots[1]) return 1;
    if (!slots[2]) return 2;
    return 1; // écrase le slot 1 si tout est plein
  }

  function handleSlotChange(slotIdx, newId) {
    unequipModule(slotIdx);
    scene.moduleState = sanitizeModuleState(loadProgress().modules);
    refresh();
  }

  // ── Refresh ───────────────────────────────────────────────
  function refresh() {
    shopUI?.overlay?.destroy();
    const prog = loadProgress();
    const ms   = sanitizeModuleState(prog.modules);

    shopUI = buildShopOverlayV2(scene, {
      coins:          scene.coins,
      level:          scene.currentLevel,
      activeTab,
      cards:          buildArsenalCards(),
      ownedModules:   ms.owned,
      equippedSlots:  ms.slots,
      onTabSwitch:    (tab) => { activeTab = tab; refresh(); },
      onModuleAction: handleModuleAction,
      onSlotChange:   handleSlotChange,
      onContinue: () => {
        if (scene.crosshair) scene.crosshair.setVisible(true);
        scene.input.setDefaultCursor('none');
        if (scene.game?.canvas) scene.game.canvas.style.cursor = 'none';
        scene.registry.set('currentLevel', nextLevel);
        // Synchroniser weaponState avec le slot arme des modules
        const latestMs = sanitizeModuleState(loadProgress().modules);
        const weaponSlot = latestMs.slots[0];
        if (weaponSlot && ['spread','double','side-double','laser'].includes(weaponSlot)) {
          scene.weaponState.equipped = weaponSlot === 'double' ? 'side-double' : weaponSlot;
        }
        scene.moduleState = latestMs;
        shopUI?.overlay?.destroy();
        scene.scene.restart({ upgrades: scene.runUpgrades, weaponState: scene.weaponState, moduleState: scene.moduleState });
      },
      onBackToMenu: () => {
        if (scene.crosshair) scene.crosshair.setVisible(true);
        scene.input.setDefaultCursor('default');
        if (scene.game?.canvas) scene.game.canvas.style.cursor = 'default';
        shopUI?.overlay?.destroy();
        scene.scene.start('MenuScene');
      },
    });
  }

  refresh();
  return shopUI?.overlay;
}
