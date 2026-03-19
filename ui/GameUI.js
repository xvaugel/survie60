// ============================================================
//  GameUI.js v3 — HUD style menu avec coins SVG sur les panneaux
// ============================================================

const FONT  = { fontFamily: 'Inter, Arial, sans-serif', fontStyle: 'bold' };
const FONTB = { fontFamily: 'Inter, Arial, sans-serif' };

const UI = {
  cyan:     0x6de3ff,
  cyanSoft: 0x38bdf8,
  gold:     0xf5a623,
  purple:   0xc4b5fd,
  green:    0x22c55e,
  red:      0xff4455,
  gray:     0xe2e8f0,
  border:   0x1a3652,
  panel:    0x07101c,
};

// ─────────────────────────────────────────────────────────────
//  Panneau glassmorphism Phaser
// ─────────────────────────────────────────────────────────────
function drawHudPanel(g, x, y, w, h, accentColor = 0x38bdf8) {
  g.clear();
  g.fillStyle(0x071222, 0.88);
  g.fillRoundedRect(x, y, w, h, 7);
  g.lineStyle(1, accentColor, 0.25);
  g.strokeRoundedRect(x, y, w, h, 7);
  g.fillStyle(0xffffff, 0.03);
  g.fillRoundedRect(x + 1, y + 1, w - 2, h * 0.35, 6);
  g.fillStyle(accentColor, 0.65);
  g.fillRoundedRect(x + 12, y + h - 3, w - 24, 2, 1);
}

// ─────────────────────────────────────────────────────────────
//  Frame PNG injectée dans le body sur chaque panneau HUD
// ─────────────────────────────────────────────────────────────
function makeFrameDiv(id, x, y, w, h, small = false) {
  document.getElementById(id)?.remove();

  const cW  = small ? 90  : 140;
  const cH  = small ? 58  : 92;
  const cbW = small ? 52  : 80;
  const cbH = small ? 62  : 96;
  const bH  = small ? 22  : 30;
  const bOL = small ? 44  : 110;
  const bOR = small ? 44  : 110;
  const bbOL= small ? 30  : 64;
  const bbOR= small ? 30  : 64;

  // Récupérer l'offset réel du canvas Phaser dans la page
  const canvas = document.querySelector('canvas');
  const rect   = canvas ? canvas.getBoundingClientRect() : { left:0, top:0, width: window.innerWidth, height: window.innerHeight };
  // Ratio scale (si le canvas est redimensionné)
  const scaleX = canvas ? rect.width  / (canvas.width  || rect.width)  : 1;
  const scaleY = canvas ? rect.height / (canvas.height || rect.height) : 1;

  const absX = rect.left + x * scaleX;
  const absY = rect.top  + y * scaleY;
  const absW = w * scaleX;
  const absH = h * scaleY;

  const d = document.createElement('div');
  d.id = id;
  d.style.cssText = `
    position:fixed; left:${absX}px; top:${absY}px;
    width:${absW}px; height:${absH}px;
    pointer-events:none; z-index:9999; overflow:visible;
  `;
  d.innerHTML = `
    <div style="position:absolute;top:-4px;left:-4px;width:${cW}px;height:${cH}px;
      background:url('assets/ui/ui-corner-tl.webp') top left/contain no-repeat;"></div>
    <div style="position:absolute;top:-4px;right:-4px;width:${cW}px;height:${cH}px;
      background:url('assets/ui/ui-corner-tr.webp') top right/contain no-repeat;"></div>
    <div style="position:absolute;bottom:-4px;left:-4px;width:${cbW}px;height:${cbH}px;
      background:url('assets/ui/ui-corner-bl.webp') bottom left/contain no-repeat;"></div>
    <div style="position:absolute;bottom:-4px;right:-4px;width:${cbW}px;height:${cbH}px;
      background:url('assets/ui/ui-corner-br.webp') bottom right/contain no-repeat;"></div>
    <div style="position:absolute;top:-${bH/2+2}px;left:${bOL}px;right:${bOR}px;height:${bH}px;
      background:url('assets/ui/ui-border-top-thin.webp') center/100% 100% no-repeat;"></div>
    <div style="position:absolute;bottom:-${bH/2+2}px;left:${bbOL}px;right:${bbOR}px;height:${bH}px;
      background:url('assets/ui/ui-border-bottom-thin.webp') center/100% 100% no-repeat;"></div>
  `;
  document.body.appendChild(d);
  return d;
}

// ─────────────────────────────────────────────────────────────
//  createGameHUD
// ─────────────────────────────────────────────────────────────
export function createGameHUD(scene) {
  const depth = 1000;
  const W     = scene.scale.width;
  const H     = scene.scale.height;
  const PAD   = 18;
  const BH    = 64;
  const GAP   = 5;

  // ── Largeurs ────────────────────────────────────────────
  const Ws = { hull: 240, coins: 118, level: 96, time: 124, kills: 96 };
  const totalW = Object.values(Ws).reduce((a,b) => a+b,0) + GAP*4;
  let cx = Math.round((W - totalW) / 2);

  // ── HULL ────────────────────────────────────────────────
  const hullX = cx;
  const hullG = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  drawHudPanel(hullG, hullX, PAD, Ws.hull, BH, UI.cyanSoft);

  scene.add.text(hullX + 12, PAD + 8, 'HULL', {
    ...FONTB, fontSize: '10px', color: '#5a9ab8',
  }).setDepth(depth).setScrollFactor(0);

  const maxLife = scene.maxPlayerLife || scene.playerMaxLife || 100;
  const hullVal = scene.add.text(hullX + Ws.hull - 12, PAD + 6, `${maxLife}/${maxLife}`, {
    ...FONT, fontSize: '12px', color: '#c0e8ff',
  }).setOrigin(1, 0).setDepth(depth).setScrollFactor(0);

  const barX = hullX + 12, barY = PAD + 34, barW = Ws.hull - 24, barH2 = 8;
  const barTrack = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  barTrack.fillStyle(0x000000, 0.5);
  barTrack.fillRoundedRect(barX, barY, barW, barH2, 4);
  barTrack.lineStyle(1, 0x1a3652, 0.5);
  barTrack.strokeRoundedRect(barX, barY, barW, barH2, 4);

  const barFill = scene.add.graphics().setDepth(depth+1).setScrollFactor(0);
  const lifeBar = { x: barX, y: barY, w: barW, h: barH2, fill: barFill, track: barTrack };
  _drawLifeBar(lifeBar, maxLife, maxLife);
  cx += Ws.hull + GAP;

  // ── Séparateurs Phaser ──────────────────────────────────
  function sep(x) {
    const g = scene.add.graphics().setDepth(depth).setScrollFactor(0);
    g.fillStyle(0x1a3652, 0.5);
    g.fillRect(x, PAD + 8, 1, BH - 16);
  }

  // ── COINS ───────────────────────────────────────────────
  sep(cx);
  const coinsG = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  drawHudPanel(coinsG, cx, PAD, Ws.coins, BH, UI.gold);
  scene.add.text(cx + 12, PAD + 8, 'COINS', { ...FONTB, fontSize: '10px', color: '#5a7a88' }).setDepth(depth).setScrollFactor(0);
  const coinDot = scene.add.graphics().setDepth(depth+1).setScrollFactor(0);
  coinDot.fillStyle(0xffd26a, 1); coinDot.fillCircle(cx + 16, PAD + 42, 5);
  coinDot.fillStyle(0xff9800, 1); coinDot.fillCircle(cx + 16, PAD + 42, 3.5);
  const coinsText = scene.add.text(cx + 26, PAD + 42, '0', { ...FONT, fontSize: '17px', color: '#f5a623' }).setOrigin(0, 0.5).setDepth(depth+1).setScrollFactor(0);
  cx += Ws.coins + GAP;

  // ── LEVEL ───────────────────────────────────────────────
  sep(cx);
  const levelG = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  drawHudPanel(levelG, cx, PAD, Ws.level, BH, UI.purple);
  scene.add.text(cx + 12, PAD + 8, 'LEVEL', { ...FONTB, fontSize: '10px', color: '#5a7a88' }).setDepth(depth).setScrollFactor(0);
  const levelText = scene.add.text(cx + Ws.level/2, PAD + 42, '1', { ...FONT, fontSize: '18px', color: '#c4b5fd' }).setOrigin(0.5).setDepth(depth+1).setScrollFactor(0);
  cx += Ws.level + GAP;

  // ── TIME ────────────────────────────────────────────────
  sep(cx);
  const timeG = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  drawHudPanel(timeG, cx, PAD, Ws.time, BH, UI.cyanSoft);
  scene.add.text(cx + 12, PAD + 8, 'TIME', { ...FONTB, fontSize: '10px', color: '#5a7a88' }).setDepth(depth).setScrollFactor(0);
  const timeText = scene.add.text(cx + Ws.time/2, PAD + 42, '00:00', { ...FONT, fontSize: '17px', color: '#7dd3fc' }).setOrigin(0.5).setDepth(depth+1).setScrollFactor(0);
  cx += Ws.time + GAP;

  // ── KILLS ───────────────────────────────────────────────
  sep(cx);
  const killsG = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  drawHudPanel(killsG, cx, PAD, Ws.kills, BH, 0x64748b);
  scene.add.text(cx + 12, PAD + 8, 'KILLS', { ...FONTB, fontSize: '10px', color: '#5a7a88' }).setDepth(depth).setScrollFactor(0);
  const killsText = scene.add.text(cx + Ws.kills/2, PAD + 42, '0', { ...FONT, fontSize: '18px', color: '#e2e8f0' }).setOrigin(0.5).setDepth(depth+1).setScrollFactor(0);

  // ── Frame SVG sur le panneau HUD ────────────────────────
  const hudPanelX = Math.round((W - totalW) / 2);
  const hudPanelY = PAD;
  const frameMain = makeFrameDiv('hud-frame-main', hudPanelX, hudPanelY, totalW, BH, false);
  scene.events.once('shutdown', () => frameMain?.remove());
  scene.events.once('destroy',  () => frameMain?.remove());

  // ── ARME BAS GAUCHE ─────────────────────────────────────
  const wPX = 14, wPY = H - 56, wPW = 148, wPH = 40;
  const weaponG = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  drawHudPanel(weaponG, wPX, wPY, wPW, wPH, UI.cyanSoft);
  scene.add.text(wPX + 10, wPY + 5, 'ARME', { ...FONTB, fontSize: '10px', color: '#5a9ab8' }).setDepth(depth).setScrollFactor(0);
  const weaponDot = scene.add.graphics().setDepth(depth+1).setScrollFactor(0);
  weaponDot.fillStyle(UI.cyanSoft, 0.9); weaponDot.fillCircle(wPX + 12, wPY + 28, 3.5);
  const weaponText = scene.add.text(wPX + 22, wPY + 28, 'Basique', { ...FONT, fontSize: '12px', color: '#c0e8ff' }).setOrigin(0, 0.5).setDepth(depth+1).setScrollFactor(0);

  const frameWeapon = makeFrameDiv('hud-frame-weapon', wPX, wPY, wPW, wPH, true);
  scene.events.once('shutdown', () => frameWeapon?.remove());
  scene.events.once('destroy',  () => frameWeapon?.remove());

  // ── SHIELD BAS DROITE ────────────────────────────────────
  // Espacé à droite, pas à côté de l'arme
  const sPW = 148, sPH = 40;
  const sPX = W - sPW - 14, sPY = H - 56;
  const shieldG = scene.add.graphics().setDepth(depth).setScrollFactor(0);
  drawHudPanel(shieldG, sPX, sPY, sPW, sPH, 0x06b6d4);
  scene.add.text(sPX + 10, sPY + 5, 'SHIELD', { ...FONTB, fontSize: '10px', color: '#5a9ab8' }).setDepth(depth).setScrollFactor(0);
  const shieldDot = scene.add.graphics().setDepth(depth+1).setScrollFactor(0);
  shieldDot.fillStyle(0x06b6d4, 0.9); shieldDot.fillCircle(sPX + 12, sPY + 28, 3.5);
  const shieldText = scene.add.text(sPX + 22, sPY + 28, 'Inactif', { ...FONT, fontSize: '11px', color: '#67e8f9' }).setOrigin(0, 0.5).setDepth(depth+1).setScrollFactor(0);

  const frameShield = makeFrameDiv('hud-frame-shield', sPX, sPY, sPW, sPH, true);
  scene.events.once('shutdown', () => frameShield?.remove());
  scene.events.once('destroy',  () => frameShield?.remove());

  return {
    lifeText: hullVal, coinsText, levelText, timeText, killsText,
    weaponText, weaponDot, shieldText, shieldDot,
    lifeBar, maxLife,
    _sPX: sPX, _sPY: sPY,
  };
}

// ─────────────────────────────────────────────────────────────
//  refreshGameHUD
// ─────────────────────────────────────────────────────────────
export function refreshGameHUD(scene) {
  const hud = scene.gameHUD;
  if (!hud) return;

  const maxLife = hud.maxLife || 100;
  const cur     = Math.max(0, Math.round(scene.playerLife ?? maxLife));

  hud.lifeText.setText(`${cur}/${maxLife}`);
  hud.coinsText.setText(String(scene.coins ?? 0));
  hud.levelText.setText(String(scene.currentLevel ?? 1));
  hud.killsText.setText(String(scene.score ?? 0));

  const rem = Math.max(0, Math.ceil((scene.levelDuration||0) - (scene.levelTimer||0)));
  hud.timeText.setText(`${String(Math.floor(rem/60)).padStart(2,'0')}:${String(rem%60).padStart(2,'0')}`);

  _drawLifeBar(hud.lifeBar, cur, maxLife);

  const names = { basic:'Basique', spread:'Spread', double:'Double', laser:'Laser', turret:'Tourelle' };
  const wId   = scene.moduleState?.slots?.[0] ?? 'basic';
  hud.weaponText.setText(names[wId] || wId);

  const hasShield   = scene.moduleState?.slots?.includes('shield');
  const shieldActive= scene.shieldActive ?? false;
  hud.shieldText.setText(hasShield ? (shieldActive ? 'Actif' : 'Recharge') : 'Inactif');

  hud.shieldDot.clear();
  const sc = hasShield && shieldActive ? 0x06b6d4 : hasShield ? 0xf5a623 : 0x334155;
  hud.shieldDot.fillStyle(sc, 0.9);
  hud.shieldDot.fillCircle(hud._sPX + 12, hud._sPY + 28, 3.5);
}

// ─────────────────────────────────────────────────────────────
//  Barre de vie
// ─────────────────────────────────────────────────────────────
function _drawLifeBar(bar, cur, max) {
  const ratio = Math.max(0, Math.min(1, cur / max));
  const fw    = Math.floor(bar.w * ratio);
  const color = ratio > 0.5 ? 0x22c55e : ratio > 0.25 ? 0xf5a623 : 0xff4455;
  const glow  = ratio > 0.5 ? 0x4ade80  : ratio > 0.25 ? 0xfbbf24  : 0xff6677;
  bar.fill.clear();
  if (fw > 0) {
    bar.fill.fillStyle(color, 0.9);
    bar.fill.fillRoundedRect(bar.x, bar.y, fw, bar.h, 4);
    bar.fill.fillStyle(glow, 0.25);
    bar.fill.fillRoundedRect(bar.x, bar.y, fw, bar.h/2, 4);
  }
}

// ─────────────────────────────────────────────────────────────
//  createOverlayButton
// ─────────────────────────────────────────────────────────────
export function createOverlayButton(scene, x, y, label, color = UI.cyanSoft, onClick) {
  const w = 220, h = 52, r = 8;
  const cont = scene.add.container(x, y).setDepth(1400);
  cont.setSize(w, h);
  cont.setInteractive(new Phaser.Geom.Rectangle(-w/2, -h/2, w, h), Phaser.Geom.Rectangle.Contains);
  const g = scene.add.graphics();
  _drawBtn(g, w, h, r, color, false);
  const txt = scene.add.text(0, 1, label, { ...FONT, fontSize: '16px', color: '#f0f8ff' }).setOrigin(0.5);
  cont.add([g, txt]);
  cont.on('pointerover',  () => { scene.tweens.add({ targets: cont, scaleX: 1.03, scaleY: 1.03, duration: 80 }); _drawBtn(g, w, h, r, color, true); });
  cont.on('pointerout',   () => { scene.tweens.add({ targets: cont, scaleX: 1,    scaleY: 1,    duration: 80 }); _drawBtn(g, w, h, r, color, false); });
  cont.on('pointerdown',  () => { scene.tweens.add({ targets: cont, scaleX: 0.97, scaleY: 0.97, duration: 55 }); });
  cont.on('pointerup',    () => { scene.tweens.add({ targets: cont, scaleX: 1,    scaleY: 1,    duration: 55, onComplete: () => onClick?.() }); });
  return cont;
}

function _drawBtn(g, w, h, r, color, hovered) {
  g.clear();
  g.fillStyle(0x070e1c, 0.96); g.fillRoundedRect(-w/2, -h/2, w, h, r);
  g.lineStyle(1.5, color, hovered ? 0.8 : 0.55); g.strokeRoundedRect(-w/2, -h/2, w, h, r);
  g.fillStyle(0xffffff, hovered ? 0.06 : 0.03); g.fillRoundedRect(-w/2+2, -h/2+2, w-4, h*0.35, r-2);
  g.fillStyle(UI.cyanSoft, hovered ? 0.8 : 0.55); g.fillRect(-w/2+18, h/2-6, w-36, 2);
}

// ─────────────────────────────────────────────────────────────
//  showGameOverOverlay
// ─────────────────────────────────────────────────────────────
export function showGameOverOverlay(scene) {
  const cx = scene.centerX, cy = scene.centerY;
  const pw = 540, ph = 360;
  const DEPTH = 1300;

  const backdrop = scene.add.rectangle(cx, cy, scene.scale.width, scene.scale.height, 0x000000, 0.7)
    .setDepth(DEPTH).setScrollFactor(0);

  const panG = scene.add.graphics().setDepth(DEPTH+1).setScrollFactor(0);
  panG.fillStyle(0x071222, 0.96); panG.fillRoundedRect(cx-pw/2, cy-ph/2, pw, ph, 12);
  panG.lineStyle(1.5, UI.cyanSoft, 0.35); panG.strokeRoundedRect(cx-pw/2, cy-ph/2, pw, ph, 12);
  panG.fillStyle(0xffffff, 0.03); panG.fillRoundedRect(cx-pw/2+2, cy-ph/2+2, pw-4, ph*0.2, 11);
  panG.fillStyle(UI.cyanSoft, 0.7); panG.fillRoundedRect(cx-pw/2+24, cy+ph/2-4, pw-48, 2, 1);
  panG.setAlpha(0);
  scene.tweens.add({ targets: panG, alpha: 1, duration: 300, ease: 'Quad.Out' });

  const D = DEPTH+2;
  const title    = scene.add.text(cx, cy-132, 'GAME OVER', { ...FONT, fontSize: '40px', color: '#f0f8ff' }).setOrigin(0.5).setDepth(D).setScrollFactor(0);
  const subtitle = scene.add.text(cx, cy-92, 'Transmission interrompue', { ...FONTB, fontSize: '15px', color: '#5a9ab8' }).setOrigin(0.5).setDepth(D).setScrollFactor(0);
  const sep = scene.add.graphics().setDepth(D).setScrollFactor(0);
  sep.lineStyle(1, UI.border, 0.5); sep.lineBetween(cx-200, cy-62, cx+200, cy-62);
  const level  = scene.add.text(cx, cy-38, `Niveau atteint : ${scene.currentLevel??1}`, { ...FONT, fontSize: '22px', color: '#c4b5fd' }).setOrigin(0.5).setDepth(D).setScrollFactor(0);
  const kills  = scene.add.text(cx, cy+2,  `Ennemis éliminés : ${scene.score??0}`, { ...FONTB, fontSize: '19px', color: '#e2e8f0' }).setOrigin(0.5).setDepth(D).setScrollFactor(0);
  const coins  = scene.add.text(cx, cy+38, `Pièces ramassées : ${scene.coins??0}`, { ...FONT, fontSize: '19px', color: '#f5a623' }).setOrigin(0.5).setDepth(D).setScrollFactor(0);
  let bonusText = null;
  if ((scene.bonusCoins??0) > 0) {
    bonusText = scene.add.text(cx, cy+74, `Bonus paliers : +${scene.bonusCoins}`, { ...FONT, fontSize: '17px', color: '#00c8ff' }).setOrigin(0.5).setDepth(D).setScrollFactor(0);
  }
  const menuButton = createOverlayButton(scene, cx, cy+148, 'RETOUR AU MENU', UI.cyanSoft, () => scene.scene.start('MenuScene'));
  menuButton.setScrollFactor(0);
  return { backdrop, panG, title, subtitle, level, kills, coins, bonusText, menuButton };
}

// ─────────────────────────────────────────────────────────────
//  showFloatingText
// ─────────────────────────────────────────────────────────────
export function showFloatingText(scene, x, y, text, color = '#ffffff') {
  const t = scene.add.text(x, y, text, { ...FONT, fontSize: '18px', color }).setOrigin(0.5).setDepth(800);
  scene.tweens.add({ targets: t, y: y-34, alpha: 0, duration: 560, ease: 'Quad.Out', onComplete: () => t.destroy() });
}
