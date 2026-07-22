import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Pressable,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import type { ScoreEntry } from "@/context/GameContext";
import type { Translations } from "@/constants/translations";

interface Props {
  entry: ScoreEntry;
  num: number;
  playerColor: string;
  isOpen: boolean;
  isLast?: boolean;
  rowRef?: React.RefObject<View | null>;
  eyeRef?: React.RefObject<View | null>;
  onToggleReveal: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: Translations;
  colors: {
    primary: string;
    mutedForeground: string;
    destructive: string;
    foreground: string;
  };
}

export default function HistoryEntryItem({
  entry,
  num,
  playerColor,
  isOpen,
  isLast,
  rowRef,
  eyeRef,
  onToggleReveal,
  onEdit,
  onDelete,
  t,
  colors,
}: Props) {
  const animHeight = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animHeight, {
      toValue: isOpen ? 1 : 0,
      duration: 250,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    }).start();
  }, [isOpen]);

  const panelHeight = animHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, (entry.history?.length ?? 0) * 22 + 8],
  });
  const panelOpacity = animHeight.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

  return (
    <View ref={rowRef} style={[styles.entryContainer, !isLast && { borderBottomColor: colors.mutedForeground + "33" }]}>
      <View style={styles.cardEntryRow}>
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
              ref={eyeRef}
              style={styles.editedBadge}
              onPress={() => {
                onToggleReveal();
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
              hitSlop={4}
            >
              <Feather name="eye" size={10} color={colors.mutedForeground} />
              <Text style={styles.editedBadgeText}>{t.edited}</Text>
            </Pressable>
          ) : null}
          <Text style={[
            styles.cardEntryPoints,
            { color: playerColor },
            entry.deleted && styles.deletedPoints,
          ]}>
            +{entry.points}
          </Text>
        </View>
        <View style={styles.cardEntryRight}>
          <Pressable
            style={styles.entryActionBtn}
            onPress={onEdit}
            hitSlop={6}
          >
            <Feather name="edit-2" size={13} color={colors.mutedForeground} />
          </Pressable>
          <Pressable
            style={styles.entryActionBtn}
            onPress={onDelete}
            hitSlop={6}
          >
            <Feather name={entry.deleted ? "rotate-ccw" : "trash-2"} size={13} color={entry.deleted ? colors.mutedForeground : colors.destructive} />
          </Pressable>
        </View>
      </View>
      {entry.history && entry.history.length > 0 && (
        <Animated.View style={[styles.historyPanel, { height: panelHeight, opacity: panelOpacity }]}>
          {entry.history.slice().reverse().map((h, hIdx) => (
            <View key={hIdx} style={styles.historyPanelRow}>
              <Text style={styles.historyPanelLabel}>{t.previous} {entry.history!.length - hIdx}</Text>
              <Text style={styles.historyPanelValue}>+{h}</Text>
            </View>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

const styles = {
  entryContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "transparent",
  },
  cardEntryRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 3,
    paddingHorizontal: 4,
  },
  cardEntryLeft: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 6,
    flex: 1,
  },
  cardEntryNum: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#888",
    minWidth: 16,
  },
  cardEntryPoints: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  deletedPoints: {
    textDecorationLine: "line-through" as const,
    opacity: 0.4,
  },
  extraBadge: {
    backgroundColor: "#22c55e20",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  extraBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "#22c55e",
  },
  tieBadge: {
    backgroundColor: "#6b728020",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  tieBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "#9ca3af",
  },
  editedBadge: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
  },
  editedBadgeText: {
    fontFamily: "Inter_500Medium",
    fontSize: 9,
    color: "#888",
  },
  cardEntryRight: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 2,
  },
  entryActionBtn: {
    padding: 4,
    borderRadius: 6,
  },
  historyPanel: {
    overflow: "hidden" as const,
    paddingLeft: 24,
    paddingRight: 10,
    gap: 2,
  },
  historyPanelRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingVertical: 2,
  },
  historyPanelLabel: {
    fontFamily: "Inter_400Regular",
    fontSize: 11,
    color: "#888",
  },
  historyPanelValue: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#888",
  },
};
