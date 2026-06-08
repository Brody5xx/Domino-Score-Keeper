import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

export interface Round {
  id: string;
  home: number;
  visitor: number;
}

interface GameState {
  homeTotal: number;
  visitorTotal: number;
  target: number;
  rounds: Round[];
}

interface GameContextValue extends GameState {
  addPoints: (team: "home" | "visitor", points: number) => void;
  setTarget: (target: number) => void;
  restart: () => void;
}

const STORAGE_KEY = "domino_game_state";

const defaultState: GameState = {
  homeTotal: 0,
  visitorTotal: 0,
  target: 200,
  rounds: [],
};

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<GameState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as GameState;
          setState(parsed);
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const persist = useCallback((next: GameState) => {
    setState(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, []);

  const addPoints = useCallback(
    (team: "home" | "visitor", points: number) => {
      setState((prev) => {
        const lastRound = prev.rounds[prev.rounds.length - 1];
        let newRounds: Round[];
        if (lastRound && lastRound.home === 0 && team === "home") {
          newRounds = prev.rounds.slice(0, -1).concat({
            ...lastRound,
            home: points,
          });
        } else if (lastRound && lastRound.visitor === 0 && team === "visitor") {
          newRounds = prev.rounds.slice(0, -1).concat({
            ...lastRound,
            visitor: points,
          });
        } else {
          const newRound: Round = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
            home: team === "home" ? points : 0,
            visitor: team === "visitor" ? points : 0,
          };
          newRounds = [...prev.rounds, newRound];
        }
        const next: GameState = {
          ...prev,
          homeTotal: prev.homeTotal + (team === "home" ? points : 0),
          visitorTotal: prev.visitorTotal + (team === "visitor" ? points : 0),
          rounds: newRounds,
        };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const setTarget = useCallback(
    (target: number) => {
      persist({ ...state, target });
    },
    [state, persist]
  );

  const restart = useCallback(() => {
    persist({ ...defaultState, target: state.target });
  }, [state.target, persist]);

  if (!loaded) return null;

  return (
    <GameContext.Provider value={{ ...state, addPoints, setTarget, restart }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
