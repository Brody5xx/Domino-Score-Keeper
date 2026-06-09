import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { PLAYER_COLORS } from "@/context/GameContext";

export interface TournamentTeam {
  id: string;
  name: string;
  p1: string;
  p2: string;
  color: string;
  lives: number;
  eliminated: boolean;
}

export interface TournamentMatch {
  id: string;
  round: number;
  aId: string;
  bId: string | null; // null = bye (descansa)
  winnerId: string | null;
  method: "tap" | "points" | null;
  scoreA: number;
  scoreB: number;
}

interface TournamentState {
  active: boolean;
  started: boolean;
  lives: number;
  target: number;
  teams: TournamentTeam[];
  matches: TournamentMatch[];
  round: number;
  championId: string | null;
}

interface TournamentContextValue extends TournamentState {
  currentMatches: TournamentMatch[];
  survivors: TournamentTeam[];
  roundComplete: boolean;
  getTeam: (id: string | null) => TournamentTeam | undefined;
  setActive: (active: boolean) => void;
  toggleActive: () => void;
  setLives: (n: number) => void;
  setMatchTarget: (n: number) => void;
  setTeamCount: (n: number) => void;
  setTeamName: (id: string, name: string) => void;
  setTeamPlayer: (id: string, which: 1 | 2, name: string) => void;
  setTeamColor: (id: string, color: string) => void;
  startTournament: () => void;
  regenerateRound: () => void;
  swapTeamSlots: (teamIdA: string, teamIdB: string) => void;
  setMatchMethod: (matchId: string, method: "tap" | "points" | null) => void;
  addMatchPoints: (matchId: string, side: "a" | "b", points: number) => void;
  resolveMatch: (matchId: string, winnerId: string) => void;
  undoMatch: (matchId: string) => void;
  nextRound: () => void;
  resetTournament: () => void;
}

const STORAGE_KEY = "domino_tournament_v1";
const MIN_TEAMS = 2;
const MAX_TEAMS = 12;

function makeTeam(index: number, lives: number): TournamentTeam {
  return {
    id: "t" + Date.now() + "_" + index + Math.random().toString(36).slice(2, 6),
    name: `Equipo ${index + 1}`,
    p1: `Jugador ${index * 2 + 1}`,
    p2: `Jugador ${index * 2 + 2}`,
    color: PLAYER_COLORS[index % PLAYER_COLORS.length],
    lives,
    eliminated: false,
  };
}

function defaultState(): TournamentState {
  const lives = 3;
  return {
    active: false,
    started: false,
    lives,
    target: 200,
    teams: [makeTeam(0, lives), makeTeam(1, lives)],
    matches: [],
    round: 0,
    championId: null,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const pairKey = (a: string, b: string) => [a, b].sort().join("|");

function genId() {
  return "m" + Date.now() + Math.random().toString(36).slice(2, 8);
}

const normName = (name: string) => name.trim().toLowerCase();

// Two teams are "allies" when they share the same (non-empty) team name.
// Allied teams must never be paired against each other.
function sameTeamName(a: TournamentTeam, b: TournamentTeam): boolean {
  const na = normName(a.name);
  const nb = normName(b.name);
  return na.length > 0 && na === nb;
}

type Pair = [TournamentTeam, TournamentTeam | null];

// Backtracking pairing that respects `isValid` for every matched pair.
// Leaves exactly one team unpaired (a bye) when the count is odd.
function findPairing(
  teams: TournamentTeam[],
  isValid: (a: TournamentTeam, b: TournamentTeam) => boolean
): Pair[] | null {
  if (teams.length === 0) return [];
  if (teams.length === 1) return [[teams[0], null]]; // bye
  const [first, ...rest] = teams;
  for (const candidate of shuffle(rest)) {
    if (!isValid(first, candidate)) continue;
    const remaining = rest.filter((t) => t.id !== candidate.id);
    const sub = findPairing(remaining, isValid);
    if (sub) return [[first, candidate], ...sub];
  }
  return null;
}

function generateMatches(
  pool: TournamentTeam[],
  round: number,
  avoid: Set<string>
): TournamentMatch[] {
  const shuffled = shuffle(pool);
  // Priority: 1) no allied (same-name) pairs AND no rematch,
  //           2) no allied pairs, 3) anything (mathematically forced).
  const pairing =
    findPairing(
      shuffled,
      (a, b) => !sameTeamName(a, b) && !avoid.has(pairKey(a.id, b.id))
    ) ??
    findPairing(shuffled, (a, b) => !sameTeamName(a, b)) ??
    findPairing(shuffled, () => true) ??
    [];

  const matches: TournamentMatch[] = [];
  for (const [a, b] of pairing) {
    matches.push({
      id: genId(),
      round,
      aId: a.id,
      bId: b ? b.id : null,
      // bye → auto-advance, no life lost
      winnerId: b ? null : a.id,
      method: null,
      scoreA: 0,
      scoreB: 0,
    });
  }
  return matches;
}

function prevRoundPairs(state: TournamentState): Set<string> {
  const set = new Set<string>();
  for (const m of state.matches) {
    if (m.round === state.round && m.bId) set.add(pairKey(m.aId, m.bId));
  }
  return set;
}

const TournamentContext = createContext<TournamentContextValue | null>(null);

export function TournamentProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<TournamentState>(defaultState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as TournamentState;
          setState({ ...defaultState(), ...parsed });
        } catch {}
      }
      setLoaded(true);
    });
  }, []);

  const persist = (next: TournamentState) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  };

  const setActive = useCallback((active: boolean) => {
    setState((prev) => persist({ ...prev, active }));
  }, []);

  const toggleActive = useCallback(() => {
    setState((prev) => persist({ ...prev, active: !prev.active }));
  }, []);

  const setLives = useCallback((n: number) => {
    setState((prev) => {
      if (prev.started) return prev;
      const lives = Math.max(1, Math.min(10, Math.floor(n)));
      return persist({ ...prev, lives });
    });
  }, []);

  const setMatchTarget = useCallback((n: number) => {
    setState((prev) => {
      const target = Math.max(1, Math.floor(n));
      return persist({ ...prev, target });
    });
  }, []);

  const setTeamCount = useCallback((n: number) => {
    setState((prev) => {
      if (prev.started) return prev;
      const count = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.floor(n)));
      if (count === prev.teams.length) return prev;
      let teams = [...prev.teams];
      if (count > teams.length) {
        for (let i = teams.length; i < count; i++) teams.push(makeTeam(i, prev.lives));
      } else {
        teams = teams.slice(0, count);
      }
      return persist({ ...prev, teams });
    });
  }, []);

  const setTeamName = useCallback((id: string, name: string) => {
    setState((prev) =>
      persist({
        ...prev,
        teams: prev.teams.map((t) => (t.id === id ? { ...t, name } : t)),
      })
    );
  }, []);

  const setTeamPlayer = useCallback((id: string, which: 1 | 2, name: string) => {
    setState((prev) =>
      persist({
        ...prev,
        teams: prev.teams.map((t) =>
          t.id === id ? { ...t, [which === 1 ? "p1" : "p2"]: name } : t
        ),
      })
    );
  }, []);

  const setTeamColor = useCallback((id: string, color: string) => {
    setState((prev) =>
      persist({
        ...prev,
        teams: prev.teams.map((t) => (t.id === id ? { ...t, color } : t)),
      })
    );
  }, []);

  const startTournament = useCallback(() => {
    setState((prev) => {
      if (prev.teams.length < MIN_TEAMS) return prev;
      const teams = prev.teams.map((t) => ({
        ...t,
        lives: prev.lives,
        eliminated: false,
      }));
      const matches = generateMatches(teams, 1, new Set());
      return persist({
        ...prev,
        teams,
        started: true,
        round: 1,
        matches,
        championId: null,
      });
    });
  }, []);

  const regenerateRound = useCallback(() => {
    setState((prev) => {
      if (!prev.started || prev.championId) return prev;
      const current = prev.matches.filter((m) => m.round === prev.round);
      // Only allow reshuffle if no real match has been resolved yet this round
      const anyResolved = current.some((m) => m.bId && m.winnerId);
      if (anyResolved) return prev;
      const survivors = prev.teams.filter((t) => !t.eliminated);
      const others = prev.matches.filter((m) => m.round !== prev.round);
      const matches = generateMatches(survivors, prev.round, new Set());
      return persist({ ...prev, matches: [...others, ...matches] });
    });
  }, []);

  const swapTeamSlots = useCallback((teamIdA: string, teamIdB: string) => {
    setState((prev) => {
      if (!prev.started || teamIdA === teamIdB) return prev;
      const current = prev.matches.filter((m) => m.round === prev.round);
      const anyResolved = current.some((m) => m.bId && m.winnerId);
      if (anyResolved) return prev;
      const swap = (id: string) =>
        id === teamIdA ? teamIdB : id === teamIdB ? teamIdA : id;
      const matches = prev.matches.map((m) => {
        if (m.round !== prev.round) return m;
        const aId = swap(m.aId);
        const bId = m.bId ? swap(m.bId) : null;
        return { ...m, aId, bId, winnerId: bId ? null : aId };
      });
      return persist({ ...prev, matches });
    });
  }, []);

  const setMatchMethod = useCallback(
    (matchId: string, method: "tap" | "points" | null) => {
      setState((prev) =>
        persist({
          ...prev,
          matches: prev.matches.map((m) =>
            m.id === matchId ? { ...m, method } : m
          ),
        })
      );
    },
    []
  );

  const applyResolution = (
    prev: TournamentState,
    matchId: string,
    winnerId: string,
    method?: "tap" | "points"
  ): TournamentState => {
    const m = prev.matches.find((x) => x.id === matchId);
    if (!m || m.winnerId || !m.bId) return prev;
    const loserId = winnerId === m.aId ? m.bId : m.aId;
    const teams = prev.teams.map((t) => {
      if (t.id === loserId) {
        const lives = Math.max(0, t.lives - 1);
        return { ...t, lives, eliminated: lives <= 0 };
      }
      return t;
    });
    const matches = prev.matches.map((x) =>
      x.id === matchId ? { ...x, winnerId, method: method ?? x.method } : x
    );
    const survivors = teams.filter((t) => !t.eliminated);
    const championId = survivors.length === 1 ? survivors[0].id : prev.championId;
    return { ...prev, teams, matches, championId };
  };

  const resolveMatch = useCallback((matchId: string, winnerId: string) => {
    setState((prev) => persist(applyResolution(prev, matchId, winnerId, "tap")));
  }, []);

  const addMatchPoints = useCallback(
    (matchId: string, side: "a" | "b", points: number) => {
      setState((prev) => {
        const m = prev.matches.find((x) => x.id === matchId);
        if (!m || m.winnerId) return prev;
        const scoreA = side === "a" ? Math.max(0, m.scoreA + points) : m.scoreA;
        const scoreB = side === "b" ? Math.max(0, m.scoreB + points) : m.scoreB;
        let next: TournamentState = {
          ...prev,
          matches: prev.matches.map((x) =>
            x.id === matchId ? { ...x, scoreA, scoreB, method: "points" } : x
          ),
        };
        if (scoreA >= prev.target) next = applyResolution(next, matchId, m.aId, "points");
        else if (scoreB >= prev.target) next = applyResolution(next, matchId, m.bId!, "points");
        return persist(next);
      });
    },
    []
  );

  const undoMatch = useCallback((matchId: string) => {
    setState((prev) => {
      const m = prev.matches.find((x) => x.id === matchId);
      if (!m || !m.winnerId || !m.bId) return prev;
      const loserId = m.winnerId === m.aId ? m.bId : m.aId;
      const teams = prev.teams.map((t) => {
        if (t.id === loserId) {
          const lives = Math.min(prev.lives, t.lives + 1);
          return { ...t, lives, eliminated: false };
        }
        return t;
      });
      const matches = prev.matches.map((x) =>
        x.id === matchId
          ? { ...x, winnerId: null, scoreA: 0, scoreB: 0, method: null }
          : x
      );
      const survivors = teams.filter((t) => !t.eliminated);
      const championId = survivors.length === 1 ? survivors[0].id : null;
      return persist({ ...prev, teams, matches, championId });
    });
  }, []);

  const nextRound = useCallback(() => {
    setState((prev) => {
      if (!prev.started || prev.championId) return prev;
      const current = prev.matches.filter((m) => m.round === prev.round);
      const complete = current.length > 0 && current.every((m) => m.winnerId !== null);
      if (!complete) return prev;
      const survivors = prev.teams.filter((t) => !t.eliminated);
      if (survivors.length <= 1) {
        return persist({ ...prev, championId: survivors[0]?.id ?? null });
      }
      const round = prev.round + 1;
      const matches = generateMatches(survivors, round, prevRoundPairs(prev));
      return persist({ ...prev, round, matches: [...prev.matches, ...matches] });
    });
  }, []);

  const resetTournament = useCallback(() => {
    setState((prev) =>
      persist({
        ...prev,
        started: false,
        round: 0,
        matches: [],
        championId: null,
        teams: prev.teams.map((t) => ({
          ...t,
          lives: prev.lives,
          eliminated: false,
        })),
      })
    );
  }, []);

  if (!loaded) return null;

  const currentMatches = state.matches.filter((m) => m.round === state.round);
  const survivors = state.teams.filter((t) => !t.eliminated);
  const roundComplete =
    state.started &&
    currentMatches.length > 0 &&
    currentMatches.every((m) => m.winnerId !== null);
  const getTeam = (id: string | null) =>
    id ? state.teams.find((t) => t.id === id) : undefined;

  return (
    <TournamentContext.Provider
      value={{
        ...state,
        currentMatches,
        survivors,
        roundComplete,
        getTeam,
        setActive,
        toggleActive,
        setLives,
        setMatchTarget,
        setTeamCount,
        setTeamName,
        setTeamPlayer,
        setTeamColor,
        startTournament,
        regenerateRound,
        swapTeamSlots,
        setMatchMethod,
        addMatchPoints,
        resolveMatch,
        undoMatch,
        nextRound,
        resetTournament,
      }}
    >
      {children}
    </TournamentContext.Provider>
  );
}

export function useTournament() {
  const ctx = useContext(TournamentContext);
  if (!ctx) throw new Error("useTournament must be used within TournamentProvider");
  return ctx;
}

export { MIN_TEAMS, MAX_TEAMS };
