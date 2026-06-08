import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
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

import { useGame } from "@/context/GameContext";
import { useColors } from "@/hooks/useColors";

const TARGET_PRESETS = [100, 120, 150, 200];

type AddModalState = { playerId: string } | null;
type EditModalState = { entryId: string; currentPoints: number } | null;

export default function MainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    players,
    entries,
    target,
    totals,
    addEntry,
    editEntry,
    deleteEntry,
    setTarget,
    setPlayerName,
    addPlayer,
    removePlayer,
    restart,
  } = useGame();

  const [addModal, setAddModal] = useState<AddModalState>(null);
  const [pointsInput, setPointsInput] = useState("");

  const [editModal, setEditModal] = useState<EditModalState>(null);
  const [editInput, setEditInput] = useState("");

  const [customModal, setCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState("");

  const [settingsModal, setSettingsModal] = useState(false);
  const [editingName, setEditingName] = useState<{ id: string; value: string } | null>(null);

  const [restartModal, setRestartModal] = useState(false);

  const styles = makeStyles(colors);
  const topPad = Platform.OS === "web" ? 16 : insets.top;
  const bottomPad = Platform.OS === "web" ? 20 : insets.bottom;

  const gameOver = players.some((p) => (totals[p.id] ?? 0) >= target);

  // ── handlers ──────────────────────────────────────────────────────────────

  function handleAddPoints() {
    const pts = parseInt(pointsInput, 10);
    if (!isNaN(pts) && pts > 0 && addModal) {
      addEntry(addModal.playerId, pts);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setAddModal(null);
    setPointsInput("");
  }

  function handleEditPoints() {
    const pts = parseInt(editInput, 10);
    if (!isNaN(pts) && pts > 0 && editModal) {
      editEntry(editModal.entryId, pts);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    setEditModal(null);
    setEditInput("");
  }

  function handleSetCustomTarget() {
    const t = parseInt(customInput, 10);
    if (!isNaN(t) && t > 0) {
      setTarget(t);
    }
    setCustomModal(false);
    setCustomInput("");
  }

  function confirmRestart() {
    restart();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setRestartModal(false);
  }

  function savePlayerName() {
    if (editingName && editingName.value.trim()) {
      setPlayerName(editingName.id, editingName.value.trim());
    }
    setEditingName(null);
  }

  // ── render ─────────────────────────────────────────────────────────────────

  const reversedEntries = [...entries].reverse();

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.targetRow}>
          {TARGET_PRESETS.map((t) => (
            <Pressable
              key={t}
              style={[styles.targetChip, target === t && styles.targetChipActive]}
              onPress={() => { setTarget(t); Haptics.selectionAsync(); }}
            >
              <Text style={[styles.targetChipText, target === t && styles.targetChipTextActive]}>
                {t}
              </Text>
            </Pressable>
          ))}
          <Pressable
            style={[styles.targetChip, !TARGET_PRESETS.includes(target) && styles.targetChipActive]}
            onPress={() => { setCustomModal(true); setCustomInput(!TARGET_PRESETS.includes(target) ? String(target) : ""); }}
          >
            <Text style={[styles.targetChipText, !TARGET_PRESETS.includes(target) && styles.targetChipTextActive]}>
              {!TARGET_PRESETS.includes(target) ? String(target) : "..."}
            </Text>
          </Pressable>
        </View>
        <Pressable style={styles.settingsBtn} onPress={() => setSettingsModal(true)}>
          <Feather name="settings" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── Player grid ── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        style={styles.playerScroll}
        contentContainerStyle={styles.playerGrid}
      >
        {players.map((player) => {
          const total = totals[player.id] ?? 0;
          const remaining = Math.max(0, target - total);
          const won = total >= target;
          return (
            <View
              key={player.id}
              style={[
                styles.playerCard,
                { borderColor: player.color },
                players.length === 1 && { width: "100%" },
              ]}
            >
              <View style={[styles.playerHeader, { backgroundColor: player.color + "26" }]}>
                <Text style={[styles.playerName, { color: player.color }]} numberOfLines={1}>
                  {player.name}
                </Text>
                {won && (
                  <View style={[styles.winBadge, { backgroundColor: player.color }]}>
                    <Text style={styles.winBadgeText}>GANÓ</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.scoreText, { color: won ? player.color : colors.foreground }]}>
                {total}
              </Text>
              <Text style={styles.remainingText}>
                {won ? "¡Victoria!" : `Faltan ${remaining}`}
              </Text>
              <Pressable
                style={[styles.addBtn, { backgroundColor: player.color }, gameOver && styles.disabledBtn]}
                onPress={() => { if (!gameOver) { setAddModal({ playerId: player.id }); setPointsInput(""); } }}
                disabled={gameOver}
              >
                <Feather name="plus" size={20} color="#fff" />
              </Pressable>
            </View>
          );
        })}
      </ScrollView>

      {/* ── History ── */}
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Feather name="clock" size={13} color={colors.mutedForeground} />
          <Text style={styles.historyTitle}>Historial</Text>
        </View>
        {entries.length === 0 ? (
          <Text style={styles.emptyHistory}>Aún no hay puntos registrados</Text>
        ) : (
          <FlatList
            data={reversedEntries}
            keyExtractor={(item) => item.id}
            scrollEnabled={entries.length > 5}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const player = players.find((p) => p.id === item.playerId);
              const num = entries.length - index;
              return (
                <View style={styles.entryRow}>
                  <Text style={styles.entryNum}>#{num}</Text>
                  <View style={[styles.entryColorDot, { backgroundColor: player?.color ?? "#888" }]} />
                  <Text style={[styles.entryPlayerName, { color: player?.color ?? "#888" }]} numberOfLines={1}>
                    {player?.name ?? "—"}
                  </Text>
                  <Text style={styles.entryPoints}>+{item.points}</Text>
                  <Pressable
                    style={styles.entryActionBtn}
                    onPress={() => { setEditModal({ entryId: item.id, currentPoints: item.points }); setEditInput(String(item.points)); }}
                    hitSlop={8}
                  >
                    <Feather name="edit-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                  <Pressable
                    style={styles.entryActionBtn}
                    onPress={() => { deleteEntry(item.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                    hitSlop={8}
                  >
                    <Feather name="trash-2" size={14} color={colors.destructive} />
                  </Pressable>
                </View>
              );
            }}
            style={styles.entryList}
          />
        )}
      </View>

      {/* ── Restart button ── */}
      <Pressable style={styles.restartBtn} onPress={() => setRestartModal(true)}>
        <Feather name="rotate-ccw" size={15} color={colors.destructive} />
        <Text style={styles.restartText}>Reiniciar</Text>
      </Pressable>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Add points */}
      <Modal visible={addModal !== null} transparent animationType="fade" onRequestClose={() => setAddModal(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            {(() => {
              const p = players.find((pl) => pl.id === addModal?.playerId);
              return (
                <Text style={styles.modalTitle}>
                  Puntos — <Text style={{ color: p?.color }}>{p?.name}</Text>
                </Text>
              );
            })()}
            <TextInput
              style={styles.modalInput}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={pointsInput}
              onChangeText={setPointsInput}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setAddModal(null)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: players.find((pl) => pl.id === addModal?.playerId)?.color ?? colors.primary }]}
                onPress={handleAddPoints}
              >
                <Text style={styles.modalConfirmText}>Agregar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Edit entry */}
      <Modal visible={editModal !== null} transparent animationType="fade" onRequestClose={() => setEditModal(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Editar puntos</Text>
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
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.primary }]} onPress={handleEditPoints}>
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom target */}
      <Modal visible={customModal} transparent animationType="fade" onRequestClose={() => setCustomModal(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Meta personalizada</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="200"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="number-pad"
              value={customInput}
              onChangeText={setCustomInput}
              autoFocus
              selectTextOnFocus
            />
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setCustomModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.primary }]} onPress={handleSetCustomTarget}>
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Restart confirm */}
      <Modal visible={restartModal} transparent animationType="fade" onRequestClose={() => setRestartModal(false)}>
        <View style={styles.overlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Reiniciar partida?</Text>
            <Text style={styles.modalSubtitle}>Se borrarán todos los puntos y el historial.</Text>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={() => setRestartModal(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable style={[styles.modalConfirm, { backgroundColor: colors.destructive }]} onPress={confirmRestart}>
                <Text style={styles.modalConfirmText}>Reiniciar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Settings / Players */}
      <Modal visible={settingsModal} transparent animationType="slide" onRequestClose={() => setSettingsModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.settingsCard]}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitleText}>Jugadores</Text>
              <Pressable onPress={() => setSettingsModal(false)} hitSlop={10}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.settingsList}>
              {players.map((player, idx) => (
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
                      onPress={() => setEditingName({ id: player.id, value: player.name })}
                    >
                      <Text style={styles.nameDisplayText} numberOfLines={1}>{player.name}</Text>
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
                <Text style={[styles.addPlayerText, { color: colors.primary }]}>Agregar jugador</Text>
                <Text style={styles.playerCountHint}>{players.length}/8</Text>
              </Pressable>
            )}

            <Pressable
              style={[styles.modalConfirm, { backgroundColor: colors.primary, marginTop: 14 }]}
              onPress={() => setSettingsModal(false)}
            >
              <Text style={styles.modalConfirmText}>Listo</Text>
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
    targetChip: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 20,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    targetChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    targetChipText: {
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
    },
    targetChipTextActive: {
      color: "#000",
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
    playerCard: {
      width: "48%",
      backgroundColor: colors.card,
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
    },
    disabledBtn: {
      opacity: 0.3,
    },
    historyContainer: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 12,
      marginTop: 10,
      marginBottom: 10,
      minHeight: 80,
    },
    historyHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginBottom: 8,
    },
    historyTitle: {
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    emptyHistory: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      textAlign: "center",
      paddingVertical: 12,
    },
    entryList: {
      flex: 1,
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
      maxHeight: "75%",
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
