export type Lang = "es" | "en";

const es = {
  // Player card
  remaining: (n: number) => `Faltan ${n}`,
  victory: "¡Victoria!",
  won: "GANÓ",
  // History section
  history: "Historial",
  noScores: "Aún no hay puntos registrados",
  entry: (n: number) => `#${n}`,
  // Bottom buttons
  restart: "Reiniciar",
  previous: "Anteriores",
  // Add / edit modals
  pointsFor: "Puntos —",
  editPoints: "Editar puntos",
  add: "Agregar",
  cancel: "Cancelar",
  save: "Guardar",
  // Custom target modal
  customTargetTitle: "Meta personalizada",
  customTargetPlaceholder: "200",
  // Restart modal
  restartTitle: "¿Reiniciar partida?",
  restartMsg: "Se borrarán todos los puntos y el historial.",
  restartConfirm: "Reiniciar",
  // Previous games modal
  previousGamesTitle: "Partidas anteriores",
  gameTarget: "Meta",
  gameEntries: "apuntes",
  expandHint: "",
  close: "Cerrar",
  deleteGame: "Eliminar",
  confirmDeleteGame: "¿Eliminar esta partida del historial?",
  deleteConfirm: "Eliminar",
  clearHistory: "Limpiar historial",
  clearHistoryTitle: "Limpiar historial",
  clearHistoryMsg: "¿Eliminar todas las partidas anteriores? Esta acción no se puede deshacer.",
  clearHistoryConfirm: "Limpiar todo",
  // Settings modal
  playersTitle: "Jugadores",
  addPlayer: "Agregar jugador",
  playerCountTitle: "Cantidad de jugadores",
  mesaTitle: "Mesas",
  mesaOff: "Sin mesas",
  mesaLabel: (n: number) => `Mesa ${n}`,
  extraToggle: "Puntos extra",
  extraLabel: "Extras",
  forBoth: "Para ambos",
  tie: "Empaté",
  tieLabel: "Empaté",
  edited: "Editado",
  done: "Listo",
  playerCount: (n: number, max: number) => `${n}/${max}`,
  // Rename
  renamePlaceholder: "Nombre del jugador",
  renameTitle: "Editar jugador",
  pickColor: "Color",
  // Language
  languageTitle: "Idioma",
  langEs: "Español",
  langEn: "English",
  bgTitle: "Fondo",
  bgPhotoLabel: "Foto de la galería",
  bgPickPhoto: "Elegir foto",
  bgChangePhoto: "Cambiar foto",
  bgRemovePhoto: "Quitar foto",
  bgPhotoDenied: "Necesitamos permiso para acceder a tus fotos. Actívalo en los ajustes del teléfono.",
  bgScatter: "Caos",
  bgDiagonal: "Diagonal",
  bgGrid: "Cuadrícula",
  bgRadial: "Radial",
  bgGiant: "Gigante",
};

const en = {
  remaining: (n: number) => `${n} left`,
  victory: "Victory!",
  won: "WON",
  history: "History",
  noScores: "No scores recorded yet",
  entry: (n: number) => `#${n}`,
  restart: "Restart",
  previous: "Previous",
  pointsFor: "Points —",
  editPoints: "Edit points",
  add: "Add",
  cancel: "Cancel",
  save: "Save",
  customTargetTitle: "Custom target",
  customTargetPlaceholder: "200",
  restartTitle: "Restart game?",
  restartMsg: "All scores and history will be cleared.",
  restartConfirm: "Restart",
  previousGamesTitle: "Previous games",
  gameTarget: "Target",
  gameEntries: "entries",
  expandHint: "",
  close: "Close",
  deleteGame: "Delete",
  confirmDeleteGame: "Remove this game from history?",
  clearHistory: "Clear history",
  clearHistoryTitle: "Clear history",
  clearHistoryMsg: "Delete all previous games? This action cannot be undone.",
  clearHistoryConfirm: "Clear all",
  deleteConfirm: "Delete",
  playersTitle: "Players",
  addPlayer: "Add player",
  playerCountTitle: "Number of players",
  mesaTitle: "Tables",
  mesaOff: "No tables",
  mesaLabel: (n: number) => `Table ${n}`,
  extraToggle: "Extra points",
  extraLabel: "Extras",
  forBoth: "For both",
  tie: "Tie",
  tieLabel: "Tie",
  edited: "Edited",
  done: "Done",
  playerCount: (n: number, max: number) => `${n}/${max}`,
  renamePlaceholder: "Player name",
  renameTitle: "Edit player",
  pickColor: "Color",
  languageTitle: "Language",
  langEs: "Español",
  langEn: "English",
  bgTitle: "Background",
  bgPhotoLabel: "Photo from gallery",
  bgPickPhoto: "Choose photo",
  bgChangePhoto: "Change photo",
  bgRemovePhoto: "Remove photo",
  bgPhotoDenied: "We need permission to access your photos. Enable it in your phone settings.",
  bgScatter: "Chaos",
  bgDiagonal: "Diagonal",
  bgGrid: "Grid",
  bgRadial: "Radial",
  bgGiant: "Giant",
};

export type Translations = typeof es;
export const TRANSLATIONS: Record<Lang, Translations> = { es, en };

// Default player names per language. Used to translate auto-generated casilla
// names (home/away/Player N) when switching language, without touching custom
// names the user typed.
const DEFAULT_PLAYER_NAMES = {
  es: { home: "Casa", away: "Visitante", player: (n: number) => `Jugador ${n}` },
  en: { home: "House", away: "Visitors", player: (n: number) => `Player ${n}` },
} as const;

export function translatePlayerName(name: string, lang: Lang): string {
  const trimmed = name.trim();
  if (trimmed === "Casa" || trimmed === "House") return DEFAULT_PLAYER_NAMES[lang].home;
  if (trimmed === "Visitante" || trimmed === "Visitors") return DEFAULT_PLAYER_NAMES[lang].away;
  const m = /^(?:Jugador|Player)\s+(\d+)$/.exec(trimmed);
  if (m) return DEFAULT_PLAYER_NAMES[lang].player(Number(m[1]));
  return name;
}
