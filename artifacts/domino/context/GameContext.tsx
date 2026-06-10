import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Player {
  id: string;
  name: string;
  color: string;
}

export interface ScoreEntry {
  id: string;
  playerId: string;
  points: number;
  extra?: boolean;
  tie?: boolean;
  edited?: boolean;
  deleted?: boolean;
}

export interface PreviousGame {
  id: string;
  date: number;
  players: Player[];
  entries: ScoreEntry[];
  target: number;
  mesas: number;
}

interface GameState {
  players: Player[];
  entries: ScoreEntry[];
  target: number;
  previousGames: PreviousGame[];
  bgTheme: string;
  customBgUri: string | null;
  mesas: number;
}

interface GameContextValue extends GameState {
  totals: Record<string, number>;
  addEntry: (playerId: string, points: number, extra?: boolean, tie?: boolean) => void;
  editEntry: (entryId: string, points: number) => void;
  deleteEntry: (entryId: string) => void;
  setTarget: (target: number) => void;
  setPlayerName: (playerId: string, name: string) => void;
  setPlayerColor: (playerId: string, color: string) => void;
  addPlayer: () => void;
  removePlayer: (playerId: string) => void;
  setPlayerCount: (count: number) => void;
  setMesas: (count: number) => void;
  restart: () => void;
  deletePreviousGame: (gameId: string) => void;
  clearPreviousGames: () => void;
  setBgTheme: (theme: string) => void;
  setCustomBgUri: (uri: string | null) => void;
}

const STORAGE_KEY = "domino_game_v3";

export const PLAYER_COLORS = [
  "#3B82F6",
  "#EF4444",
  "#22C55E",
  "#F59E0B",
  "#A855F7",
  "#EC4899",
  "#14B8A6",
  "#F97316",
];

const defaultPlayers: Player[] = [
  { id: "p1", name: "Casa", color: PLAYER_COLORS[0] },
  { id: "p2", name: "Visitante", color: PLAYER_COLORS[1] },
];

const defaultState: GameState = {
  players: defaultPlayers,
  entries: [],
  target: 200,
  previousGames: [],
  bgTheme: "scatter",
  customBgUri: null,
  mesas: 0,
};

const BG_THEME_IDS = ["scatter", "diagonal", "grid", "radial", "giant", "custom"];

function normalizeBgTheme(theme: unknown): string {
  return typeof theme === "string" && BG_THEME_IDS.includes(theme)
    ? theme
    : "scatter";
}

export function computeTotals(entries: ScoreEntry[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const e of entries) {
    if (e.deleted) continue;
    totals[e.playerId] = (totals[e.playerId] ?? 0) + e.points;
  }
  return totals;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as GameState;
          const hasCustom =
            typeof parsed.customBgUri === "string" && parsed.customBgUri.length > 0;
          let bgTheme = normalizeBgTheme(parsed.bgTheme);
          if (bgTheme === "custom" && !hasCustom) bgTheme = "scatter";
          setState({
            ...defaultState,
            ...parsed,
            customBgUri: hasCustom ? parsed.customBgUri : null,
            bgTheme,
          });
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const totals = computeTotals(state.entries);

  const addEntry = useCallback((playerId: string, points: number, extra?: boolean, tie?: boolean) => {
    setState((prev) => {
      const entry: ScoreEntry = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        playerId,
        points,
        extra: extra ? true : undefined,
        tie: tie ? true : undefined,
      };
      const next = { ...prev, entries: [...prev.entries, entry] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const editEntry = useCallback((entryId: string, points: number) => {
    setState((prev) => {
      const next = {
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === entryId
            ? { ...e, points, tie: points === 0 ? true : undefined, edited: true }
            : e
        ),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deleteEntry = useCallback((entryId: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        entries: prev.entries.map((e) =>
          e.id === entryId ? { ...e, deleted: e.deleted ? undefined : true } : e
        ),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setTarget = useCallback((target: number) => {
    setState((prev) => {
      const next = { ...prev, target };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setPlayerColor = useCallback((playerId: string, color: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, color } : p
        ),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setPlayerName = useCallback((playerId: string, name: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        players: prev.players.map((p) =>
          p.id === playerId ? { ...p, name } : p
        ),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const addPlayer = useCallback(() => {
    setState((prev) => {
      if (prev.players.length >= 8) return prev;
      const colorIndex = prev.players.length % PLAYER_COLORS.length;
      const newPlayer: Player = {
        id: "p" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
        name: `Jugador ${prev.players.length + 1}`,
        color: PLAYER_COLORS[colorIndex],
      };
      const next = { ...prev, players: [...prev.players, newPlayer], mesas: 0 };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const removePlayer = useCallback((playerId: string) => {
    setState((prev) => {
      if (prev.players.length <= 2) return prev;
      const next = {
        ...prev,
        players: prev.players.filter((p) => p.id !== playerId),
        entries: prev.entries.filter((e) => e.playerId !== playerId),
        mesas: 0,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setPlayerCount = useCallback((count: number) => {
    setState((prev) => {
      if (!Number.isFinite(count)) return prev;
      const target = Math.max(2, Math.min(8, Math.floor(count)));
      if (target === prev.players.length) return prev;

      let players = [...prev.players];
      if (target > players.length) {
        for (let i = players.length; i < target; i++) {
          players.push({
            id: "p" + Date.now() + "_" + i,
            name: `Jugador ${i + 1}`,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          });
        }
      } else {
        players = players.slice(0, target);
      }

      const keptIds = new Set(players.map((p) => p.id));
      const next = {
        ...prev,
        players,
        entries: prev.entries.filter((e) => keptIds.has(e.playerId)),
        mesas: 0,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setMesas = useCallback((count: number) => {
    setState((prev) => {
      if (!Number.isFinite(count)) return prev;
      const mesas = Math.max(0, Math.min(20, Math.floor(count)));
      if (mesas === 0) {
        if (prev.mesas === 0) return prev;
        const players = prev.players.slice(0, 2);
        const keptIds = new Set(players.map((p) => p.id));
        const next = {
          ...prev,
          players,
          entries: prev.entries.filter((e) => keptIds.has(e.playerId)),
          mesas: 0,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      }

      const target = mesas * 2;
      let players = [...prev.players];
      if (target > players.length) {
        for (let i = players.length; i < target; i++) {
          players.push({
            id: "p" + Date.now() + "_" + i,
            name: `Jugador ${i + 1}`,
            color: PLAYER_COLORS[i % PLAYER_COLORS.length],
          });
        }
      } else if (target < players.length) {
        players = players.slice(0, target);
      }

      const keptIds = new Set(players.map((p) => p.id));
      const next = {
        ...prev,
        players,
        entries: prev.entries.filter((e) => keptIds.has(e.playerId)),
        mesas,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const deletePreviousGame = useCallback((gameId: string) => {
    setState((prev) => {
      const next = {
        ...prev,
        previousGames: prev.previousGames.filter((g) => g.id !== gameId),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearPreviousGames = useCallback(() => {
    setState((prev) => {
      const next = { ...prev, previousGames: [] };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const restart = useCallback(() => {
    setState((prev) => {
      // Only archive if there are actual entries to save
      const savedGame: PreviousGame | null =
        prev.entries.length > 0
          ? {
              id: Date.now().toString(),
              date: Date.now(),
              players: prev.players,
              entries: prev.entries,
              target: prev.target,
              mesas: prev.mesas,
            }
          : null;

      const next: GameState = {
        ...prev,
        entries: [],
        previousGames: savedGame
          ? [savedGame, ...prev.previousGames].slice(0, 10)
          : prev.previousGames,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setBgTheme = useCallback((theme: string) => {
    setState((prev) => {
      const next = { ...prev, bgTheme: normalizeBgTheme(theme) };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const setCustomBgUri = useCallback((uri: string | null) => {
    setState((prev) => {
      const next = {
        ...prev,
        customBgUri: uri,
        bgTheme: uri ? "custom" : prev.bgTheme === "custom" ? "scatter" : prev.bgTheme,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  if (!loaded) return null;

  return (
    <GameContext.Provider
      value={{
        ...state,
        totals,
        addEntry,
        editEntry,
        deleteEntry,
        setTarget,
        setPlayerName,
        setPlayerColor,
        addPlayer,
        removePlayer,
        setPlayerCount,
        setMesas,
        restart,
        deletePreviousGame,
        clearPreviousGames,
        setBgTheme,
        setCustomBgUri,
      }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
