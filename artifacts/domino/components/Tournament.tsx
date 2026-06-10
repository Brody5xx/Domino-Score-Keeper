import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { translatePlayerName, translateTeamName } from "@/constants/translations";
import { PLAYER_COLORS } from "@/context/GameContext";
import { MAX_TEAMS, MIN_TEAMS, useTournament } from "@/context/TournamentContext";
import { useLang } from "@/context/LangContext";
import { useColors } from "@/hooks/useColors";

const POINT_CHIPS = [5, 10, 15, 25];

export default function Tournament() {
  const colors = useColors();
  const { t, lang } = useLang();
  const tourney = useTournament();
  const styles = makeStyles(colors);

  if (!tourney.started) return <Setup />;
  return <Board />;
}

// ── Setup ──────────────────────────────────────────────────────────────────
function Setup() {
  const colors = useColors();
  const { t, lang } = useLang();
  const {
    teams,
    lives,
    target,
    setLives,
    setMatchTarget,
    setTeamName,
    setTeamPlayer,
    setTeamColor,
    addTeamGroup,
    removeTeam,
    clearTeams,
    startFeasible,
    startTournament,
  } = useTournament();
  const styles = makeStyles(colors);
  const [targetInput, setTargetInput] = useState(String(target));
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState(PLAYER_COLORS[0]);
  const [groupPairs, setGroupPairs] = useState(1);
  const groupRoom = MAX_TEAMS - teams.length;

  const handleAddGroup = () => {
    const n = Math.min(groupPairs, groupRoom);
    if (n <= 0) return;
    addTeamGroup(groupName, groupColor, n);
    setGroupName("");
    setGroupPairs(1);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.setupContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.setupTitle}>{t.tournamentSetup}</Text>

      {/* Team names + pairs per team (club) */}
      <Text style={styles.fieldLabel}>{t.groupTitle}</Text>
      <View style={styles.groupCard}>
        <TextInput
          style={styles.groupNameInput}
          value={groupName}
          onChangeText={setGroupName}
          placeholder={t.teamNamePlaceholder}
          placeholderTextColor={colors.mutedForeground}
          maxLength={24}
        />
        <View style={styles.colorRow}>
          {PLAYER_COLORS.map((c) => {
            const active = groupColor === c;
            return (
              <Pressable
                key={c}
                style={[styles.colorSwatch, { backgroundColor: c }, active && styles.colorSwatchActive]}
                onPress={() => { setGroupColor(c); Haptics.selectionAsync(); }}
              >
                {active && <Feather name="check" size={12} color="#fff" />}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.groupPairsRow}>
          <Text style={styles.groupPairsLabel}>{t.groupPairs}</Text>
          <View style={styles.stepperRow}>
            <Pressable
              style={[styles.stepperBtn, groupPairs <= 1 && styles.stepperBtnDisabled]}
              onPress={() => { setGroupPairs((p) => Math.max(1, p - 1)); Haptics.selectionAsync(); }}
              disabled={groupPairs <= 1}
            >
              <Feather name="minus" size={20} color={groupPairs <= 1 ? colors.mutedForeground : colors.foreground} />
            </Pressable>
            <TextInput
              style={[styles.stepperInput, styles.groupPairsInput]}
              value={String(groupPairs)}
              onChangeText={(v) => {
                const clean = v.replace(/[^0-9]/g, "");
                setGroupPairs(clean ? Math.max(1, Math.min(100, Number(clean))) : 1);
              }}
              keyboardType="number-pad"
              maxLength={3}
              selectTextOnFocus
            />
            <Pressable
              style={[styles.stepperBtn, groupPairs >= 100 && styles.stepperBtnDisabled]}
              onPress={() => { setGroupPairs((p) => Math.min(100, p + 1)); Haptics.selectionAsync(); }}
              disabled={groupPairs >= 100}
            >
              <Feather name="plus" size={20} color={groupPairs >= 100 ? colors.mutedForeground : colors.foreground} />
            </Pressable>
          </View>
        </View>
        <Pressable
          style={[styles.addGroupBtn, groupRoom <= 0 && styles.addGroupBtnDisabled]}
          onPress={handleAddGroup}
          disabled={groupRoom <= 0}
        >
          <Feather name="plus-circle" size={16} color={colors.primaryForeground} />
          <Text style={styles.addGroupText}>
            {groupRoom <= 0 ? t.groupFull : t.addGroup(Math.min(groupPairs, groupRoom))}
          </Text>
        </Pressable>
      </View>

      {/* Lives */}
      <Text style={styles.fieldLabel}>{t.livesCount}</Text>
      <View style={styles.chipWrap}>
        {Array.from({ length: 10 }).map((_, i) => {
          const n = i + 1;
          const active = lives === n;
          return (
            <Pressable
              key={n}
              style={[styles.numChip, active && styles.numChipActive]}
              onPress={() => { setLives(n); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.numChipText, active && styles.numChipTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Match target */}
      <Text style={styles.fieldLabel}>{t.matchTarget}</Text>
      <View style={styles.chipWrap}>
        {[100, 200].map((n) => {
          const active = target === n;
          return (
            <Pressable
              key={n}
              style={[styles.numChip, active && styles.numChipActive]}
              onPress={() => { setMatchTarget(n); setTargetInput(String(n)); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.numChipText, active && styles.numChipTextActive]}>{n}</Text>
            </Pressable>
          );
        })}
        <TextInput
          style={styles.targetInput}
          value={targetInput}
          onChangeText={(v) => {
            const clean = v.replace(/[^0-9]/g, "");
            setTargetInput(clean);
            if (clean) setMatchTarget(Number(clean));
          }}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>

      {/* Teams */}
      <View style={styles.teamsHeaderRow}>
        <Text style={[styles.fieldLabel, { marginTop: 8, marginBottom: 0 }]}>
          {`${t.tournament} (${teams.length})`}
        </Text>
        {teams.length > 0 && (
          <Pressable
            style={styles.clearAllBtn}
            onPress={() => { clearTeams(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); }}
          >
            <Feather name="trash-2" size={14} color={colors.destructive} />
            <Text style={styles.clearAllText}>{t.clearAllTeams}</Text>
          </Pressable>
        )}
      </View>
      {teams.map((team, idx) => (
        <View key={team.id} style={styles.teamSetupCard}>
          <View style={styles.teamSetupHeader}>
            <View style={[styles.teamDot, { backgroundColor: team.color }]} />
            <TextInput
              style={styles.teamNameInput}
              value={team.name}
              onChangeText={(v) => setTeamName(team.id, v)}
              placeholder={t.teamNamePlaceholder}
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={styles.teamPlayersRow}>
            <TextInput
              style={styles.playerInput}
              value={team.p1}
              onChangeText={(v) => setTeamPlayer(team.id, 1, v)}
              placeholder={translatePlayerName(`Jugador ${idx * 2 + 1}`, lang)}
              placeholderTextColor={colors.mutedForeground}
            />
            <TextInput
              style={styles.playerInput}
              value={team.p2}
              onChangeText={(v) => setTeamPlayer(team.id, 2, v)}
              placeholder={translatePlayerName(`Jugador ${idx * 2 + 2}`, lang)}
              placeholderTextColor={colors.mutedForeground}
            />
          </View>
          <View style={styles.colorRow}>
            {PLAYER_COLORS.map((c) => {
              const active = team.color === c;
              return (
                <Pressable
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    active && styles.colorSwatchActive,
                  ]}
                  onPress={() => { setTeamColor(team.id, c); Haptics.selectionAsync(); }}
                >
                  {active && <Feather name="check" size={12} color="#fff" />}
                </Pressable>
              );
            })}
          </View>
          <Pressable
            style={styles.removeTeamBtn}
            onPress={() => { removeTeam(team.id); Haptics.selectionAsync(); }}
          >
            <Feather name="trash-2" size={15} color={colors.destructive} />
            <Text style={styles.removeTeamText}>{t.removePair}</Text>
          </Pressable>
        </View>
      ))}

      {!startFeasible && teams.length >= MIN_TEAMS && (
        <Text style={styles.startWarning}>{t.startBlockedAllies}</Text>
      )}

      <Pressable
        style={[styles.startBtn, !startFeasible && styles.startBtnDisabled]}
        disabled={!startFeasible}
        onPress={() => { startTournament(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
      >
        <Feather name="play" size={18} color={colors.primaryForeground} />
        <Text style={styles.startBtnText}>{t.startTournament}</Text>
      </Pressable>
    </ScrollView>
  );
}

// ── Board ──────────────────────────────────────────────────────────────────
function Board() {
  const colors = useColors();
  const { t, lang } = useLang();
  const tourney = useTournament();
  const {
    lives,
    round,
    currentMatches,
    championId,
    getTeam,
    roundComplete,
    nextRound,
    regenerateRound,
    swapTeamSlots,
    resetTournament,
  } = tourney;
  const styles = makeStyles(colors);

  const [playId, setPlayId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [swapSel, setSwapSel] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [highlight, setHighlight] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const glow = useRef(new Animated.Value(0)).current;

  const resolvedCount = currentMatches.filter((m) => m.bId && m.winnerId).length;
  const playableCount = currentMatches.filter((m) => m.bId).length;
  const anyResolved = resolvedCount > 0;

  const champion = getTeam(championId);

  const runSearch = () => {
    const q = query.trim().toLowerCase();
    if (!q) return;
    let foundId: string | null = null;
    for (const m of currentMatches) {
      for (const id of [m.aId, m.bId]) {
        const team = getTeam(id);
        if (!team) continue;
        const fields = [
          translateTeamName(team.name, lang).toLowerCase(),
          team.name.toLowerCase(),
          team.p1.toLowerCase(),
          team.p2.toLowerCase(),
          translatePlayerName(team.p1, lang).toLowerCase(),
          translatePlayerName(team.p2, lang).toLowerCase(),
        ];
        if (fields.some((f) => f.includes(q))) { foundId = m.id; break; }
      }
      if (foundId) break;
    }
    if (!foundId) {
      setNotFound(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    setNotFound(false);
    const target = foundId;
    const doScroll = (attempt: number) => {
      const y = positions.current[target];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
        setHighlight(target);
        glow.stopAnimation();
        glow.setValue(0);
        Animated.sequence([
          Animated.timing(glow, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.35, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(glow, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.delay(600),
          Animated.timing(glow, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) setHighlight(null); });
        Haptics.selectionAsync();
      } else if (attempt < 3) {
        requestAnimationFrame(() => doScroll(attempt + 1));
      }
    };
    doScroll(0);
  };

  const onTeamPress = (teamId: string) => {
    if (!editing) return;
    if (!swapSel) { setSwapSel(teamId); Haptics.selectionAsync(); return; }
    if (swapSel === teamId) { setSwapSel(null); return; }
    swapTeamSlots(swapSel, teamId);
    setSwapSel(null);
    Haptics.selectionAsync();
  };

  const renderHearts = (team: { lives: number; color: string }) => (
    <View style={styles.heartsRow}>
      {Array.from({ length: lives }).map((_, i) => (
        <Feather
          key={i}
          name="heart"
          size={12}
          color={i < team.lives ? colors.destructive : colors.border}
        />
      ))}
    </View>
  );

  const renderTeamSide = (teamId: string, isWinner: boolean, isLoser: boolean) => {
    const team = getTeam(teamId);
    if (!team) return <View style={styles.teamSide} />;
    const selected = swapSel === teamId;
    return (
      <Pressable
        style={[
          styles.teamSide,
          isWinner && styles.teamSideWinner,
          editing && styles.teamSideEditable,
          selected && styles.teamSideSelected,
        ]}
        onPress={() => onTeamPress(teamId)}
        disabled={!editing}
      >
        <View style={[styles.teamDot, { backgroundColor: team.color }]} />
        <Text style={[styles.teamSideName, isLoser && styles.teamLoserText]} numberOfLines={1}>
          {translateTeamName(team.name, lang)}
        </Text>
        <Text style={styles.teamSidePlayers} numberOfLines={1}>
          {translatePlayerName(team.p1, lang)} · {translatePlayerName(team.p2, lang)}
        </Text>
        {renderHearts(team)}
        {isWinner ? (
          <View style={styles.winnerBadge}>
            <Feather name="check" size={11} color={colors.primaryForeground} />
          </View>
        ) : null}
      </Pressable>
    );
  };

  return (
    <View style={styles.flex}>
      {/* Header row */}
      <View style={styles.boardHeader}>
        <View>
          <Text style={styles.roundTitle}>{t.roundLabel(round)}</Text>
          <Text style={styles.roundProgress}>
            {t.roundProgress(resolvedCount, playableCount)}
          </Text>
        </View>
        <View style={styles.boardHeaderBtns}>
          {!anyResolved && !championId ? (
            <>
              <Pressable
                style={[styles.iconBtn, styles.backBtn]}
                onPress={() => { resetTournament(); Haptics.selectionAsync(); }}
              >
                <Feather name="arrow-left" size={16} color={colors.destructive} />
              </Pressable>
              <Pressable
                style={[styles.iconBtn, editing && styles.iconBtnActive]}
                onPress={() => { setEditing((e) => !e); setSwapSel(null); Haptics.selectionAsync(); }}
              >
                <Feather name={editing ? "check" : "shuffle"} size={16} color={editing ? colors.primary : colors.mutedForeground} />
              </Pressable>
              {!editing ? (
                <Pressable style={styles.iconBtn} onPress={() => { regenerateRound(); Haptics.selectionAsync(); }}>
                  <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </>
          ) : null}
        </View>
      </View>

      {editing ? <Text style={styles.swapHint}>{t.swapHint}</Text> : null}

      {/* Search */}
      <View style={[styles.searchBar, notFound && styles.searchBarError]}>
        <Pressable onPress={runSearch} hitSlop={8}>
          <Feather name="search" size={16} color={notFound ? colors.destructive : colors.mutedForeground} />
        </Pressable>
        <TextInput
          style={styles.searchInput}
          placeholder={t.tournamentSearchPlaceholder}
          placeholderTextColor={colors.mutedForeground}
          value={query}
          onChangeText={(v) => { setQuery(v); if (notFound) setNotFound(false); }}
          onSubmitEditing={runSearch}
          returnKeyType="search"
        />
        {query.length > 0 ? (
          <Pressable onPress={() => { setQuery(""); setNotFound(false); }} hitSlop={8}>
            <Feather name="x" size={16} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
      </View>
      {notFound ? <Text style={styles.searchNotFoundText}>{t.searchNotFound}</Text> : null}

      {/* Champion banner */}
      {champion ? (
        <View style={[styles.championCard, { borderColor: champion.color }]}>
          <Feather name="award" size={28} color={colors.primary} />
          <Text style={styles.championTitle}>{t.champion}</Text>
          <Text style={styles.championName}>{translateTeamName(champion.name, lang)}</Text>
          <Text style={styles.championPlayers}>
            {translatePlayerName(champion.p1, lang)} · {translatePlayerName(champion.p2, lang)}
          </Text>
          <Pressable
            style={styles.newTournamentBtn}
            onPress={() => { resetTournament(); Haptics.selectionAsync(); }}
          >
            <Feather name="rotate-ccw" size={16} color={colors.primaryForeground} />
            <Text style={styles.startBtnText}>{t.newTournament}</Text>
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.matchList}
        showsVerticalScrollIndicator={false}
      >
        {currentMatches.map((m, i) => {
          const isBye = !m.bId;
          const a = getTeam(m.aId);
          return (
            <View
              key={m.id}
              style={styles.matchCard}
              onLayout={(e) => { positions.current[m.id] = e.nativeEvent.layout.y; }}
            >
              {highlight === m.id ? (
                <Animated.View pointerEvents="none" style={[styles.matchGlow, { opacity: glow }]} />
              ) : null}
              {isBye ? (
                <View style={styles.byeRow}>
                  <View style={[styles.teamDot, { backgroundColor: a?.color ?? colors.primary }]} />
                  <View style={styles.flex}>
                    <Text style={styles.teamSideName} numberOfLines={1}>
                      {a ? translateTeamName(a.name, lang) : ""}
                    </Text>
                    {a && (a.p1.trim() || a.p2.trim()) ? (
                      <Text style={styles.byeRestText} numberOfLines={2}>
                        {t.byeRest(
                          [a.p1, a.p2]
                            .map((p) => translatePlayerName(p, lang))
                            .filter((p) => p.trim())
                            .join(lang === "en" ? " & " : " y ")
                        )}
                      </Text>
                    ) : null}
                    <Text style={styles.byeText}>{t.bye} · {t.byeAdvances}</Text>
                  </View>
                  <Feather name="fast-forward" size={18} color={colors.primary} />
                </View>
              ) : (
                <>
                  <View style={styles.matchRow}>
                    {renderTeamSide(m.aId, m.winnerId === m.aId, m.winnerId === m.bId)}
                    <View style={styles.vsCol}>
                      {m.method === "points" || m.scoreA > 0 || m.scoreB > 0 ? (
                        <Text style={styles.vsScore}>{m.scoreA}-{m.scoreB}</Text>
                      ) : (
                        <Text style={styles.vsText}>{t.vs}</Text>
                      )}
                    </View>
                    {renderTeamSide(m.bId!, m.winnerId === m.bId, m.winnerId === m.aId)}
                  </View>
                  {!editing ? (
                    <Pressable
                      style={[styles.playBtn, m.winnerId && styles.playBtnDone]}
                      onPress={() => { setPlayId(m.id); Haptics.selectionAsync(); }}
                    >
                      <Feather name={m.winnerId ? "edit-2" : "play"} size={14} color={m.winnerId ? colors.mutedForeground : colors.primaryForeground} />
                      <Text style={[styles.playBtnText, m.winnerId && styles.playBtnTextDone]}>
                        {m.winnerId ? t.winnerIs + ": " + translateTeamName(getTeam(m.winnerId)?.name ?? "", lang) : t.play}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              )}
            </View>
          );
        })}

        {roundComplete && !championId ? (
          <Pressable
            style={styles.nextRoundBtn}
            onPress={() => { nextRound(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
          >
            <Text style={styles.startBtnText}>{t.nextRound}</Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </Pressable>
        ) : null}
      </ScrollView>

      <PlayModal matchId={playId} onClose={() => setPlayId(null)} />
    </View>
  );
}

// ── Play modal ───────────────────────────────────────────────────────────────
function PlayModal({ matchId, onClose }: { matchId: string | null; onClose: () => void }) {
  const colors = useColors();
  const { t, lang } = useLang();
  const { currentMatches, target, getTeam, setMatchMethod, addMatchPoints, resolveMatch, undoMatch } = useTournament();
  const styles = makeStyles(colors);

  const match = matchId ? currentMatches.find((m) => m.id === matchId) : null;
  if (!match || !match.bId) {
    return <Modal visible={false} transparent />;
  }
  const a = getTeam(match.aId);
  const b = getTeam(match.bId);
  const resolved = match.winnerId !== null;

  return (
    <Modal visible={!!matchId} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t.playMatch}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Text style={styles.modalMatchup} numberOfLines={1}>
            {translateTeamName(a?.name ?? "", lang)} {t.vs} {translateTeamName(b?.name ?? "", lang)}
          </Text>

          {resolved ? (
            <View style={styles.resultBox}>
              <Feather name="award" size={26} color={colors.primary} />
              <Text style={styles.resultText}>
                {t.winnerIs}: {translateTeamName(getTeam(match.winnerId)?.name ?? "", lang)}
              </Text>
              <Pressable
                style={styles.undoBtn}
                onPress={() => { undoMatch(match.id); Haptics.selectionAsync(); }}
              >
                <Feather name="rotate-ccw" size={15} color={colors.foreground} />
                <Text style={styles.undoBtnText}>{t.undo}</Text>
              </Pressable>
            </View>
          ) : !match.method ? (
            <View style={styles.methodWrap}>
              <Text style={styles.methodPrompt}>{t.chooseMethod}</Text>
              <Pressable
                style={styles.methodBtn}
                onPress={() => { setMatchMethod(match.id, "tap"); Haptics.selectionAsync(); }}
              >
                <Feather name="check-circle" size={18} color={colors.primary} />
                <Text style={styles.methodBtnText}>{t.methodTap}</Text>
              </Pressable>
              <Pressable
                style={styles.methodBtn}
                onPress={() => { setMatchMethod(match.id, "points"); Haptics.selectionAsync(); }}
              >
                <Feather name="hash" size={18} color={colors.primary} />
                <Text style={styles.methodBtnText}>{t.methodPoints}</Text>
              </Pressable>
            </View>
          ) : match.method === "tap" ? (
            <View>
              <Text style={styles.methodPrompt}>{t.tapWinnerHint}</Text>
              <Pressable
                style={[styles.tapWinBtn, { borderColor: a?.color ?? colors.border }]}
                onPress={() => { resolveMatch(match.id, match.aId); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
              >
                <View style={[styles.teamDot, { backgroundColor: a?.color ?? colors.primary }]} />
                <View style={styles.flex}>
                  <Text style={styles.tapWinText}>{translateTeamName(a?.name ?? "", lang)}</Text>
                  {a && (a.p1.trim() || a.p2.trim()) ? (
                    <Text style={styles.tapWinPlayers} numberOfLines={1}>
                      {[a.p1, a.p2]
                        .map((p) => translatePlayerName(p, lang))
                        .filter((p) => p.trim())
                        .join(lang === "en" ? " & " : " y ")}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable
                style={[styles.tapWinBtn, { borderColor: b?.color ?? colors.border }]}
                onPress={() => { resolveMatch(match.id, match.bId!); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }}
              >
                <View style={[styles.teamDot, { backgroundColor: b?.color ?? colors.primary }]} />
                <View style={styles.flex}>
                  <Text style={styles.tapWinText}>{translateTeamName(b?.name ?? "", lang)}</Text>
                  {b && (b.p1.trim() || b.p2.trim()) ? (
                    <Text style={styles.tapWinPlayers} numberOfLines={1}>
                      {[b.p1, b.p2]
                        .map((p) => translatePlayerName(p, lang))
                        .filter((p) => p.trim())
                        .join(lang === "en" ? " & " : " y ")}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
              <Pressable style={styles.changeMethodBtn} onPress={() => setMatchMethod(match.id, null)}>
                <Text style={styles.changeMethodText}>{t.chooseMethod}</Text>
              </Pressable>
            </View>
          ) : (
            <View>
              <Text style={styles.methodPrompt}>{t.reachTarget(target)}</Text>
              {([
                { team: a, side: "a" as const, score: match.scoreA, id: match.aId },
                { team: b, side: "b" as const, score: match.scoreB, id: match.bId },
              ]).map(({ team, side, score }) => (
                <View key={side} style={styles.pointsTeamRow}>
                  <View style={styles.pointsTeamInfo}>
                    <View style={[styles.teamDot, { backgroundColor: team?.color ?? colors.primary }]} />
                    <Text style={styles.pointsTeamName} numberOfLines={1}>
                      {translateTeamName(team?.name ?? "", lang)}
                    </Text>
                    <Text style={styles.pointsScore}>{score}</Text>
                  </View>
                  <View style={styles.pointsChips}>
                    {POINT_CHIPS.map((p) => (
                      <Pressable
                        key={p}
                        style={styles.pointChip}
                        onPress={() => { addMatchPoints(match.id, side, p); Haptics.selectionAsync(); }}
                      >
                        <Text style={styles.pointChipText}>+{p}</Text>
                      </Pressable>
                    ))}
                    <Pressable
                      style={styles.pointChipMinus}
                      onPress={() => { addMatchPoints(match.id, side, -5); Haptics.selectionAsync(); }}
                    >
                      <Text style={styles.pointChipText}>−5</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
              <Pressable style={styles.changeMethodBtn} onPress={() => setMatchMethod(match.id, null)}>
                <Text style={styles.changeMethodText}>{t.chooseMethod}</Text>
              </Pressable>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(colors: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    flex: { flex: 1 },

    // Setup
    setupContent: { paddingHorizontal: 14, paddingBottom: 40, gap: 8 },
    setupTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 20,
      color: colors.foreground,
      marginTop: 4,
      marginBottom: 4,
    },
    fieldLabel: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 6,
    },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    stepperRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    stepperBtn: {
      width: 44,
      height: 44,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.primary,
      backgroundColor: colors.primary + "22",
      alignItems: "center",
      justifyContent: "center",
    },
    stepperBtnDisabled: {
      borderColor: colors.border,
      backgroundColor: "transparent",
    },
    stepperInput: {
      minWidth: 64,
      height: 44,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      fontSize: 18,
      textAlign: "center",
    },
    stepperHint: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground },
    groupCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      gap: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    groupNameInput: {
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 9,
      color: colors.foreground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
      borderWidth: 1,
      borderColor: colors.border,
    },
    groupPairsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    groupPairsInput: { minWidth: 0, width: 48, paddingHorizontal: 6 },
    groupPairsLabel: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground },
    addGroupBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
    },
    addGroupBtnDisabled: { opacity: 0.5 },
    addGroupText: { fontFamily: "Inter_700Bold", fontSize: 15, color: colors.primaryForeground },
    numChip: {
      minWidth: 40,
      height: 40,
      paddingHorizontal: 10,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.mutedForeground,
      alignItems: "center",
      justifyContent: "center",
    },
    numChipActive: {
      backgroundColor: colors.primary + "22",
      borderColor: colors.primary,
    },
    numChipText: { fontFamily: "Inter_700Bold", fontSize: 15, color: colors.foreground },
    numChipTextActive: { color: colors.primary },
    targetInput: {
      minWidth: 64,
      height: 40,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      fontSize: 15,
      textAlign: "center",
    },
    teamSetupCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 12,
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    teamsHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 8,
    },
    clearAllBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.destructive + "55",
    },
    clearAllText: { fontFamily: "Inter_600SemiBold", fontSize: 12, color: colors.destructive },
    removeTeamBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      alignSelf: "flex-start",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 9,
      backgroundColor: colors.destructive + "18",
    },
    removeTeamText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.destructive },
    teamSetupHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    teamDot: { width: 12, height: 12, borderRadius: 6 },
    teamNameInput: {
      flex: 1,
      fontFamily: "Inter_700Bold",
      fontSize: 16,
      color: colors.foreground,
      paddingVertical: 2,
    },
    teamPlayersRow: { flexDirection: "row", gap: 6, justifyContent: "flex-start" },
    playerInput: {
      flex: 1,
      maxWidth: 130,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 5,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    colorSwatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: "transparent",
    },
    colorSwatchActive: {
      borderColor: colors.foreground,
    },
    startBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      marginTop: 16,
    },
    startBtnDisabled: { opacity: 0.5 },
    startBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: colors.primaryForeground },
    startWarning: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: colors.destructive,
      textAlign: "center",
      marginTop: 12,
      lineHeight: 18,
    },

    // Board
    boardHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      marginBottom: 6,
    },
    roundTitle: { fontFamily: "Inter_700Bold", fontSize: 20, color: colors.foreground },
    roundProgress: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    boardHeaderBtns: { flexDirection: "row", gap: 8 },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    iconBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary + "1A" },
    backBtn: { borderColor: colors.destructive, backgroundColor: colors.destructive + "1A" },
    swapHint: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: colors.primary,
      paddingHorizontal: 14,
      marginBottom: 4,
    },

    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 9,
      marginHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchBarError: { borderColor: colors.destructive },
    searchInput: { flex: 1, color: colors.foreground, fontFamily: "Inter_500Medium", fontSize: 15, padding: 0 },
    searchNotFoundText: {
      color: colors.destructive,
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      paddingHorizontal: 16,
      marginTop: 4,
    },

    matchList: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 40, gap: 12 },
    matchCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    matchGlow: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 16,
      borderWidth: 2,
      borderColor: colors.primary,
      backgroundColor: colors.primary + "1A",
      shadowColor: colors.primary,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.9,
      shadowRadius: 16,
      elevation: 12,
    },
    matchRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
    teamSide: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 12,
      padding: 10,
      gap: 5,
      borderWidth: 1.5,
      borderColor: "transparent",
    },
    teamSideWinner: { borderColor: colors.primary, backgroundColor: colors.primary + "14" },
    teamSideEditable: { borderColor: colors.border, borderStyle: "dashed" },
    teamSideSelected: { borderColor: colors.primary, borderStyle: "solid" },
    teamSideName: { fontFamily: "Inter_700Bold", fontSize: 15, color: colors.foreground },
    teamSidePlayers: { fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground },
    teamLoserText: { textDecorationLine: "line-through", color: colors.mutedForeground },
    heartsRow: { flexDirection: "row", gap: 3, marginTop: 2 },
    winnerBadge: {
      position: "absolute",
      top: 8,
      right: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.primary,
      alignItems: "center",
      justifyContent: "center",
    },
    vsCol: { width: 40, alignItems: "center", justifyContent: "center" },
    vsText: { fontFamily: "Inter_700Bold", fontSize: 13, color: colors.mutedForeground },
    vsScore: { fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground },

    byeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    byeRestText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: colors.foreground, marginTop: 2 },
    byeText: { fontFamily: "Inter_500Medium", fontSize: 12, color: colors.mutedForeground, marginTop: 2 },

    playBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 11,
    },
    playBtnDone: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
    playBtnText: { fontFamily: "Inter_700Bold", fontSize: 14, color: colors.primaryForeground },
    playBtnTextDone: { color: colors.mutedForeground },

    nextRoundBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      marginTop: 4,
    },

    championCard: {
      alignItems: "center",
      gap: 4,
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 2,
      padding: 18,
      marginHorizontal: 14,
      marginBottom: 4,
    },
    championTitle: { fontFamily: "Inter_700Bold", fontSize: 22, color: colors.primary },
    championName: { fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground },
    championPlayers: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground, marginBottom: 8 },
    newTournamentBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 12,
      paddingHorizontal: 20,
    },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.6)",
      justifyContent: "center",
      paddingHorizontal: 20,
    },
    modalCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      gap: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    modalTitle: { fontFamily: "Inter_700Bold", fontSize: 18, color: colors.foreground },
    modalMatchup: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: colors.mutedForeground, textAlign: "center" },
    methodWrap: { gap: 10 },
    methodPrompt: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground, textAlign: "center", marginBottom: 4 },
    methodBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 10,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingVertical: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    methodBtnText: { fontFamily: "Inter_700Bold", fontSize: 16, color: colors.foreground },
    tapWinBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingVertical: 16,
      paddingHorizontal: 16,
      borderWidth: 2,
      marginBottom: 10,
    },
    tapWinText: { fontFamily: "Inter_700Bold", fontSize: 17, color: colors.foreground },
    tapWinPlayers: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
    changeMethodBtn: { alignItems: "center", paddingVertical: 8, marginTop: 4 },
    changeMethodText: { fontFamily: "Inter_500Medium", fontSize: 13, color: colors.mutedForeground },

    resultBox: { alignItems: "center", gap: 10, paddingVertical: 10 },
    resultText: { fontFamily: "Inter_700Bold", fontSize: 17, color: colors.foreground, textAlign: "center" },
    undoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingVertical: 10,
      paddingHorizontal: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    undoBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 14, color: colors.foreground },

    pointsTeamRow: { gap: 8, marginBottom: 14 },
    pointsTeamInfo: { flexDirection: "row", alignItems: "center", gap: 8 },
    pointsTeamName: { flex: 1, fontFamily: "Inter_700Bold", fontSize: 15, color: colors.foreground },
    pointsScore: { fontFamily: "Inter_700Bold", fontSize: 20, color: colors.primary, minWidth: 40, textAlign: "right" },
    pointsChips: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
    pointChip: {
      flex: 1,
      minWidth: 48,
      backgroundColor: colors.primary + "1A",
      borderRadius: 10,
      paddingVertical: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.primary,
    },
    pointChipMinus: {
      minWidth: 48,
      backgroundColor: colors.background,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 10,
      alignItems: "center",
      borderWidth: 1,
      borderColor: colors.border,
    },
    pointChipText: { fontFamily: "Inter_700Bold", fontSize: 14, color: colors.foreground },
  });
}
