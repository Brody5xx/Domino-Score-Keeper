import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Tournament from "@/components/Tournament";
import { PLAYER_COLORS, type PreviousGame, computeTotals, useGame } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useTournament } from "@/context/TournamentContext";
import { translatePlayerName } from "@/constants/translations";
import { useColors } from "@/hooks/useColors";
import DominoBackground from "@/components/DominoBackground";

const TARGET_PRESETS = [100, 200];

const BG_THEMES = [
  { id: "scatter",  icon: "shuffle"    as const, labelKey: "bgScatter"  as const },
  { id: "diagonal", icon: "trending-up" as const, labelKey: "bgDiagonal" as const },
  { id: "grid",     icon: "grid"       as const, labelKey: "bgGrid"     as const },
  { id: "radial",   icon: "disc"       as const, labelKey: "bgRadial"   as const },
  { id: "giant",    icon: "maximize-2" as const, labelKey: "bgGiant"    as const },
];

type AddModalState = { playerId: string } | null;
type EditModalState = { entryId: string; currentPoints: number } | null;

export default function MainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang } = useLang();
  const {
    players,
    entries,
    target,
    totals,
    previousGames,
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
    mesas,
    restart,
    deletePreviousGame,
    clearPreviousGames,
    bgTheme,
    setBgTheme,
    customBgUri,
    setCustomBgUri,
  } = useGame();

  const { active: tournamentActive, toggleActive: toggleTournament } = useTournament();

  const [addModal, setAddModal] = useState<AddModalState>(null);
  const [pointsInput, setPointsInput] = useState("");
  const [extraMode, setExtraMode] = useState(false);
  const [forBoth, setForBoth] = useState(false);

  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [editInput, setEditInput] = useState("");

  const [customModal, setCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [photoDenied, setPhotoDenied] = useState(false);

  const [settingsModal, setSettingsModal] = useState(false);
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);

  const [renameModal, setRenameModal] = useState<{ playerId: string; value: string; color: string } | null>(null);
  const [restartModal, setRestartModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [deleteGameModal, setDeleteGameModal] = useState<string | null>(null);
  const [clearHistoryModal, setClearHistoryModal] = useState(false);

  const [mesaSearch, setMesaSearch] = useState("");
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [highlightedMesa, setHighlightedMesa] = useState<number | null>(null);
  const [revealedEntry, setRevealedEntry] = useState<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mesaPositions = useRef<Record<number, number>>({});
  const highlightAnim = useRef(new Animated.Value(0)).current;

  const findMesaForQuery = (query: string): number => {
    const q = query.trim().toLowerCase();
    if (!q || mesas <= 0) return -1;
    const mesaMatch = q.match(/^(?:mesa|table)?\s*(\d+)$/);
    if (mesaMatch) {
      const n = parseInt(mesaMatch[1], 10);
      if (n >= 1 && n <= mesas) return n - 1;
      return -1;
    }
    for (let i = 0; i < mesas; i++) {
      const group = [players[i * 2], players[i * 2 + 1]];
      for (const p of group) {
        if (!p) continue;
        const display = translatePlayerName(p.name, lang).toLowerCase();
        if (display.includes(q) || p.name.toLowerCase().includes(q)) return i;
      }
    }
    return -1;
  };

  const runMesaSearch = () => {
    const idx = findMesaForQuery(mesaSearch);
    if (idx < 0) {
      setSearchNotFound(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    const scrollToIdx = (attempt: number) => {
      const y = mesaPositions.current[idx];
      if (y !== undefined) {
        scrollRef.current?.scrollTo({ y: Math.max(0, y - 8), animated: true });
        setSearchNotFound(false);
        setHighlightedMesa(idx);
        highlightAnim.stopAnimation();
        highlightAnim.setValue(0);
        Animated.sequence([
          Animated.timing(highlightAnim, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(highlightAnim, { toValue: 0.35, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(highlightAnim, { toValue: 1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.delay(600),
          Animated.timing(highlightAnim, { toValue: 0, duration: 700, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) setHighlightedMesa(null); });
        Haptics.selectionAsync();
      } else if (attempt < 3) {
        requestAnimationFrame(() => scrollToIdx(attempt + 1));
      } else {
        setSearchNotFound(true);
      }
    };
    scrollToIdx(0);
  };

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : insets.bottom;

  const locale = lang === "es" ? "es-419" : "en-US";

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString(locale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  const CUSTOM_BG_FILE = "domino-custom-bg";

  // Copy the picked image into app-scoped storage so it survives restarts
  // (picker URIs are temporary on iOS/Android). Web keeps the URI as-is.
  async function persistPickedImage(uri: string): Promise<string> {
    if (Platform.OS === "web") return uri;
    try {
      const dest = new File(Paths.document, CUSTOM_BG_FILE);
      if (dest.exists) dest.delete();
      new File(uri).copy(dest);
      return dest.uri;
    } catch {
      return uri;
    }
  }

  function deletePersistedImage() {
    if (Platform.OS === "web") return;
    try {
      const f = new File(Paths.document, CUSTOM_BG_FILE);
      if (f.exists) f.delete();
    } catch {}
  }

  async function handlePickBackgroundPhoto() {
    if (Platform.OS !== "web") {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        setPhotoDenied(true);
        return;
      }
    }
    setPhotoDenied(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      const persisted = await persistPickedImage(result.assets[0].uri);
      setCustomBgUri(persisted);
      Haptics.selectionAsync();
    }
  }

  function handleRemoveBackgroundPhoto() {
    deletePersistedImage();
    setCustomBgUri(null);
    setPhotoDenied(false);
    Haptics.selectionAsync();
  }

  function handleAddPoints() {
    const pts = parseInt(pointsInput, 10);
    if (addModal && !isNaN(pts) && pts >= 0) {
      const isTie = pts === 0;
      const useExtra = isTie ? false : extraMode;
      addEntry(addModal.playerId, pts, useExtra, isTie);
      if (forBoth) {
        const partner = getPartner(addModal.playerId);
        if (partner) addEntry(partner.id, pts, useExtra, isTie);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    closeAddModal();
  }

  function getPartner(playerId: string) {
    const idx = players.findIndex((p) => p.id === playerId);
    if (idx < 0) return null;
    const partnerIdx = idx % 2 === 0 ? idx + 1 : idx - 1;
    return players[partnerIdx] ?? null;
  }

  function handleTie() {
    if (addModal) {
      addEntry(addModal.playerId, 0, false, true);
      if (forBoth) {
        const partner = getPartner(addModal.playerId);
        if (partner) addEntry(partner.id, 0, false, true);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    closeAddModal();
  }

  function closeAddModal() {
    setAddModal(null);
    setPointsInput("");
    setExtraMode(false);
    setForBoth(false);
  }

  function handleEditPoints() {
    const pts = parseInt(editInput, 10);
    if (!isNaN(pts) && pts >= 0 && editModal) {
      editEntry(editModal.entryId, pts);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditModal(null);
    setEditInput("");
  }

  function handleSetCustomTarget() {
    const tv = parseInt(customInput, 10);
    if (!isNaN(tv) && tv > 0) setTarget(tv);
    setCustomModal(false);
    setCustomInput("");
  }

  function confirmRestart() {
    restart();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setRestartModal(false);
  }

  function confirmClearHistory() {
    clearPreviousGames();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setExpandedGame(null);
    setClearHistoryModal(false);
    setHistoryModal(false);
  }

  function confirmDeleteGame() {
    if (deleteGameModal) {
      deletePreviousGame(deleteGameModal);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setDeleteGameModal(null);
  }

  function savePlayerName() {
    if (editingName && editingName.value.trim()) {
      setPlayerName(editingName.id, editingName.value.trim());
    }
    setEditingName(null);
  }

  function confirmRename() {
    if (renameModal) {
      const trimmed = renameModal.value.trim();
      if (trimmed) {
        setPlayerName(renameModal.playerId, trimmed);
      } else {
        const idx = players.findIndex((p) => p.id === renameModal.playerId);
        const fallback = idx === 0 ? "Casa" : idx === 1 ? "Visitante" : `Jugador ${idx + 1}`;
        setPlayerName(renameModal.playerId, fallback);
      }
      const original = players.find((p) => p.id === renameModal.playerId);
      if (original && original.color !== renameModal.color) {
        setPlayerColor(renameModal.playerId, renameModal.color);
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setRenameModal(null);
  }

  // ── render ─────────────────────────────────────────────────────────────────

  function renderPlayerCard(player: (typeof players)[number], fullWidth = false) {
    const total = totals[player.id] ?? 0;
    const remaining = Math.max(0, target - total);
    const won = total >= target;
    const playerEntries = entries.filter((e) => e.playerId === player.id);
    return (
      <View
        key={player.id}
        style={[
          styles.playerCard,
          { borderColor: player.color },
          fullWidth && { width: "100%" },
        ]}
      >
        <Pressable
          style={[styles.playerHeader, { backgroundColor: player.color + "26" }]}
          onPress={() => setRenameModal({ playerId: player.id, value: translatePlayerName(player.name, lang), color: player.color })}
        >
          <Text style={[styles.playerName, { color: player.color }]} numberOfLines={1}>
            {translatePlayerName(player.name, lang)}
          </Text>
          <Feather name="edit-2" size={11} color={player.color} style={{ opacity: 0.6 }} />
          {won && (
            <View style={[styles.winBadge, { backgroundColor: player.color }]}>
              <Text style={styles.winBadgeText}>{t.won}</Text>
            </View>
          )}
        </Pressable>
        <Text style={[styles.scoreText, { color: won ? player.color : colors.foreground }]}>
          {total}
        </Text>
        <Text style={styles.remainingText}>
          {won ? t.victory : t.remaining(remaining)}
        </Text>
        <Pressable
          style={[styles.addBtn, { borderColor: player.color }]}
          onPress={() => { setAddModal({ playerId: player.id }); setPointsInput(""); setExtraMode(false); setForBoth(false); }}
        >
          <Feather name="plus" size={20} color={player.color} />
        </Pressable>

        {playerEntries.length > 0 && (
          <View style={styles.cardHistory}>
            {playerEntries.slice().reverse().map((entry, idx) => {
              const num = playerEntries.length - idx;
              return (
                <View key={entry.id} style={styles.cardEntryRow}>
                  <View style={[styles.cardEntryLeft, { flexWrap: "wrap", alignItems: "center" }]}>
                    <Text style={styles.cardEntryNum}>{num}</Text>
                    {entry.extra ? (
                      <View style={styles.extraBadge}>
                        <Text style={styles.extraBadgeText}>{t.extraLabel}</Text>
                      </View>
                    ) : null}
                    {(entry.tie || entry.points === 0) ? (
                      <View style={styles.tieBadge}>
                        <Text style={styles.tieBadgeText}>{t.tieLabel}</Text>
                      </View>
                    ) : null}
                    {entry.edited ? (
                      <Pressable
                        style={styles.editedBadge}
                        onPress={() => {
                          if (revealTimerRef.current) {
                            clearTimeout(revealTimerRef.current);
                            revealTimerRef.current = null;
                          }
                          if (revealedEntry === entry.id) {
                            setRevealedEntry(null);
                          } else {
                            setRevealedEntry(entry.id);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            revealTimerRef.current = setTimeout(() => {
                              setRevealedEntry(null);
                              revealTimerRef.current = null;
                            }, 10000);
                          }
                        }}
                        hitSlop={4}
                      >
                        <Feather name="eye" size={10} color={colors.mutedForeground} />
                        <Text style={styles.editedBadgeText}>{t.edited}</Text>
                      </Pressable>
                    ) : null}
                    <Text style={[styles.cardEntryPoints, { color: player.color }, entry.deleted && styles.deletedPoints]}>
                      +{revealedEntry === entry.id && entry.originalPoints !== undefined ? entry.originalPoints : entry.points}
                    </Text>
                  </View>
                  <View style={styles.cardEntryRight}>
                    <Pressable
                      style={styles.entryActionBtn}
                      onPress={() => { setEditModal({ entryId: entry.id, currentPoints: entry.points }); setEditInput(String(entry.points)); }}
                      hitSlop={6}
                    >
                      <Feather name="edit-2" size={13} color={colors.mutedForeground} />
                    </Pressable>
                    <Pressable
                      style={styles.entryActionBtn}
                      onPress={() => { deleteEntry(entry.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                      hitSlop={6}
                    >
                      <Feather name={entry.deleted ? "rotate-ccw" : "trash-2"} size={13} color={entry.deleted ? colors.mutedForeground : colors.destructive} />
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      <DominoBackground />

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        {tournamentActive ? (
          <View style={styles.tournamentTitleRow}>
            <FontAwesome5 name="trophy" size={18} color={colors.primary} />
            <Text style={styles.tournamentTitle}>{t.tournamentMode}</Text>
          </View>
        ) : (
          <View style={styles.targetRow}>
            {TARGET_PRESETS.map((tv) => (
              <Pressable
                key={tv}
                style={[styles.targetChip, target === tv && styles.targetChipActive]}
                onPress={() => { setTarget(tv); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.targetChipText, target === tv && styles.targetChipTextActive]}>
                  {tv}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[styles.targetChip, !TARGET_PRESETS.includes(target) && styles.targetChipActive]}
              onPress={() => {
                setCustomModal(true);
                setCustomInput(!TARGET_PRESETS.includes(target) ? String(target) : "");
              }}
            >
              <Text style={[styles.targetChipText, !TARGET_PRESETS.includes(target) && styles.targetChipTextActive]}>
                {!TARGET_PRESETS.includes(target) ? String(target) : "..."}
              </Text>
            </Pressable>
          </View>
        )}
        <View style={styles.topBarBtns}>
          <View style={styles.tournamentToggle}>
            <Text style={styles.tournamentHintText}>{t.tournamentShort}</Text>
            <Pressable
              style={[styles.settingsBtn, tournamentActive && styles.settingsBtnActive]}
              onPress={() => { toggleTournament(); Haptics.selectionAsync(); }}
            >
              <FontAwesome5 name="trophy" size={18} color={tournamentActive ? colors.primary : colors.mutedForeground} />
            </Pressable>
          </View>
          <Pressable style={styles.settingsBtn} onPress={() => setSettingsModal(true)}>
            <Feather name="settings" size={20} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {tournamentActive ? <Tournament /> : (
      <>
      {/* ── Mesa search + grid ── */}

      {/* ── Mesa search bar ── */}
      {mesas > 0 && (
        <View style={[styles.searchBar, searchNotFound && styles.searchBarError]}>
          <Pressable onPress={runMesaSearch} hitSlop={8}>
            <Feather name="search" size={16} color={searchNotFound ? colors.destructive : colors.mutedForeground} />
          </Pressable>
          <TextInput
            style={styles.searchInput}
            placeholder={t.searchPlaceholder}
            placeholderTextColor={colors.mutedForeground}
            value={mesaSearch}
            onChangeText={(v) => { setMesaSearch(v); if (searchNotFound) setSearchNotFound(false); }}
            onSubmitEditing={runMesaSearch}
            returnKeyType="search"
          />
          {mesaSearch.length > 0 ? (
            <Pressable onPress={() => { setMesaSearch(""); setSearchNotFound(false); }} hitSlop={8}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          ) : null}
        </View>
      )}
      {mesas > 0 && searchNotFound ? (
        <Text style={styles.searchNotFoundText}>{t.searchNotFound}</Text>
      ) : null}

      {/* ── Player grid ── */}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        style={styles.playerScroll}
        contentContainerStyle={mesas > 0 ? styles.mesaContainer : styles.playerGrid}
      >
        {mesas > 0
          ? Array.from({ length: mesas }).map((_, i) => {
              const a = players[i * 2];
              const b = players[i * 2 + 1];
              return (
                <View
                  key={"mesa-" + i}
                  style={styles.mesaGroup}
                  onLayout={(e) => { mesaPositions.current[i] = e.nativeEvent.layout.y; }}
                >
                  {highlightedMesa === i ? (
                    <Animated.View pointerEvents="none" style={[styles.mesaGlow, { opacity: highlightAnim }]} />
                  ) : null}
                  <Text style={styles.mesaLabel}>{t.mesaLabel(i + 1)}</Text>
                  <View style={styles.mesaRow}>
                    {a && renderPlayerCard(a)}
                    {b && renderPlayerCard(b)}
                  </View>
                </View>
              );
            })
          : players.map((player) => renderPlayerCard(player, players.length === 1))}
        <View style={styles.addBoxRow}>
          {mesas === 0 && (
            <View style={[styles.stepperBox, { borderColor: colors.border }]}>
              <Pressable
                disabled={players.length <= 2}
                style={[styles.stepperSide, players.length <= 2 && styles.stepperDisabled]}
                onPress={() => {
                  if (players.length > 2) removePlayer(players[players.length - 1].id);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <Feather name="minus" size={18} color={colors.destructive} />
              </Pressable>
              <View style={styles.stepperCenter}>
                <Text numberOfLines={1} style={[styles.stepperWord, { color: colors.mutedForeground }]}>{t.playerSingular}</Text>
                <Text style={[styles.stepperLabel, { color: colors.foreground }]}>{players.length}/8</Text>
              </View>
              <Pressable
                disabled={players.length >= 8}
                style={[styles.stepperSide, players.length >= 8 && styles.stepperDisabled]}
                onPress={() => { addPlayer(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Feather name="plus" size={18} color={colors.primary} />
              </Pressable>
            </View>
          )}
          <View style={[styles.stepperBox, { borderColor: colors.border }]}>
            <Pressable
              disabled={mesas <= 0}
              style={[styles.stepperSide, mesas <= 0 && styles.stepperDisabled]}
              onPress={() => { setMesas(mesas <= 2 ? 0 : mesas - 1); Haptics.selectionAsync(); }}
            >
              <Feather name="minus" size={18} color={colors.destructive} />
            </Pressable>
            <View style={styles.stepperCenter}>
              <Text style={[styles.stepperLabel, { color: colors.foreground }]}>{mesas}</Text>
              <Text numberOfLines={1} style={[styles.stepperWord, { color: colors.mutedForeground }]}>{t.mesaTitle}</Text>
            </View>
            <Pressable
              disabled={mesas >= 20}
              style={[styles.stepperSide, mesas >= 20 && styles.stepperDisabled]}
              onPress={() => { setMesas(mesas === 0 ? 2 : mesas + 1); Haptics.selectionAsync(); }}
            >
              <Feather name="plus" size={18} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ── Bottom buttons row ── */}
      <View style={styles.bottomRow}>
        {previousGames.length > 0 && (
          <Pressable style={styles.historyBtn} onPress={() => setHistoryModal(true)}>
            <Feather name="archive" size={15} color={colors.mutedForeground} />
            <Text style={styles.historyBtnText}>{t.previous}</Text>
            <View style={styles.historyBadge}>
              <Text style={styles.historyBadgeText}>{previousGames.length}</Text>
            </View>
          </Pressable>
        )}
        <Pressable
          style={[styles.restartBtn, previousGames.length > 0 && { flex: 1 }]}
          onPress={() => setRestartModal(true)}
        >
          <Feather name="rotate-ccw" size={15} color={colors.destructive} />
          <Text style={styles.restartText}>{t.restart}</Text>
        </Pressable>
      </View>
      </>
      )}

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Edit player (rename + color) */}
      <Modal visible={renameModal !== null} transparent animationType="fade" onRequestClose={() => setRenameModal(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.renameTitle}</Text>
            <TextInput
              style={[styles.modalInput, styles.renameInput, {
                borderColor: renameModal?.color ?? colors.border,
              }]}
              placeholder={t.renamePlaceholder}
              placeholderTextColor={colors.mutedForeground}
              value={renameModal?.value ?? ""}
              onChangeText={(v) => setRenameModal((prev) => prev ? { ...prev, value: v } : null)}
              onSubmitEditing={confirmRename}
              autoFocus
              selectTextOnFocus
              maxLength={20}
              returnKeyType="done"
            />
            <Text style={styles.colorPickerLabel}>{t.pickColor}</Text>
            <View style={styles.colorGrid}>
              {PLAYER_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[
                    styles.colorSwatch,
                    { backgroundColor: c },
                    renameModal?.color === c && styles.colorSwatchSelected,
                  ]}
                  onPress={() => {
                    setRenameModal((prev) => prev ? { ...prev, color: c } : null);
                    Haptics.selectionAsync();
                  }}
                >
                  {renameModal?.color === c && (
                    <Feather name="check" size={14} color="#fff" />
                  )}
                </Pressable>
              ))}
            </View>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setRenameModal(null)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: renameModal?.color ?? colors.primary }]}
                onPress={confirmRename}
              >
                <Text style={styles.modalConfirmText}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add points */}
      <Modal visible={addModal !== null} transparent animationType="fade" onRequestClose={closeAddModal}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            {(() => {
              const p = players.find((pl) => pl.id === addModal?.playerId);
              return (
                <Text style={styles.modalTitle}>
                  {t.pointsFor} <Text style={{ color: p?.color }}>{p ? translatePlayerName(p.name, lang) : ""}</Text>
                </Text>
              );
            })()}
            <TextInput
              style={[styles.modalInput, styles.transparentInput]}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={pointsInput}
              onChangeText={setPointsInput}
              autoFocus
              selectTextOnFocus
            />
            {addModal && (() => {
              const parsed = parseInt(pointsInput, 10);
              const pts = !isNaN(parsed) && parsed > 0 ? parsed : 0;
              const pColor = players.find((pl) => pl.id === addModal.playerId)?.color ?? colors.primary;
              const projected = (totals[addModal.playerId] ?? 0) + pts;
              const left = target - projected;
              return (
                <Text style={[styles.addPreviewText, left <= 0 && { color: pColor }]}>
                  {left <= 0 ? t.willWin : t.remaining(left)}
                </Text>
              );
            })()}
            {addModal && getPartner(addModal.playerId) && (
              <Pressable
                style={styles.extraToggleRow}
                onPress={() => { setForBoth((v) => !v); Haptics.selectionAsync(); }}
              >
                <View style={[styles.extraCheckbox, forBoth && styles.extraCheckboxOn]}>
                  {forBoth ? <Feather name="check" size={14} color={colors.background} /> : null}
                </View>
                <Text style={styles.extraToggleText}>{t.forBoth}</Text>
              </Pressable>
            )}
            <Pressable
              style={styles.extraToggleRow}
              onPress={() => { setExtraMode((v) => !v); Haptics.selectionAsync(); }}
            >
              <View style={[styles.extraCheckbox, extraMode && styles.extraCheckboxOn]}>
                {extraMode ? <Feather name="check" size={14} color={colors.background} /> : null}
              </View>
              <Text style={styles.extraToggleText}>{t.extraToggle}</Text>
            </Pressable>
            <Pressable style={styles.tieBtn} onPress={handleTie}>
              <Feather name="minus-circle" size={16} color={colors.mutedForeground} />
              <Text style={styles.tieBtnText}>{t.tie}</Text>
            </Pressable>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={closeAddModal}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: players.find((pl) => pl.id === addModal?.playerId)?.color ?? colors.primary }]}
                onPress={handleAddPoints}
              >
                <Text style={styles.modalConfirmText}>{t.add}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit entry */}
      <Modal visible={editModal !== null} transparent animationType="fade" onRequestClose={() => setEditModal(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.editPoints}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={editInput}
              onChangeText={setEditInput}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setEditModal(null)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.primary }]} onPress={handleEditPoints}>
                <Text style={styles.modalConfirmText}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom target */}
      <Modal visible={customModal} transparent animationType="fade" onRequestClose={() => setCustomModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.customTargetTitle}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder={t.customTargetPlaceholder}
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={customInput}
              onChangeText={setCustomInput}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setCustomModal(false)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.primary }]} onPress={handleSetCustomTarget}>
                <Text style={styles.modalConfirmText}>{t.save}</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Restart confirm */}
      <Modal visible={restartModal} transparent animationType="fade" onRequestClose={() => setRestartModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.restartTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.restartMsg}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setRestartModal(false)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.destructive }]} onPress={confirmRestart}>
                <Text style={styles.modalConfirmText}>{t.restartConfirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Previous games */}
      <Modal visible={historyModal} transparent animationType="slide" onRequestClose={() => setHistoryModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitleText}>{t.previousGamesTitle}</Text>
              <Pressable onPress={() => setHistoryModal(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {previousGames.map((game: PreviousGame) => {
                const gTotals = computeTotals(game.entries);
                const isExpanded = expandedGame === game.id;
                const dateStr = formatDate(game.date);
                const winner = [...game.players].sort(
                  (a, b) => (gTotals[b.id] ?? 0) - (gTotals[a.id] ?? 0)
                )[0];
                return (
                  <View key={game.id} style={styles.prevGameBlock}>
                    <View style={styles.prevGameHeaderRow}>
                      <Pressable
                        style={styles.prevGameHeaderMain}
                        onPress={() => setExpandedGame(isExpanded ? null : game.id)}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.prevGameDate}>{dateStr}</Text>
                          <Text style={styles.prevGameMeta}>
                            {t.gameTarget}: {game.target} · {game.entries.length} {t.gameEntries}
                          </Text>
                        </View>
                        <View style={[styles.prevWinnerBadge, { backgroundColor: winner?.color + "22", borderColor: winner?.color }]}>
                          <Text style={[styles.prevWinnerText, { color: winner?.color }]}>
                            🏆 {winner ? translatePlayerName(winner.name, lang) : ""}
                          </Text>
                        </View>
                        <Feather
                          name={isExpanded ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={colors.mutedForeground}
                          style={{ marginLeft: 8 }}
                        />
                      </Pressable>
                      <Pressable
                        style={styles.deleteGameBtn}
                        onPress={() => setDeleteGameModal(game.id)}
                        hitSlop={8}
                      >
                        <Feather name="trash-2" size={15} color={colors.destructive} />
                      </Pressable>
                    </View>

                    {/* Player totals */}
                    {game.mesas > 0 ? (
                      <View style={styles.prevMesaList}>
                        {Array.from({ length: game.mesas }).map((_, mi) => {
                          const mesaPlayers = [game.players[mi * 2], game.players[mi * 2 + 1]];
                          return (
                            <View key={"pmesa-" + mi} style={styles.prevMesaGroup}>
                              <Text style={styles.prevMesaLabel}>{t.mesaLabel(mi + 1)}</Text>
                              <View style={styles.prevPlayerRow}>
                                {mesaPlayers.map((p) =>
                                  p ? (
                                    <View key={p.id} style={styles.prevPlayerChip}>
                                      <View style={[styles.entryColorDot, { backgroundColor: p.color }]} />
                                      <Text style={[styles.prevPlayerName, { color: p.color }]} numberOfLines={1}>{translatePlayerName(p.name, lang)}</Text>
                                      <Text style={styles.prevPlayerTotal}>{gTotals[p.id] ?? 0}</Text>
                                    </View>
                                  ) : null
                                )}
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    ) : (
                      <View style={styles.prevPlayerRow}>
                        {game.players.map((p) => (
                          <View key={p.id} style={styles.prevPlayerChip}>
                            <View style={[styles.entryColorDot, { backgroundColor: p.color }]} />
                            <Text style={[styles.prevPlayerName, { color: p.color }]} numberOfLines={1}>{translatePlayerName(p.name, lang)}</Text>
                            <Text style={styles.prevPlayerTotal}>{gTotals[p.id] ?? 0}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* Expanded entry list */}
                    {isExpanded && (
                      game.mesas > 0 ? (
                        <View style={styles.prevMesaEntryWrap}>
                          {Array.from({ length: game.mesas }).map((_, mi) => {
                            const mesaPlayers = [game.players[mi * 2], game.players[mi * 2 + 1]].filter(
                              (p): p is (typeof game.players)[number] => Boolean(p)
                            );
                            const mesaIds = new Set(mesaPlayers.map((p) => p.id));
                            const mesaWinner = [...mesaPlayers].sort(
                              (a, b) => (gTotals[b.id] ?? 0) - (gTotals[a.id] ?? 0)
                            )[0];
                            const mesaEntries = game.entries.filter((e) => mesaIds.has(e.playerId));
                            return (
                              <View key={"emesa-" + mi} style={styles.prevMesaEntryGroup}>
                                <View style={styles.prevMesaEntryHeader}>
                                  <Text style={styles.prevMesaLabel}>{t.mesaLabel(mi + 1)}</Text>
                                  {mesaWinner && (
                                    <View style={[styles.prevWinnerBadge, { backgroundColor: mesaWinner.color + "22", borderColor: mesaWinner.color }]}>
                                      <Text style={[styles.prevWinnerText, { color: mesaWinner.color }]}>
                                        🏆 {translatePlayerName(mesaWinner.name, lang)}
                                      </Text>
                                    </View>
                                  )}
                                </View>
                                {mesaEntries.length > 0 ? (
                                  <View style={styles.prevEntryList}>
                                    {[...mesaEntries].reverse().map((entry, eIdx) => {
                                      const ep = game.players.find((p) => p.id === entry.playerId);
                                      const num = mesaEntries.length - eIdx;
                                      return (
                                        <View key={entry.id} style={styles.entryRow}>
                                          <Text style={styles.entryNum}>{t.entry(num)}</Text>
                                          <View style={[styles.entryColorDot, { backgroundColor: ep?.color ?? "#888" }]} />
                                          <Text style={[styles.entryPlayerName, { color: ep?.color ?? "#888" }]} numberOfLines={1}>
                                            {ep ? translatePlayerName(ep.name, lang) : "—"}
                                          </Text>
                                          {entry.extra ? (
                                            <View style={styles.extraBadge}>
                                              <Text style={styles.extraBadgeText}>{t.extraLabel}</Text>
                                            </View>
                                          ) : null}
                                          {(entry.tie || entry.points === 0) ? (
                                            <View style={styles.tieBadge}>
                                              <Text style={styles.tieBadgeText}>{t.tieLabel}</Text>
                                            </View>
                                          ) : null}
                                          {entry.edited ? (
                                            <View style={styles.editedBadge}>
                                              <Text style={styles.editedBadgeText}>{t.edited}</Text>
                                            </View>
                                          ) : null}
                                          <Text style={[styles.entryPoints, entry.deleted && styles.deletedPoints]}>+{entry.points}</Text>
                                        </View>
                                      );
                                    })}
                                  </View>
                                ) : (
                                  <Text style={styles.prevMesaEmpty}>—</Text>
                                )}
                              </View>
                            );
                          })}
                        </View>
                      ) : (
                        <View style={styles.prevEntryList}>
                          {[...game.entries].reverse().map((entry, eIdx) => {
                            const ep = game.players.find((p) => p.id === entry.playerId);
                            const num = game.entries.length - eIdx;
                            return (
                              <View key={entry.id} style={styles.entryRow}>
                                <Text style={styles.entryNum}>{t.entry(num)}</Text>
                                <View style={[styles.entryColorDot, { backgroundColor: ep?.color ?? "#888" }]} />
                                <Text style={[styles.entryPlayerName, { color: ep?.color ?? "#888" }]} numberOfLines={1}>
                                  {ep ? translatePlayerName(ep.name, lang) : "—"}
                                </Text>
                                {entry.extra ? (
                                  <View style={styles.extraBadge}>
                                    <Text style={styles.extraBadgeText}>{t.extraLabel}</Text>
                                  </View>
                                ) : null}
                                {(entry.tie || entry.points === 0) ? (
                                  <View style={styles.tieBadge}>
                                    <Text style={styles.tieBadgeText}>{t.tieLabel}</Text>
                                  </View>
                                ) : null}
                                {entry.edited ? (
                                  <View style={styles.editedBadge}>
                                    <Text style={styles.editedBadgeText}>{t.edited}</Text>
                                  </View>
                                ) : null}
                                <Text style={[styles.entryPoints, entry.deleted && styles.deletedPoints]}>+{entry.points}</Text>
                              </View>
                            );
                          })}
                        </View>
                      )
                    )}
                  </View>
                );
              })}
            </ScrollView>
            {previousGames.length > 0 && (
              <Pressable
                style={styles.clearHistoryBtn}
                onPress={() => setClearHistoryModal(true)}
              >
                <Feather name="trash-2" size={15} color={colors.destructive} />
                <Text style={styles.clearHistoryBtnText}>{t.clearHistory}</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.modalConfirm, { backgroundColor: colors.primary, marginTop: 10 }]}
              onPress={() => setHistoryModal(false)}
            >
              <Text style={styles.modalConfirmText}>{t.close}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Delete previous game confirm — rendered after history modal so it stacks on top */}
      <Modal visible={deleteGameModal !== null} transparent animationType="fade" onRequestClose={() => setDeleteGameModal(null)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.deleteGame}</Text>
            <Text style={styles.modalSubtitle}>{t.confirmDeleteGame}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setDeleteGameModal(null)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.destructive }]} onPress={confirmDeleteGame}>
                <Text style={styles.modalConfirmText}>{t.deleteConfirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Clear all history confirm */}
      <Modal visible={clearHistoryModal} transparent animationType="fade" onRequestClose={() => setClearHistoryModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.clearHistoryTitle}</Text>
            <Text style={styles.modalSubtitle}>{t.clearHistoryMsg}</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setClearHistoryModal(false)}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.destructive }]} onPress={confirmClearHistory}>
                <Text style={styles.modalConfirmText}>{t.clearHistoryConfirm}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings / Players */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitleText}>{t.playersTitle}</Text>
              <Pressable onPress={() => setSettingsModal(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.settingsList}>
              {/* Language switcher */}
              <View style={styles.langSection}>
                <Text style={styles.langLabel}>{t.languageTitle}</Text>
                <View style={styles.langRow}>
                  <Pressable
                    style={[styles.langChip, lang === "es" && styles.langChipActive]}
                    onPress={() => setLang("es")}
                  >
                    <Text style={[styles.langChipText, lang === "es" && styles.langChipTextActive]}>
                      {t.langEs}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.langChip, lang === "en" && styles.langChipActive]}
                    onPress={() => setLang("en")}
                  >
                    <Text style={[styles.langChipText, lang === "en" && styles.langChipTextActive]}>
                      {t.langEn}
                    </Text>
                  </Pressable>
                </View>
              </View>

              {/* Background theme picker */}
              <View style={styles.langSection}>
                <Text style={styles.langLabel}>{t.bgTitle}</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.bgThemeRow}>
                    {BG_THEMES.map((theme) => {
                      const active = bgTheme === theme.id;
                      return (
                        <Pressable
                          key={theme.id}
                          style={[styles.bgThemeChip, active && styles.bgThemeChipActive]}
                          onPress={() => { setBgTheme(theme.id); Haptics.selectionAsync(); }}
                        >
                          <Feather
                            name={theme.icon}
                            size={14}
                            color={active ? colors.primary : colors.mutedForeground}
                          />
                          <Text style={[styles.bgThemeText, active && styles.bgThemeTextActive]}>
                            {t[theme.labelKey]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Gallery photo background */}
                <View style={styles.bgPhotoRow}>
                  <Pressable
                    style={[styles.bgPhotoBtn, bgTheme === "custom" && customBgUri && styles.bgPhotoBtnActive]}
                    onPress={handlePickBackgroundPhoto}
                  >
                    <Feather
                      name="image"
                      size={14}
                      color={bgTheme === "custom" && customBgUri ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.bgPhotoText,
                        bgTheme === "custom" && customBgUri && styles.bgPhotoTextActive,
                      ]}
                    >
                      {customBgUri ? t.bgChangePhoto : t.bgPickPhoto}
                    </Text>
                  </Pressable>
                  {customBgUri ? (
                    <Pressable style={styles.bgPhotoRemoveBtn} onPress={handleRemoveBackgroundPhoto}>
                      <Feather name="x" size={13} color={colors.destructive} />
                      <Text style={styles.bgPhotoRemoveText}>{t.bgRemovePhoto}</Text>
                    </Pressable>
                  ) : null}
                </View>
                {photoDenied ? (
                  <Text style={styles.bgPhotoDeniedText}>{t.bgPhotoDenied}</Text>
                ) : null}
              </View>

              {/* Divider */}
              <View style={styles.sectionDivider} />

              {/* Player count selector */}
              <View style={styles.langSection}>
                <Text style={styles.langLabel}>{t.playerCountTitle}</Text>
                <View style={styles.countRow}>
                  {[2, 3, 4, 5, 6, 7, 8].map((n) => {
                    const active = players.length === n;
                    return (
                      <Pressable
                        key={n}
                        style={[styles.countChip, active && styles.countChipActive]}
                        onPress={() => { setPlayerCount(n); Haptics.selectionAsync(); }}
                      >
                        <Text style={[styles.countChipText, active && styles.countChipTextActive]}>
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Mesas selector */}
              <View style={styles.langSection}>
                <Text style={styles.langLabel}>{t.mesaTitle}</Text>
                <View style={styles.countRow}>
                  {Array.from({ length: 21 }, (_, i) => i).map((n) => {
                    const active = mesas === n;
                    return (
                      <Pressable
                        key={n}
                        style={[styles.countChip, active && styles.countChipActive]}
                        onPress={() => { setMesas(n); Haptics.selectionAsync(); }}
                      >
                        <Text style={[styles.countChipText, active && styles.countChipTextActive]}>
                          {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Divider */}
              <View style={styles.sectionDivider} />

              {/* Players list */}
              {players.map((player) => (
                <View key={player.id} style={styles.settingsPlayerRow}>
                  <View style={[styles.playerColorSwatch, { backgroundColor: player.color }]} />
                  {editingName?.id === player.id ? (
                    <TextInput
                      style={[styles.nameInput, { borderColor: player.color }]}
                      value={editingName.value}
                      onChangeText={(v) => setEditingName({ id: player.id, value: v })}
                      onSubmitEditing={savePlayerName}
                      onBlur={savePlayerName}
                      autoFocus
                      maxLength={20}
                      selectTextOnFocus
                    />
                  ) : (
                    <Pressable
                      style={styles.nameDisplay}
                      onPress={() => setEditingName({ id: player.id, value: translatePlayerName(player.name, lang) })}
                    >
                      <Text style={styles.nameDisplayText} numberOfLines={1}>{translatePlayerName(player.name, lang)}</Text>
                      <Feather name="edit-2" size={13} color={colors.mutedForeground} style={{ marginLeft: 6 }} />
                    </Pressable>
                  )}
                  {players.length > 2 && (
                    <Pressable
                      style={styles.removePlayerBtn}
                      onPress={() => removePlayer(player.id)}
                      hitSlop={8}
                    >
                      <Feather name="user-minus" size={16} color={colors.destructive} />
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>

            {players.length < 8 && (
              <Pressable
                style={[styles.addPlayerBtn, { borderColor: colors.primary }]}
                onPress={() => { addPlayer(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
              >
                <Feather name="user-plus" size={16} color={colors.primary} />
                <Text style={[styles.addPlayerText, { color: colors.primary }]}>{t.addPlayer}</Text>
                <Text style={styles.playerCountHint}>{t.playerCount(players.length, 8)}</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.modalConfirm, { backgroundColor: colors.primary, marginTop: 14, paddingTop: 13, paddingBottom: 19, alignSelf: "center", paddingHorizontal: 56 }]}
              onPress={() => setSettingsModal(false)}
            >
              <Text style={[styles.modalConfirmText, { fontSize: 16, lineHeight: 16, includeFontPadding: false }]}>{t.done}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function makeStyles(colors: ReturnType<typeof import("@/hooks/useColors").useColors>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
      paddingHorizontal: 14,
    },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      paddingBottom: 10,
      gap: 8,
    },
    targetRow: {
      flex: 1,
      flexDirection: "row",
      gap: 6,
      flexWrap: "wrap",
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 42,
      marginBottom: 10,
    },
    searchBarError: {
      borderColor: colors.destructive,
    },
    searchInput: {
      flex: 1,
      color: colors.foreground,
      fontFamily: "Inter_500Medium",
      fontSize: 14,
      paddingVertical: 0,
    },
    searchNotFoundText: {
      color: colors.destructive,
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      marginTop: -4,
      marginBottom: 8,
      marginLeft: 4,
    },
    targetChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: "transparent",
      borderWidth: 1.5,
      borderColor: colors.mutedForeground,
    },
    targetChipActive: {
      backgroundColor: colors.primary + "26",
      borderColor: colors.primary,
    },
    targetChipText: {
      color: colors.foreground,
      fontFamily: "Inter_700Bold",
      fontSize: 14,
    },
    targetChipTextActive: {
      color: colors.primary,
    },
    settingsBtn: {
      width: 38,
      height: 38,
      borderRadius: 10,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    settingsBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "1A",
    },
    topBarBtns: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: 8,
    },
    tournamentToggle: {
      alignItems: "center",
      gap: 3,
    },
    tournamentHintText: {
      fontFamily: "Inter_700Bold",
      fontSize: 12,
      color: colors.primary,
    },
    tournamentTitleRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    tournamentTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 18,
      color: colors.foreground,
    },
    playerScroll: {
      flexShrink: 1,
      flexGrow: 0,
    },
    playerGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      paddingBottom: 6,
    },
    addBoxRow: {
      width: "100%",
      flexDirection: "column",
      gap: 10,
      marginTop: 4,
    },
    stepperBox: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderRadius: 12,
      borderWidth: 1.5,
      borderStyle: "dashed",
    },
    stepperSide: {
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    stepperDisabled: {
      opacity: 0.3,
    },
    stepperLabel: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
    stepperCenter: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      minWidth: 0,
    },
    stepperWord: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      flexShrink: 1,
    },
    mesaContainer: {
      gap: 16,
      paddingBottom: 6,
    },
    mesaGroup: {
      gap: 8,
      borderWidth: 2,
      borderColor: "transparent",
      borderRadius: 16,
      padding: 8,
    },
    mesaGlow: {
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
    mesaLabel: {
      fontFamily: "Inter_700Bold",
      fontSize: 13,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 1,
    },
    mesaRow: {
      flexDirection: "row",
      gap: 10,
    },
    playerCard: {
      width: "48%",
      backgroundColor: "transparent",
      borderRadius: 14,
      borderWidth: 2,
      overflow: "hidden",
      alignItems: "center",
      paddingBottom: 14,
    },
    playerHeader: {
      width: "100%",
      paddingVertical: 8,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 8,
    },
    playerName: {
      fontFamily: "Inter_700Bold",
      fontSize: 14,
      letterSpacing: 0.3,
      flexShrink: 1,
    },
    winBadge: {
      borderRadius: 5,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    winBadgeText: {
      color: "#fff",
      fontFamily: "Inter_700Bold",
      fontSize: 9,
      letterSpacing: 0.8,
    },
    scoreText: {
      fontFamily: "Inter_700Bold",
      fontSize: 48,
      marginTop: 6,
      lineHeight: 56,
    },
    remainingText: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.mutedForeground,
      marginTop: 2,
      marginBottom: 12,
    },
    addBtn: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      borderWidth: 2,
    },
    cardHistory: {
      width: "100%",
      marginTop: 12,
      paddingHorizontal: 10,
      gap: 2,
    },
    cardEntryRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 5,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    cardEntryLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 0,
      flexShrink: 1,
    },
    cardEntryRight: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      flexShrink: 0,
    },
    cardEntryNum: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      minWidth: 16,
    },
    cardEntryPoints: {
      fontFamily: "Inter_700Bold",
      fontSize: 14,
      textAlign: "right",
      minWidth: 36,
    },
    clearHistoryBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 12,
      borderRadius: 12,
      borderWidth: 1.5,
      borderColor: colors.destructive,
      marginTop: 14,
    },
    clearHistoryBtnText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: colors.destructive,
    },
    entryRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 6,
    },
    entryNum: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      width: 26,
    },
    entryColorDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    entryPlayerName: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      flex: 1,
    },
    entryPoints: {
      fontFamily: "Inter_700Bold",
      fontSize: 14,
      color: colors.foreground,
      minWidth: 36,
      textAlign: "right",
    },
    entryActionBtn: {
      padding: 4,
    },
    bottomRow: {
      flexDirection: "row",
      gap: 10,
    },
    historyBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingVertical: 13,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    historyBtnText: {
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
    },
    historyBadge: {
      backgroundColor: colors.primary,
      borderRadius: 8,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    historyBadgeText: {
      color: "#000",
      fontFamily: "Inter_700Bold",
      fontSize: 10,
    },
    restartBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingVertical: 13,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.destructive,
    },
    restartText: {
      color: colors.destructive,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    // Previous games
    prevGameBlock: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingBottom: 12,
      marginBottom: 12,
    },
    prevGameHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 8,
    },
    prevGameHeaderMain: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    prevGameDate: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.foreground,
    },
    prevGameMeta: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: colors.mutedForeground,
      marginTop: 1,
    },
    prevWinnerBadge: {
      borderRadius: 8,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 4,
      marginLeft: 8,
    },
    prevWinnerText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 11,
    },
    deleteGameBtn: {
      padding: 6,
      marginLeft: 6,
    },
    prevMesaList: {
      gap: 8,
      marginBottom: 6,
    },
    prevMesaEntryWrap: {
      gap: 12,
      marginTop: 4,
    },
    prevMesaEntryGroup: {
      gap: 6,
    },
    prevMesaEntryHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    prevMesaEmpty: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.mutedForeground,
    },
    prevMesaGroup: {
      gap: 4,
    },
    prevMesaLabel: {
      fontFamily: "Inter_700Bold",
      fontSize: 11,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    prevPlayerRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      marginBottom: 6,
    },
    prevPlayerChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      backgroundColor: colors.background,
      borderRadius: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    prevPlayerName: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 12,
      maxWidth: 80,
    },
    prevPlayerTotal: {
      fontFamily: "Inter_700Bold",
      fontSize: 13,
      color: colors.foreground,
    },
    prevEntryList: {
      marginTop: 4,
    },
    // Modals
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      justifyContent: "center",
      alignItems: "center",
    },
    modalCard: {
      width: "80%",
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 17,
      color: colors.foreground,
      marginBottom: 8,
      textAlign: "center",
    },
    modalSubtitle: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      marginBottom: 20,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      fontSize: 28,
      fontFamily: "Inter_700Bold",
      color: colors.foreground,
      textAlign: "center",
      marginBottom: 18,
    },
    renameInput: {
      fontSize: 18,
      borderWidth: 2,
    },
    transparentInput: {
      backgroundColor: "transparent",
    },
    colorPickerLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 10,
    },
    colorGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      justifyContent: "center",
      marginBottom: 20,
    },
    colorSwatch: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
    },
    colorSwatchSelected: {
      borderWidth: 3,
      borderColor: "#fff",
    },
    modalBtns: {
      flexDirection: "row",
      gap: 10,
    },
    modalCancel: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
    },
    modalCancelText: {
      color: colors.secondaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    modalConfirm: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 10,
      alignItems: "center",
    },
    modalConfirmText: {
      color: "#fff",
      fontFamily: "Inter_700Bold",
      fontSize: 14,
    },
    // Settings modal
    settingsCard: {
      width: "88%",
      maxHeight: "80%",
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    settingsHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
    },
    settingsTitleText: {
      fontFamily: "Inter_700Bold",
      fontSize: 18,
      color: colors.foreground,
    },
    settingsList: {
      flexGrow: 0,
    },
    langSection: {
      marginBottom: 4,
    },
    langLabel: {
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      color: colors.mutedForeground,
      textTransform: "uppercase",
      letterSpacing: 0.7,
      marginBottom: 8,
    },
    langRow: {
      flexDirection: "row",
      gap: 8,
    },
    langChip: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    langChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "22",
    },
    langChipText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.mutedForeground,
    },
    langChipTextActive: {
      color: colors.primary,
    },
    bgThemeRow: {
      flexDirection: "row",
      gap: 8,
    },
    bgThemeChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    bgThemeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "22",
    },
    bgThemeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.mutedForeground,
    },
    bgThemeTextActive: {
      color: colors.primary,
    },
    bgPhotoRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 10,
    },
    bgPhotoBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    bgPhotoBtnActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "22",
    },
    bgPhotoText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.mutedForeground,
    },
    bgPhotoTextActive: {
      color: colors.primary,
    },
    bgPhotoRemoveBtn: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      paddingVertical: 8,
      paddingHorizontal: 10,
      borderRadius: 10,
    },
    bgPhotoRemoveText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.destructive,
    },
    bgPhotoDeniedText: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.destructive,
      marginTop: 8,
    },
    countRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    countChip: {
      width: 40,
      height: 40,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    countChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "22",
    },
    countChipText: {
      fontFamily: "Inter_700Bold",
      fontSize: 16,
      color: colors.mutedForeground,
    },
    countChipTextActive: {
      color: colors.primary,
    },
    extraToggleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 14,
      paddingVertical: 4,
    },
    extraCheckbox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
    },
    extraCheckboxOn: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    extraToggleText: {
      fontFamily: "Inter_500Medium",
      fontSize: 15,
      color: colors.foreground,
    },
    extraBadge: {
      backgroundColor: colors.primary + "22",
      borderRadius: 4,
      paddingHorizontal: 3,
      paddingVertical: 1,
      marginRight: 2,
    },
    extraBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 9,
      color: colors.primary,
    },
    tieBadge: {
      backgroundColor: colors.mutedForeground + "26",
      borderRadius: 4,
      paddingHorizontal: 3,
      paddingVertical: 1,
      marginRight: 2,
    },
    tieBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 9,
      color: colors.mutedForeground,
    },
    editedBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      backgroundColor: colors.mutedForeground + "1F",
      borderRadius: 4,
      paddingHorizontal: 4,
      paddingVertical: 2,
      marginRight: 2,
    },
    editedBadgeText: {
      fontFamily: "Inter_500Medium",
      fontSize: 9,
      fontStyle: "italic",
      color: colors.mutedForeground,
    },
    deletedPoints: {
      textDecorationLine: "line-through",
      textDecorationColor: colors.destructive,
      opacity: 0.6,
    },
    addPreviewText: {
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
      marginBottom: 10,
    },
    tieBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingVertical: 12,
      marginTop: 16,
    },
    tieBtnText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      color: colors.foreground,
    },
    sectionDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 14,
    },
    settingsPlayerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    playerColorSwatch: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    nameDisplay: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
    },
    nameDisplayText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
      color: colors.foreground,
      flex: 1,
    },
    nameInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: 8,
      borderWidth: 1.5,
      paddingHorizontal: 10,
      paddingVertical: 6,
      fontSize: 15,
      fontFamily: "Inter_600SemiBold",
      color: colors.foreground,
    },
    removePlayerBtn: {
      padding: 4,
    },
    addPlayerBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1.5,
      borderStyle: "dashed",
    },
    addPlayerText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
    playerCountHint: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.mutedForeground,
    },
  });
}
