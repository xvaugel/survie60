export function initLevelState(scene) {
  scene.currentLevel = scene.registry.get('currentLevel') || 1;
  scene.levelDuration = 90;
  scene.levelTimer = 0;
  scene.isBossLevel = scene.currentLevel % 5 === 0;
  scene.bossSpawned = false;
  scene.levelCompleted = false;
}

export function createLevelUI(scene) {
  scene.levelTextUI = scene.add.text(scene.centerX, 20, `Niveau ${scene.currentLevel}`, {
    fontSize: '28px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5, 0);

  scene.centerText = scene.add.text(
    scene.centerX,
    scene.centerY - 120,
    `Niveau ${scene.currentLevel}${scene.currentLevel === 1 ? ' - initiation' : ''}`,
    { fontSize: '28px', color: '#ffffff', align: 'center' },
  ).setOrigin(0.5);

  scene.time.delayedCall(2200, () => scene.centerText?.destroy());
}

export function updateLevelTimer(scene, delta) {
  scene.levelTimer += delta / 1000;
  const remaining = Math.max(0, scene.levelDuration - scene.levelTimer);
  scene.timeText.setText(`Temps : ${remaining.toFixed(1)} s`);

  if (!scene.levelCompleted && scene.levelTimer >= scene.levelDuration) {
    endLevel(scene);
    return true;
  }

  return false;
}

export function createOverlayButton(scene, x, y, label, color, onClick) {
  const container = scene.add.container(x, y);
  const bg = scene.add.rectangle(0, 0, 260, 58, color, 1).setStrokeStyle(3, 0xffffff, 0.15);
  const text = scene.add.text(0, 0, label, {
    fontSize: '24px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5);

  container.add([bg, text]);
  container.setSize(260, 58);
  container.setInteractive({ useHandCursor: true });
  container.on('pointerover', () => {
    container.setScale(1.03);
  });
  container.on('pointerout', () => {
    container.setScale(1);
  });
  container.on('pointerdown', onClick);
  return container;
}

export function endLevel(scene) {
  if (scene.gameOver || scene.levelCompleted) return;

  scene.levelCompleted = true;
  scene.gameOver = true;
  scene.persistRunCoins();

  scene.player.body.setVelocity(0, 0);
  scene.enemies.getChildren().forEach((enemy) => {
    if (enemy.body) enemy.body.setVelocity(0, 0);
  });
  scene.bullets.getChildren().forEach((bullet) => {
    bullet.vx = 0;
    bullet.vy = 0;
  });
  scene.enemyProjectiles.getChildren().forEach((projectile) => {
    projectile.vx = 0;
    projectile.vy = 0;
  });

  const overlay = scene.add.rectangle(scene.centerX, scene.centerY, 560, 340, 0x000000, 0.85)
    .setStrokeStyle(2, 0xffffff, 0.12)
    .setDepth(2000);

  scene.add.text(scene.centerX, scene.centerY - 90, scene.isBossLevel ? 'Boss vaincu !' : 'Niveau terminé', {
    fontSize: '40px',
    color: '#ffffff',
    fontStyle: 'bold',
  }).setOrigin(0.5).setDepth(2001);

  scene.add.text(scene.centerX, scene.centerY - 28, `Niveau ${scene.currentLevel} terminé\nKills : ${scene.score}  |  Pièces : ${scene.coins}`, {
    fontSize: '22px',
    color: '#ffffff',
    align: 'center',
  }).setOrigin(0.5).setDepth(2001);

  const nextButton = createOverlayButton(scene, scene.centerX, scene.centerY + 44, 'Niveau suivant', 0x16a34a, () => {
    scene.registry.set('currentLevel', scene.currentLevel + 1);
    scene.scene.restart({ upgrades: scene.runUpgrades });
  });

  const menuButton = createOverlayButton(scene, scene.centerX, scene.centerY + 118, 'Boutique / menu', 0x2563eb, () => {
    scene.scene.start('MenuScene');
  });

  overlay.setDataEnabled();
  nextButton.setDepth(2001);
  menuButton.setDepth(2001);
}
