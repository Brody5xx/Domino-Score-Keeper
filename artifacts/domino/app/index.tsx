import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGame } from "@/context/GameContext";
import { useColors } from "@/hooks/useColors";

const TARGET_PRESETS = [100, 120, 150, 200];

export default function MainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { homeTotal, visitorTotal, target, rounds, addPoints, setTarget, restart } =
    useGame();

  const [addModal, setAddModal] = useState<{ team: "home" | "visitor" } | null>(null);
  const [pointsInput, setPointsInput] = useState("");
  const [customModal, setCustomModal] = useState(false);
  const [customInput, setCustomInput] = useState("");
  const [restartModal, setRestartModal] = useState(false);

  const homeRemaining = Math.max(0, target - homeTotal);
  const visitorRemaining = Math.max(0, target - visitorTotal);
  const homeWon = homeTotal >= target;
  const visitorWon = visitorTotal >= target;
  const gameOver = homeWon || visitorWon;

  const styles = makeStyles(colors);

  function handleAddPoints() {
    const pts = parseInt(pointsInput, 10);
    if (isNaN(pts) || pts <= 0) return;
    if (addModal) {
      addPoints(addModal.team, pts);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    setAddModal(null);
    setPointsInput("");
  }

  function handleSetCustomTarget() {
    const t = parseInt(customInput, 10);
    if (isNaN(t) || t <= 0) return;
    setTarget(t);
    setCustomModal(false);
    setCustomInput("");
  }

  function handleRestart() {
    setRestartModal(true);
  }

  function confirmRestart() {
    restart();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setRestartModal(false);
  }

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  return (
    <View style={[styles.root, { paddingTop: topPad, paddingBottom: bottomPad }]}>
      {/* Target selector */}
      <View style={styles.targetRow}>
        {TARGET_PRESETS.map((t) => (
          <Pressable
            key={t}
            style={[styles.targetChip, target === t && styles.targetChipActive]}
            onPress={() => {
              setTarget(t);
              Haptics.selectionAsync();
            }}
          >
            <Text style={[styles.targetChipText, target === t && styles.targetChipTextActive]}>
              {t}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[
            styles.targetChip,
            !TARGET_PRESETS.includes(target) && styles.targetChipActive,
          ]}
          onPress={() => {
            setCustomModal(true);
            setCustomInput(
              !TARGET_PRESETS.includes(target) ? String(target) : ""
            );
          }}
        >
          <Text
            style={[
              styles.targetChipText,
              !TARGET_PRESETS.includes(target) && styles.targetChipTextActive,
            ]}
          >
            {!TARGET_PRESETS.includes(target) ? String(target) : "..."}
          </Text>
        </Pressable>
      </View>

      {/* Score panels */}
      <View style={styles.teamsRow}>
        {/* Casa */}
        <View style={[styles.teamCard, { borderColor: colors.home }]}>
          <View style={[styles.teamHeader, { backgroundColor: colors.homeLight }]}>
            <Text style={[styles.teamName, { color: colors.home }]}>Casa</Text>
            {homeWon && (
              <View style={[styles.winBadge, { backgroundColor: colors.home }]}>
                <Text style={styles.winBadgeText}>GANÓ</Text>
              </View>
            )}
          </View>
          <Text style={[styles.scoreText, { color: homeWon ? colors.home : colors.foreground }]}>
            {homeTotal}
          </Text>
          <Text style={styles.remainingText}>
            {homeWon ? "¡Victoria!" : `Faltan ${homeRemaining}`}
          </Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.home }, gameOver && styles.disabledBtn]}
            onPress={() => {
              if (!gameOver) {
                setAddModal({ team: "home" });
                setPointsInput("");
              }
            }}
            disabled={gameOver}
          >
            <Feather name="plus" size={22} color="#fff" />
          </Pressable>
        </View>

        {/* Visitante */}
        <View style={[styles.teamCard, { borderColor: colors.visitor }]}>
          <View style={[styles.teamHeader, { backgroundColor: colors.visitorLight }]}>
            <Text style={[styles.teamName, { color: colors.visitor }]}>Visitante</Text>
            {visitorWon && (
              <View style={[styles.winBadge, { backgroundColor: colors.visitor }]}>
                <Text style={styles.winBadgeText}>GANÓ</Text>
              </View>
            )}
          </View>
          <Text style={[styles.scoreText, { color: visitorWon ? colors.visitor : colors.foreground }]}>
            {visitorTotal}
          </Text>
          <Text style={styles.remainingText}>
            {visitorWon ? "¡Victoria!" : `Faltan ${visitorRemaining}`}
          </Text>
          <Pressable
            style={[styles.addBtn, { backgroundColor: colors.visitor }, gameOver && styles.disabledBtn]}
            onPress={() => {
              if (!gameOver) {
                setAddModal({ team: "visitor" });
                setPointsInput("");
              }
            }}
            disabled={gameOver}
          >
            <Feather name="plus" size={22} color="#fff" />
          </Pressable>
        </View>
      </View>

      {/* Round history */}
      <View style={styles.historyContainer}>
        <View style={styles.historyHeader}>
          <Feather name="clock" size={14} color={colors.mutedForeground} />
          <Text style={styles.historyTitle}>Historial</Text>
        </View>
        {rounds.length === 0 ? (
          <Text style={styles.emptyHistory}>Aún no hay rondas registradas</Text>
        ) : (
          <FlatList
            data={[...rounds].reverse()}
            keyExtractor={(item) => item.id}
            scrollEnabled={rounds.length > 4}
            showsVerticalScrollIndicator={false}
            renderItem={({ item, index }) => {
              const roundNum = rounds.length - index;
              return (
                <View style={styles.roundRow}>
                  <Text style={styles.roundNum}>R{roundNum}</Text>
                  <View style={styles.roundScores}>
                    <Text style={[styles.roundScore, { color: colors.home }]}>
                      {item.home > 0 ? `+${item.home}` : "—"}
                    </Text>
                    <Text style={[styles.roundScore, { color: colors.visitor }]}>
                      {item.visitor > 0 ? `+${item.visitor}` : "—"}
                    </Text>
                  </View>
                </View>
              );
            }}
            style={styles.roundList}
          />
        )}
      </View>

      {/* Restart */}
      <Pressable style={styles.restartBtn} onPress={handleRestart}>
        <Feather name="rotate-ccw" size={16} color={colors.destructive} />
        <Text style={styles.restartText}>Reiniciar</Text>
      </Pressable>

      {/* Add points modal */}
      <Modal
        visible={addModal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModal(null)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Puntos —{" "}
              <Text
                style={{
                  color: addModal?.team === "home" ? colors.home : colors.visitor,
                }}
              >
                {addModal?.team === "home" ? "Casa" : "Visitante"}
              </Text>
            </Text>
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
              <Pressable
                style={styles.modalCancel}
                onPress={() => setAddModal(null)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.modalConfirm,
                  {
                    backgroundColor:
                      addModal?.team === "home" ? colors.home : colors.visitor,
                  },
                ]}
                onPress={handleAddPoints}
              >
                <Text style={styles.modalConfirmText}>Agregar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Custom target modal */}
      <Modal
        visible={customModal}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
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
              <Pressable
                style={styles.modalCancel}
                onPress={() => setCustomModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: colors.primary }]}
                onPress={handleSetCustomTarget}
              >
                <Text style={styles.modalConfirmText}>Guardar</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Restart confirmation modal */}
      <Modal
        visible={restartModal}
        transparent
        animationType="fade"
        onRequestClose={() => setRestartModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Reiniciar partida?</Text>
            <Text style={styles.modalSubtitle}>
              Se borrarán todos los puntos y el historial.
            </Text>
            <View style={styles.modalBtns}>
              <Pressable
                style={styles.modalCancel}
                onPress={() => setRestartModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalConfirm, { backgroundColor: colors.destructive }]}
                onPress={confirmRestart}
              >
                <Text style={styles.modalConfirmText}>Reiniciar</Text>
              </Pressable>
            </View>
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
      paddingHorizontal: 16,
    },
    targetRow: {
      flexDirection: "row",
      gap: 8,
      paddingVertical: 14,
      justifyContent: "center",
    },
    targetChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
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
      fontSize: 14,
    },
    targetChipTextActive: {
      color: "#000",
    },
    teamsRow: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 16,
    },
    teamCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 2,
      overflow: "hidden",
      alignItems: "center",
      paddingBottom: 16,
    },
    teamHeader: {
      width: "100%",
      paddingVertical: 10,
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "center",
      gap: 8,
    },
    teamName: {
      fontFamily: "Inter_700Bold",
      fontSize: 16,
      letterSpacing: 0.5,
    },
    winBadge: {
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    winBadgeText: {
      color: "#fff",
      fontFamily: "Inter_700Bold",
      fontSize: 10,
      letterSpacing: 1,
    },
    scoreText: {
      fontFamily: "Inter_700Bold",
      fontSize: 56,
      marginTop: 8,
      lineHeight: 64,
    },
    remainingText: {
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      color: "#888899",
      marginTop: 4,
      marginBottom: 14,
    },
    addBtn: {
      width: 46,
      height: 46,
      borderRadius: 23,
      alignItems: "center",
      justifyContent: "center",
    },
    disabledBtn: {
      opacity: 0.3,
    },
    historyContainer: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 14,
      padding: 14,
      marginBottom: 14,
    },
    historyHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 10,
    },
    historyTitle: {
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      fontSize: 13,
      textTransform: "uppercase",
      letterSpacing: 0.8,
    },
    emptyHistory: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 13,
      textAlign: "center",
      paddingVertical: 16,
    },
    roundList: {
      flex: 1,
    },
    roundRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 7,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    roundNum: {
      color: colors.mutedForeground,
      fontFamily: "Inter_500Medium",
      fontSize: 12,
      width: 32,
    },
    roundScores: {
      flex: 1,
      flexDirection: "row",
      justifyContent: "space-around",
    },
    roundScore: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
      flex: 1,
      textAlign: "center",
    },
    restartBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingVertical: 14,
      borderRadius: 12,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.destructive,
      marginBottom: 4,
    },
    restartText: {
      color: colors.destructive,
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
    modalOverlay: {
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
      fontSize: 18,
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
      marginBottom: 20,
    },
    modalBtns: {
      flexDirection: "row",
      gap: 10,
    },
    modalCancel: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      alignItems: "center",
    },
    modalCancelText: {
      color: colors.secondaryForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 15,
    },
    modalConfirm: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: "center",
    },
    modalConfirmText: {
      color: "#fff",
      fontFamily: "Inter_700Bold",
      fontSize: 15,
    },
  });
}
