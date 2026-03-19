// ============================================================
//  AudioConfig.js — Configuration centralisée du son
//
//  COMMENT AJUSTER :
//  · Changer un volume → modifier la valeur dans VOLUMES
//  · Désactiver un son → mettre sa valeur à 0
//  · Activer/désactiver la musique au démarrage → MUSIC_AUTOPLAY
//
//  RÈGLE NAVIGATEUR :
//  Les navigateurs modernes bloquent l'audio avant toute
//  interaction utilisateur. On respecte cette règle :
//  la musique ne démarre qu'après le premier clic/touche.
// ============================================================

export const AUDIO_CONFIG = {

  // ── Musiques ──────────────────────────────────────────────
  music: {
    menu:  { key: 'music-menu',    volume: 0.18, loop: true },
    game:  { key: 'music-game',    volume: 0.18, loop: true },
    // Boss : une musique par boss. Ajoute boss-level-10.mp3, boss-level-15.mp3...
    boss1: { key: 'boss-level-5',  volume: 0.22, loop: true },
    boss2: { key: 'boss-level-5',  volume: 0.22, loop: true },  // → 'boss-level-10' quand dispo
    boss3: { key: 'boss-level-5',  volume: 0.22, loop: true },
    boss4: { key: 'boss-level-5',  volume: 0.22, loop: true },
  },

  // ── Effets sonores ────────────────────────────────────────
  sfx: {
    button:           { key: 'button',           volume: 0.25 },
    coin:             { key: 'coin',              volume: 0.30 },
    gameOver:         { key: 'game-over',         volume: 0.30 },
    playerExplosion:  { key: 'player-explosion',  volume: 0.10 },
    enemyExplosion:   { key: 'rouge-explosion',   volume: 0.08 },
    bossExplosion:    { key: 'boss-level-5-explosion', volume: 0.35 },
    atelier:          { key: 'sound_atelier',     volume: 0.40 },
  },

  // ── Comportement ─────────────────────────────────────────
  // La musique ne démarre QUE sur interaction utilisateur
  // (règle navigateur moderne — ne pas mettre true ici)
  MUSIC_AUTOPLAY: false,

  // Durée du fondu entre musiques (ms)
  CROSSFADE_MS: 800,
};

// ─────────────────────────────────────────────────────────────
//  AudioManager — singleton attaché à la scène Phaser
// ─────────────────────────────────────────────────────────────

let _interacted = false;  // l'utilisateur a-t-il interagi ?
let _musicEnabled = true;
let _currentMusic = null; // clé de la musique en cours

/** Appeler une seule fois au démarrage du jeu (dans main.js ou MenuScene) */
export function initAudio(game) {
  // Écouter la première interaction pour débloquer l'audio
  const unlock = () => {
    _interacted = true;
    document.removeEventListener('keydown', unlock);
    document.removeEventListener('mousedown', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('keydown',   unlock, { once: true });
  document.addEventListener('mousedown', unlock, { once: true });
  document.addEventListener('touchstart',unlock, { once: true });
}

/** Retourne la clé de musique pour un niveau boss donné */
export function getBossMusicKey(level) {
  const tier = Math.floor(level / 5);  // boss 1=tier1, 2=tier2...
  const key  = `boss${tier}`;
  return AUDIO_CONFIG.music[key] ? key : 'boss1';  // fallback boss1
}

/** Jouer une musique (avec fondu si une autre est en cours) */
export function playMusic(scene, trackKey) {
  if (!_interacted || !_musicEnabled) return;

  // trackKey peut être une clé de config ('boss1') ou directement une clé audio ('boss-level-5')
  const cfg = AUDIO_CONFIG.music[trackKey]
    || Object.values(AUDIO_CONFIG.music).find(m => m.key === trackKey);
  if (!cfg) return;

  const audioKey = cfg.key;  // clé audio réelle (ex: 'boss-level-5')

  if (_currentMusic === audioKey) return;

  // Fondre la musique en cours
  const current = scene.sound.get(_currentMusic);
  if (current?.isPlaying) {
    scene.tweens.add({
      targets: current, volume: 0,
      duration: AUDIO_CONFIG.CROSSFADE_MS,
      onComplete: () => current.stop(),
    });
  }

  _currentMusic = audioKey;

  // Démarrer la nouvelle avec la vraie clé audio
  const existing = scene.sound.get(audioKey);
  const music    = existing || scene.sound.add(audioKey, { volume: 0, loop: cfg.loop });

  if (!music.isPlaying) music.play();
  scene.tweens.add({
    targets: music, volume: cfg.volume,
    duration: AUDIO_CONFIG.CROSSFADE_MS,
  });
}

/** Arrêter la musique en cours avec fondu */
export function stopMusic(scene) {
  const current = scene.sound.get(_currentMusic);
  if (current?.isPlaying) {
    scene.tweens.add({
      targets: current, volume: 0,
      duration: AUDIO_CONFIG.CROSSFADE_MS,
      onComplete: () => { current.stop(); _currentMusic = null; },
    });
  } else {
    _currentMusic = null;
  }
}

/** Jouer un effet sonore */
export function playSfx(scene, sfxId, overrides = {}) {
  if (!_interacted) return;
  const cfg = AUDIO_CONFIG.sfx[sfxId];
  if (!cfg) return;
  scene.sound?.play?.(cfg.key, {
    volume: overrides.volume ?? cfg.volume,
    rate:   overrides.rate   ?? 1,
    ...overrides,
  });
}

/** Activer/désactiver la musique */
export function setMusicEnabled(scene, enabled) {
  _musicEnabled = enabled;
  if (!enabled) stopMusic(scene);
}

export function isMusicEnabled() { return _musicEnabled; }
export function hasInteracted()  { return _interacted; }
