// ============================================================
//  DifficultyConfig.js — Courbe de difficulté du jeu
//
//  COMMENT LIRE CE FICHIER :
//  Chaque zone couvre un groupe de niveaux (entre deux boss).
//  Les niveaux multiples de 5 sont automatiquement des boss
//  (géré dans LevelSystem.js) — ils n'apparaissent pas ici.
//
//  PARAMÈTRES PAR ZONE :
//  · spawnMs      — intervalle entre deux spawns (ms). Plus bas = plus dense.
//  · enemySpeed   — vitesse de base des ennemis (px/s)
//  · pool         — liste des types d'ennemis possibles.
//                   Répéter un type pour augmenter sa probabilité.
//                   ex: ['basic','basic','fast'] → basic 66%, fast 33%
//
//  TYPES DISPONIBLES :
//  · basic    — ennemi standard, fonce droit
//  · fast     — rapide, peu de vie
//  · tank     — lent, beaucoup de vie, gros dégâts
//  · zigzag   — trajectoire imprévisible
//  · shooter  — reste à distance, tire des projectiles (apparaît zone 2)
//  · kamikaze — accélère au contact, explose en AoE (apparaît zone 3)
//  · swarm    — spawne en escouade de 5 araignées (apparaît zone 4)
//
//  MODIFIER LA DIFFICULTÉ :
//  · Trop facile → baisser spawnMs ou augmenter enemySpeed
//  · Trop difficile → augmenter spawnMs ou retirer un type du pool
//  · Trop de shooters → retirer une occurrence de 'shooter' du pool
//  · Changer l'ordre d'introduction → déplacer le type dans une autre zone
// ============================================================

export const DIFFICULTY_ZONES = [

  // ── ZONE 1 : Niveaux 1 — Initiation ─────────────────────
  // Uniquement des ennemis basiques pour apprendre les contrôles
  {
    levels:    [1],
    spawnMs:   950,
    enemySpeed: 72,
    pool:      ['basic', 'basic', 'basic'],
    label:     'Initiation',
  },

  // ── ZONE 2 : Niveaux 2-4 — Apprentissage ─────────────────
  // Introduction progressive de fast et tank, pas encore de nouveautés
  {
    levels:    [2],
    spawnMs:   900,
    enemySpeed: 80,
    pool:      ['basic', 'basic', 'fast'],
    label:     'Apprentissage',
  },
  {
    levels:    [3],
    spawnMs:   860,
    enemySpeed: 86,
    pool:      ['basic', 'fast', 'fast', 'tank'],
    label:     'Apprentissage',
  },
  {
    levels:    [4],
    spawnMs:   820,
    enemySpeed: 92,
    pool:      ['basic', 'fast', 'fast', 'tank', 'zigzag'],
    label:     'Apprentissage',
  },

  // ── ZONE 3 : Niveaux 6-9 — Pression croissante ───────────
  // Niveau 5 = boss (automatique)
  // Introduction du shooter en niveau 6 — 1 seul dans le pool (~14%)
  {
    levels:    [6],
    spawnMs:   760,
    enemySpeed: 98,
    pool:      ['basic', 'basic', 'fast', 'fast', 'zigzag', 'shooter'],
    label:     'Pression',
  },
  {
    levels:    [7],
    spawnMs:   720,
    enemySpeed: 104,
    pool:      ['basic', 'fast', 'fast', 'fast', 'zigzag', 'zigzag', 'shooter'],
    label:     'Pression',
  },
  // Niveau 8 : premier kamikaze, toujours 1 seul pour ne pas surprendre
  {
    levels:    [8],
    spawnMs:   680,
    enemySpeed: 110,
    pool:      ['basic', 'fast', 'fast', 'zigzag', 'zigzag', 'shooter', 'kamikaze'],
    label:     'Pression',
  },
  {
    levels:    [9],
    spawnMs:   640,
    enemySpeed: 115,
    pool:      ['basic', 'fast', 'fast', 'fast', 'zigzag', 'shooter', 'kamikaze'],
    label:     'Pression',
  },

  // ── ZONE 4 : Niveaux 11-14 — Chaos organisé ──────────────
  // Niveau 10 = boss
  // Swarm arrive, densité monte, tanks de retour
  {
    levels:    [11],
    spawnMs:   600,
    enemySpeed: 118,
    pool:      ['basic', 'fast', 'fast', 'zigzag', 'shooter', 'kamikaze', 'swarm'],
    label:     'Chaos',
  },
  {
    levels:    [12],
    spawnMs:   560,
    enemySpeed: 122,
    pool:      ['fast', 'fast', 'zigzag', 'tank', 'shooter', 'kamikaze', 'kamikaze', 'swarm'],
    label:     'Chaos',
  },
  {
    levels:    [13],
    spawnMs:   540,
    enemySpeed: 126,
    pool:      ['fast', 'zigzag', 'zigzag', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'swarm'],
    label:     'Chaos',
  },
  {
    levels:    [14],
    spawnMs:   520,
    enemySpeed: 130,
    pool:      ['fast', 'zigzag', 'tank', 'tank', 'shooter', 'kamikaze', 'kamikaze', 'kamikaze', 'swarm'],
    label:     'Chaos',
  },

  // ── ZONE 5 : Niveaux 16-19 — Survie extrême ──────────────
  // Niveau 15 = boss
  // Densité maximale, tous les types présents, pression constante
  {
    levels:    [16],
    spawnMs:   490,
    enemySpeed: 134,
    pool:      ['fast', 'fast', 'zigzag', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'swarm', 'swarm'],
    label:     'Survie extrême',
  },
  {
    levels:    [17],
    spawnMs:   470,
    enemySpeed: 138,
    pool:      ['fast', 'zigzag', 'tank', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'kamikaze', 'swarm'],
    label:     'Survie extrême',
  },
  {
    levels:    [18],
    spawnMs:   455,
    enemySpeed: 142,
    pool:      ['zigzag', 'tank', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'kamikaze', 'swarm', 'swarm'],
    label:     'Survie extrême',
  },
  {
    levels:    [19],
    spawnMs:   440,
    enemySpeed: 145,
    pool:      ['tank', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'kamikaze', 'swarm', 'swarm', 'swarm'],
    label:     'Survie extrême',
  },

  // ── ZONE 6 : Niveaux 21-24 — Enfer ───────────────────────
  // Niveau 20 = boss
  {
    levels:    [21],
    spawnMs:   430,
    enemySpeed: 148,
    pool:      ['fast', 'tank', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'swarm', 'swarm', 'swarm'],
    label:     'Enfer',
  },
  {
    levels:    [22],
    spawnMs:   420,
    enemySpeed: 150,
    pool:      ['tank', 'tank', 'shooter', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'kamikaze', 'swarm', 'swarm'],
    label:     'Enfer',
  },
  {
    levels:    [23, 24],
    spawnMs:   415,
    enemySpeed: 152,
    pool:      ['tank', 'tank', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'kamikaze', 'swarm', 'swarm'],
    label:     'Enfer',
  },

  // ── ZONE 7 : Niveaux 26-49 — Au-delà ─────────────────────
  // Niveau 25 = boss
  // Palier maximum : difficulté plafonnée mais exigeante
  // Pour tous les niveaux non couverts → fallback sur cette zone
  {
    levels:    'default',    // ← utilisé pour tous les niveaux non listés
    spawnMs:   420,
    enemySpeed: 155,
    pool:      ['tank', 'tank', 'shooter', 'shooter', 'kamikaze', 'kamikaze', 'kamikaze', 'swarm', 'swarm', 'swarm'],
    label:     'Au-delà',
  },
];

// ── Lookup : retourne la zone pour un niveau donné ────────────
export function getZoneForLevel(level) {
  // Cherche une zone dont le tableau levels contient ce niveau
  const zone = DIFFICULTY_ZONES.find(z =>
    Array.isArray(z.levels) && z.levels.includes(level)
  );
  // Fallback sur la zone 'default' si non trouvé
  return zone || DIFFICULTY_ZONES.find(z => z.levels === 'default');
}

// ── Retourne un type d'ennemi aléatoire pour ce niveau ────────
export function getEnemyTypeForLevel(level) {
  const zone = getZoneForLevel(level);
  const pool = zone.pool;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── Retourne les paramètres de spawn pour ce niveau ───────────
export function getDifficultyParams(level) {
  const zone = getZoneForLevel(level);
  return {
    spawnMs:    zone.spawnMs,
    enemySpeed: zone.enemySpeed,
    label:      zone.label,
  };
}
