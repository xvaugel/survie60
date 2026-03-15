import { loadProgress, saveProgress } from '../systems/storage.js';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;
    const centerX = width / 2;
    const centerY = height / 2;

    this.progress = loadProgress();

    this.add.rectangle(centerX, centerY, width, height, 0x111111);
    this.add.text(centerX, centerY - 170, 'SURVIE 60S', {
      fontSize: '52px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 120, `Pièces totales : ${this.progress.coins}`, {
      fontSize: '24px', color: '#facc15'
    }).setOrigin(0.5);

    const shopStartY = centerY - 40;
    this.createUpgrade(centerX, shopStartY, 'Vitesse joueur', 'speed', 5);
    this.createUpgrade(centerX, shopStartY + 60, 'Cadence tir', 'fireRate', 5);
    this.createUpgrade(centerX, shopStartY + 120, 'Vitesse balles', 'bulletSpeed', 5);

    const startButton = this.add.container(centerX, centerY + 210);
    const startBg = this.add.rectangle(0, 0, 260, 72, 0x16a34a, 1).setStrokeStyle(3, 0xffffff, 0.18);
    const startLabel = this.add.text(0, 0, 'Lancer la partie', {
      fontSize: '28px', color: '#ffffff', fontStyle: 'bold'
    }).setOrigin(0.5);

    startButton.add([startBg, startLabel]);
    startButton.setSize(260, 72);
    startButton.setInteractive({ useHandCursor: true });
    startButton.on('pointerover', () => { startBg.setFillStyle(0x15803d, 1); startButton.setScale(1.03); });
    startButton.on('pointerout', () => { startBg.setFillStyle(0x16a34a, 1); startButton.setScale(1); });
    startButton.on('pointerdown', () => {
      this.scene.start('SurvivalScene', { upgrades: { ...this.progress.upgrades } });
    });
  }

  createUpgrade(x, y, label, key, baseCost) {
    const level = this.progress.upgrades[key] || 0;
    const cost = baseCost * (level + 1);
    const canAfford = this.progress.coins >= cost;

    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 320, 48, canAfford ? 0x222222 : 0x1a1a1a).setStrokeStyle(2, 0xffffff, 0.1);
    const text = this.add.text(-140, 0, `${label} (lvl ${level})`, { fontSize: '18px', color: '#ffffff' }).setOrigin(0, 0.5);
    const buy = this.add.text(120, 0, `Acheter ${cost}`, {
      fontSize: '18px', color: canAfford ? '#facc15' : '#777777'
    }).setOrigin(0.5);

    container.add([bg, text, buy]);
    container.setSize(320, 48);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerover', () => { if (canAfford) container.setScale(1.02); });
    container.on('pointerout', () => container.setScale(1));
    container.on('pointerdown', () => {
      if (this.progress.coins < cost) return;
      this.progress.coins -= cost;
      this.progress.upgrades[key] += 1;
      saveProgress(this.progress);
      this.scene.restart();
    });
  }
}
