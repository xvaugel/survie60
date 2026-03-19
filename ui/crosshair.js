export function createCrosshair(scene) {
  const crosshair = scene.add.container(0, 0);
  const ring = scene.add.circle(0, 0, 10, 0xffffff, 0.08).setStrokeStyle(1, 0xffffff);
  const h = scene.add.line(0, 0, -6, 0, 6, 0, 0xffffff).setLineWidth(1);
  const v = scene.add.line(0, 0, 0, -6, 0, 6, 0xffffff).setLineWidth(1);
  crosshair.add([ring, h, v]);
  crosshair.setDepth(1000);
  scene.input.setDefaultCursor('none');
  return crosshair;
}
