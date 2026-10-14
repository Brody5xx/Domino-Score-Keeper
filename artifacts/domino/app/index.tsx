import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather, FontAwesome5 } from "@expo/vector-icons";
import { File, Paths } from "expo-file-system";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path } from "react-native-svg";

import Tournament from "@/components/Tournament";
import { ScaledText as Text, ScaledTextInput as TextInput } from "@/components/ScaledText";
import HistoryEntryItem from "@/components/HistoryEntryItem";
import TutorialOverlay, { type TutorialStep } from "@/components/TutorialOverlay";
import { PLAYER_COLORS, type PreviousGame, type ScoreEntry, computeTotals, useGame } from "@/context/GameContext";
import { useLang } from "@/context/LangContext";
import { useTournament } from "@/context/TournamentContext";
import { TEXT_SIZE_OPTIONS, useTextSize } from "@/context/TextSizeContext";
import { LANGUAGE_OPTIONS, translatePlayerName, type Lang } from "@/constants/translations";
import { useColors } from "@/hooks/useColors";
import DominoBackground from "@/components/DominoBackground";

const TARGET_PRESETS = [100, 200];
const FAVORITE_COLORS_KEY = "domino_favorite_colors_v1";
const COLOR_WHEEL_SLICES = 36;
const COLOR_WHEEL_RINGS = 8;

const BG_THEMES = [
  { id: "scatter",  icon: "shuffle"    as const, labelKey: "bgScatter"  as const },
  { id: "diagonal", icon: "trending-up" as const, labelKey: "bgDiagonal" as const },
  { id: "grid",     icon: "grid"       as const, labelKey: "bgGrid"     as const },
  { id: "radial",   icon: "disc"       as const, labelKey: "bgRadial"   as const },
  { id: "giant",    icon: "maximize-2" as const, labelKey: "bgGiant"    as const },
];

type AddModalState = { playerId: string } | null;
type EditModalState = { entryId: string; currentPoints: number } | null;

function hslToHex(h: number, s: number, l: number): string {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const segment = h / 60;
  const x = chroma * (1 - Math.abs((segment % 2) - 1));
  const match = lightness - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (segment < 1) [red, green, blue] = [chroma, x, 0];
  else if (segment < 2) [red, green, blue] = [x, chroma, 0];
  else if (segment < 3) [red, green, blue] = [0, chroma, x];
  else if (segment < 4) [red, green, blue] = [0, x, chroma];
  else if (segment < 5) [red, green, blue] = [x, 0, chroma];
  else [red, green, blue] = [chroma, 0, x];

  return `#${[red, green, blue]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToHsl(hex: string): [number, number, number] | null {
  const normalized = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null;

  const red = parseInt(normalized.slice(0, 2), 16) / 255;
  const green = parseInt(normalized.slice(2, 4), 16) / 255;
  const blue = parseInt(normalized.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0
    ? 0
    : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;

  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }

  return [hue < 0 ? hue + 360 : hue, saturation * 100, lightness * 100];
}

function getClosestWheelCell(color: string): { hueIndex: number; ringIndex: number } | null {
  const hsl = hexToHsl(color);
  if (!hsl) return null;
  const hueIndex = Math.min(
    COLOR_WHEEL_SLICES - 1,
    Math.floor((hsl[0] / 360) * COLOR_WHEEL_SLICES),
  );
  const ringIndex = Math.max(
    0,
    Math.min(COLOR_WHEEL_RINGS - 1, Math.round((hsl[1] - 22) / 10)),
  );
  return { hueIndex, ringIndex };
}

function getWheelCellPath(hueIndex: number, ringIndex: number, size: number): string {
  const center = size / 2;
  const outerRadius = center - 4;
  const innerRadius = (ringIndex / COLOR_WHEEL_RINGS) * outerRadius;
  const ringOuterRadius = ((ringIndex + 1) / COLOR_WHEEL_RINGS) * outerRadius;
  const startAngle = (hueIndex / COLOR_WHEEL_SLICES) * Math.PI * 2 - Math.PI / 2;
  const endAngle = ((hueIndex + 1) / COLOR_WHEEL_SLICES) * Math.PI * 2 - Math.PI / 2;
  const outerStartX = center + ringOuterRadius * Math.cos(startAngle);
  const outerStartY = center + ringOuterRadius * Math.sin(startAngle);
  const outerEndX = center + ringOuterRadius * Math.cos(endAngle);
  const outerEndY = center + ringOuterRadius * Math.sin(endAngle);

  if (ringIndex === 0) {
    return `M ${center} ${center} L ${outerStartX} ${outerStartY} A ${ringOuterRadius} ${ringOuterRadius} 0 0 1 ${outerEndX} ${outerEndY} Z`;
  }

  const innerEndX = center + innerRadius * Math.cos(endAngle);
  const innerEndY = center + innerRadius * Math.sin(endAngle);
  const innerStartX = center + innerRadius * Math.cos(startAngle);
  const innerStartY = center + innerRadius * Math.sin(startAngle);

  return [
    `M ${outerStartX} ${outerStartY}`,
    `A ${ringOuterRadius} ${ringOuterRadius} 0 0 1 ${outerEndX} ${outerEndY}`,
    `L ${innerEndX} ${innerEndY}`,
    `A ${innerRadius} ${innerRadius} 0 0 0 ${innerStartX} ${innerStartY}`,
    "Z",
  ].join(" ");
}

function ColorWheel({
  selectedColor,
  onSelect,
  hint,
}: {
  selectedColor: string;
  onSelect: (color: string) => void;
  hint: string;
}) {
  const size = 190;
  const [selectedCell, setSelectedCell] = React.useState(
    getClosestWheelCell(selectedColor),
  );

  useEffect(() => {
    setSelectedCell(getClosestWheelCell(selectedColor));
  }, [selectedColor]);

  return (
    <View style={stylesForColorWheel.wrapper}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {Array.from({ length: COLOR_WHEEL_RINGS }).flatMap((_, ringIndex) =>
          Array.from({ length: COLOR_WHEEL_SLICES }).map((__, hueIndex) => {
            const hue = (hueIndex / COLOR_WHEEL_SLICES) * 360;
            const saturation = 22 + ringIndex * 10;
            const lightness = 96 - ringIndex * 6.3;
            const color = hslToHex(hue, saturation, lightness);
            return (
              <Path
                key={`${ringIndex}-${hueIndex}`}
                d={getWheelCellPath(hueIndex, ringIndex, size)}
                fill={color}
                stroke="#FFFFFF"
                strokeOpacity={0.1}
                strokeWidth={0.5}
                onPress={() => {
                  setSelectedCell({ hueIndex, ringIndex });
                  onSelect(color);
                }}
              />
            );
          }),
        )}
        {selectedCell ? (
          <>
            <Path
              d={getWheelCellPath(selectedCell.hueIndex, selectedCell.ringIndex, size)}
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={5}
              strokeLinejoin="round"
            />
            <Path
              d={getWheelCellPath(selectedCell.hueIndex, selectedCell.ringIndex, size)}
              fill="none"
              stroke="#111827"
              strokeWidth={3}
              strokeLinejoin="round"
            />
          </>
        ) : null}
        <Circle cx={size / 2} cy={size / 2} r={18} fill="#FFFFFF" />
        <Circle cx={size / 2} cy={size / 2} r={10} fill={selectedColor} />
      </Svg>
      <Text style={stylesForColorWheel.hint}>{hint}</Text>
    </View>
  );
}

const stylesForColorWheel = {
  wrapper: {
    alignItems: "center" as const,
    marginBottom: 14,
  },
  hint: {
    marginTop: -3,
    fontFamily: "Inter_500Medium",
    fontSize: 11,
    color: "#737373",
  },
};

export default function MainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t, lang, setLang, needsLanguageSelection } = useLang();
  const { textSize, setTextSize } = useTextSize();
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
    __setState,
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
  const [favoriteColors, setFavoriteColors] = useState<string[]>([]);
  const [restartModal, setRestartModal] = useState(false);
  const [historyModal, setHistoryModal] = useState(false);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [revealedPreviousEntry, setRevealedPreviousEntry] = useState<string | null>(null);
  const [deleteGameModal, setDeleteGameModal] = useState<string | null>(null);
  const [clearHistoryModal, setClearHistoryModal] = useState(false);

  const [tutorialVisible, setTutorialVisible] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [tutorialSeen, setTutorialSeen] = useState(true);
  // En Android, la ventana (Modal) abierta mas tarde queda encima y se come los toques.
  // Al cambiar esta llave, el tutorial se vuelve a montar y queda arriba de todo.
  const [tutorialLayerKey, setTutorialLayerKey] = useState(0);

  const [mesaSearch, setMesaSearch] = useState("");
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [highlightedMesa, setHighlightedMesa] = useState<number | null>(null);
  const [revealedEntry, setRevealedEntry] = useState<string | null>(null);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  const mesaPositions = useRef<Record<number, number>>({});
  const highlightAnim = useRef(new Animated.Value(0)).current;

  // Tutorial spotlight refs — main screen
  const targetChip200Ref = useRef<View>(null);
  const customTargetRef = useRef<View>(null);
  const addBtnCasaRef = useRef<View>(null);
  const addBtnVisitRef = useRef<View>(null);
  const settingsBtnRef = useRef<View>(null);
  const tournamentBtnRef = useRef<View>(null);
  const historyBtnRef = useRef<View>(null);
  const restartBtnRef = useRef<View>(null);
  const casaFirstEntryRef = useRef<View>(null);
  const visitFirstEntryRef = useRef<View>(null);
  const visitDeletedEntryRef = useRef<View>(null);
  const casaEyeRef = useRef<View>(null);
  // Tutorial spotlight refs — inside Add Modal
  const addModalInputRef = useRef<View>(null);
  const addModalExtraToggleRef = useRef<View>(null);
  const addModalTieBtnRef = useRef<View>(null);
  const addModalAddBtnRef = useRef<View>(null);

  const addModalOpen = addModal !== null;
  useEffect(() => {
    if (!tutorialVisible) return;
    const id = setTimeout(() => setTutorialLayerKey((k) => k + 1), 350);
    return () => clearTimeout(id);
  }, [tutorialVisible, addModalOpen]);

  // Load tutorial seen state on mount
  useEffect(() => {
    if (needsLanguageSelection) return;
    AsyncStorage.getItem("domino_tutorial_seen").then((val) => {
      if (val === null) {
        setTutorialSeen(false);
        setTutorialVisible(true);
      }
    });
  }, [needsLanguageSelection]);

  useEffect(() => {
    AsyncStorage.getItem(FAVORITE_COLORS_KEY).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setFavoriteColors(parsed.filter((color): color is string => typeof color === "string"));
        }
      } catch {}
    });
  }, []);

  // Close any modals when tutorial finishes
  useEffect(() => {
    if (!tutorialVisible) {
      setAddModal(null);
      setEditModal(null);
      setSettingsModal(false);
      setRevealedEntry(null);
    }
  }, [tutorialVisible]);

  // Open/close Add Modal automatically during tutorial steps 4-7 (input, extras, tie, add)
  useEffect(() => {
    if (!tutorialVisible) return;
    const casaId = players[0]?.id;
    if (!casaId) return;
    if (tutorialStep >= 4 && tutorialStep <= 7) {
      if (!addModal || addModal.playerId !== casaId) {
        setAddModal({ playerId: casaId });
        setPointsInput("");
        setExtraMode(false);
        setForBoth(false);
      }
    } else if (tutorialStep >= 8) {
      if (addModal !== null) {
        setAddModal(null);
        setPointsInput("");
        setExtraMode(false);
        setForBoth(false);
      }
    }
  }, [tutorialVisible, tutorialStep, players, addModal]);

  // Pre-load demo data when tutorial starts; keep it fully manual (no auto actions)
  useEffect(() => {
    if (!tutorialVisible) return;
    setSettingsModal(false);
    setHistoryModal(false);
    setRestartModal(false);
    setAddModal(null);
    setEditModal(null);
    setRevealedEntry(null);
    // Seed demo entries so the user can see all UI elements without auto-actions.
    // Order: older entries first so reversed() shows newest at top.
    const casaId = players[0]?.id;
    const visitId = players[1]?.id;
    if (!casaId || !visitId) return;
    __setState((prev) => {
      if (prev.entries.length > 0) return prev; // already seeded
      const now = Date.now();
      const demoEntries = [
        { id: `${now}-1`, playerId: casaId, points: 0, tie: true },                    // older
        { id: `${now}-2`, playerId: visitId, points: 25, deleted: true },              // older
        { id: `${now}-3`, playerId: casaId, points: 55, edited: true, history: [50] },  // newer
        { id: `${now}-4`, playerId: visitId, points: 30, extra: true },                // newer
      ];
      return { ...prev, target: 200, entries: demoEntries };
    });
  }, [tutorialVisible]);

  const tutorialSteps: TutorialStep[] = [
    { text: t.tutStep0 },                             // 0: welcome
    { targetRef: targetChip200Ref, text: t.tutStep1 }, // 1: target
    { targetRef: customTargetRef, text: t.tutStep2 },  // 2: custom target
    { targetRef: addBtnCasaRef, text: t.tutStep3 },    // 3: add button (open modal)
    { targetRef: addModalInputRef, insideModal: true, text: t.tutStep4 }, // 4: input field
    { targetRef: addModalExtraToggleRef, insideModal: true, text: t.tutStep5 }, // 5: extras toggle
    { targetRef: addModalTieBtnRef, insideModal: true, text: t.tutStep6 }, // 6: tie button
    { targetRef: addModalAddBtnRef, insideModal: true, text: t.tutStep7 }, // 7: add button
    { targetRef: casaFirstEntryRef, text: t.tutStep8 }, // 8: edit/pencil (close modal)
    { targetRef: casaEyeRef, text: t.tutStep9 },        // 9: eye reveal
    { targetRef: visitDeletedEntryRef, text: t.tutStep10 }, // 10: trash / restore
    { targetRef: historyBtnRef, text: t.tutStep11 }, // 11: history auto-save
    { targetRef: restartBtnRef, text: t.tutStep12 }, // 12: restart
    { targetRef: settingsBtnRef, text: t.tutStep13 }, // 13: settings
    { targetRef: settingsBtnRef, text: t.tutStep14 },  // 14: players/tables/photo
    { targetRef: tournamentBtnRef, text: t.tutStep15 }, // 15: tournament purpose
    { targetRef: tournamentBtnRef, text: t.tutStep16 }, // 16: tournament setup and scoring
    { targetRef: tournamentBtnRef, text: t.tutStep17 }, // 17: lives and rounds
    { text: t.tutStep18 },                             // 18: done
  ];


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

  const renderPreviousGameEntry = (game: PreviousGame, entry: ScoreEntry, num: number) => {
    const player = game.players.find((p) => p.id === entry.playerId);
    const entryKey = `${game.id}:${entry.id}`;
    const isPreviousValueVisible = revealedPreviousEntry === entryKey;
    const previousPoints = entry.history?.length
      ? entry.history[entry.history.length - 1]
      : entry.points;
    const canRevealPreviousValue = entry.edited && Boolean(entry.history?.length);

    return (
      <View key={entry.id} style={styles.entryRow}>
        <View style={styles.entryLabelsWrap}>
          <Text style={styles.entryNum}>{t.entry(num)}</Text>
          <View style={[styles.entryColorDot, { backgroundColor: player?.color ?? "#888" }]} />
          <Text style={[styles.entryPlayerName, { color: player?.color ?? "#888" }]}>
            {player ? translatePlayerName(player.name, lang) : "—"}
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
          {entry.recovered && !entry.deleted ? (
            <View style={[styles.recoveredBadge, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.recoveredBadgeText, { color: colors.primary }]}>{t.recovered}</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.entryAmountColumn}>
          <View style={styles.entryPointsRow}>
            <Text style={[styles.entryPoints, entry.deleted && styles.deletedPoints]}>
              +{entry.points}
            </Text>
            {canRevealPreviousValue ? (
              <Pressable
                style={styles.recoveredEyeButton}
                onPress={() => {
                  setRevealedPreviousEntry(isPreviousValueVisible ? null : entryKey);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${t.edited}: ${t.previous} +${previousPoints}`}
                accessibilityState={{ expanded: isPreviousValueVisible }}
                testID={`previous-value-eye-${entry.id}`}
                hitSlop={6}
              >
                <Feather
                  name={isPreviousValueVisible ? "eye-off" : "eye"}
                  size={15}
                  color={isPreviousValueVisible ? colors.primary : colors.mutedForeground}
                />
              </Pressable>
            ) : null}
          </View>
          {canRevealPreviousValue && isPreviousValueVisible ? (
            <View style={styles.entryPreviousValue}>
              <Text style={styles.entryPreviousLabel}>{t.previous}</Text>
              <Text style={styles.entryPreviousPoints}>+{previousPoints}</Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const locale: Record<Lang, string> = {
    es: "es-419",
    en: "en-US",
    pt: "pt-BR",
    fr: "fr-FR",
    it: "it-IT",
  };

  function formatDate(ts: number) {
    return new Date(ts).toLocaleString(locale[lang], {
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

  function saveFavoriteColor() {
    if (!renameModal?.color) return;
    const next = [renameModal.color, ...favoriteColors.filter((color) => color !== renameModal.color)];
    setFavoriteColors(next);
    AsyncStorage.setItem(FAVORITE_COLORS_KEY, JSON.stringify(next));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  function removeFavoriteColor(color: string) {
    const next = favoriteColors.filter((savedColor) => savedColor !== color);
    setFavoriteColors(next);
    AsyncStorage.setItem(FAVORITE_COLORS_KEY, JSON.stringify(next));
    Haptics.selectionAsync();
  }

  // ── render ─────────────────────────────────────────────────────────────────

  function renderPlayerCard(
    player: (typeof players)[number],
    fullWidth = false,
    addBtnRef?: React.RefObject<View | null>,
  ) {
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
          ref={addBtnRef}
          style={[styles.addBtn, { borderColor: player.color }]}
          onPress={() => { setAddModal({ playerId: player.id }); setPointsInput(""); setExtraMode(false); setForBoth(false); }}
        >
          <Feather name="plus" size={20} color={player.color} />
        </Pressable>

        {playerEntries.length > 0 && (
          <View style={styles.cardHistory}>
            {playerEntries.slice().reverse().map((entry, idx, arr) => (
              <HistoryEntryItem
                key={entry.id}
                entry={entry}
                num={playerEntries.length - idx}
                playerColor={player.color}
                isOpen={revealedEntry === entry.id}
                isLast={idx === arr.length - 1}
                rowRef={entry.deleted && player.id === players[1]?.id ? visitDeletedEntryRef : (idx === 0 ? (player.id === players[0]?.id ? casaFirstEntryRef : player.id === players[1]?.id ? visitFirstEntryRef : undefined) : undefined)}
                eyeRef={player.id === players[0]?.id && entry.edited ? casaEyeRef : undefined}
                onToggleReveal={() => {
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
                onEdit={() => { setEditModal({ entryId: entry.id, currentPoints: entry.points }); setEditInput(String(entry.points)); }}
                onDelete={() => { deleteEntry(entry.id); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
                t={t}
                colors={{ primary: colors.primary, mutedForeground: colors.mutedForeground, destructive: colors.destructive, foreground: colors.foreground }}
              />
            ))}
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
                ref={tv === 200 ? targetChip200Ref : undefined}
                style={[styles.targetChip, target === tv && styles.targetChipActive]}
                onPress={() => { setTarget(tv); Haptics.selectionAsync(); }}
              >
                <Text style={[styles.targetChipText, target === tv && styles.targetChipTextActive]}>
                  {tv}
                </Text>
              </Pressable>
            ))}
            <Pressable
              ref={customTargetRef}
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
              ref={tournamentBtnRef}
              style={[styles.settingsBtn, tournamentActive && styles.settingsBtnActive]}
              onPress={() => { toggleTournament(); Haptics.selectionAsync(); }}
            >
              <FontAwesome5 name="trophy" size={18} color={tournamentActive ? colors.primary : colors.mutedForeground} />
            </Pressable>
          </View>
          <Pressable ref={settingsBtnRef} style={styles.settingsBtn} onPress={() => setSettingsModal(true)}>
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
          : players.map((player, pi) => renderPlayerCard(
              player,
              players.length === 1,
              pi === 0 ? addBtnCasaRef : pi === 1 ? addBtnVisitRef : undefined,
            ))}
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
      <View style={{ gap: 10 }}>
        <View style={styles.bottomRow}>
          <Pressable ref={historyBtnRef} style={styles.historyBtn} onPress={() => setHistoryModal(true)}>
            <Feather name="archive" size={15} color={colors.mutedForeground} />
            <Text style={styles.historyBtnText}>{t.previous}</Text>
            {previousGames.length > 0 && (
              <View style={styles.historyBadge}>
                <Text style={styles.historyBadgeText}>{previousGames.length}</Text>
              </View>
            )}
          </Pressable>
          <Pressable
            ref={restartBtnRef}
            style={[styles.restartBtn, { flex: 1 }]}
            onPress={() => setRestartModal(true)}
          >
            <Feather name="rotate-ccw" size={15} color={colors.destructive} />
            <Text style={styles.restartText}>{t.restart}</Text>
          </Pressable>
        </View>
        <Pressable
          style={[styles.showTutorialBtn, { borderColor: colors.border }]}
          onPress={() => {
            setSettingsModal(false);
            setTutorialStep(0);
            setTutorialVisible(true);
          }}
        >
          <Feather name="help-circle" size={16} color={colors.mutedForeground} />
          <Text style={[styles.showTutorialText, { color: colors.mutedForeground }]}>{t.tutorialShowAgain}</Text>
        </Pressable>
      </View>
      </>
      )}

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}

      {/* Edit player (rename + color) */}
      <Modal visible={renameModal !== null} transparent animationType="fade" onRequestClose={() => setRenameModal(null)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView
            style={styles.renameModalScroll}
            contentContainerStyle={styles.renameModalScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
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
                    accessibilityRole="button"
                    accessibilityLabel={c}
                  >
                    {renameModal?.color === c && (
                      <Feather name="check" size={14} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>

              <Text style={styles.colorPickerLabel}>{t.colorWheelLabel}</Text>
              <ColorWheel
                selectedColor={renameModal?.color ?? PLAYER_COLORS[0]}
                hint={t.colorWheelHint}
                onSelect={(color) => {
                  setRenameModal((prev) => prev ? { ...prev, color } : null);
                  Haptics.selectionAsync();
                }}
              />

              <Pressable style={styles.saveFavoriteBtn} onPress={saveFavoriteColor}>
                <Feather name="star" size={15} color={colors.primary} />
                <Text style={styles.saveFavoriteText}>{t.saveFavoriteColor}</Text>
              </Pressable>

              <Text style={[styles.colorPickerLabel, styles.favoriteColorsLabel]}>{t.favoriteColors}</Text>
              {favoriteColors.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.favoriteColorsRow}
                >
                  {favoriteColors.map((color) => (
                    <View key={color} style={styles.favoriteColorItem}>
                      <Pressable
                        style={[
                          styles.favoriteColorSwatch,
                          { backgroundColor: color },
                          renameModal?.color === color && styles.colorSwatchSelected,
                        ]}
                        onPress={() => {
                          setRenameModal((prev) => prev ? { ...prev, color } : null);
                          Haptics.selectionAsync();
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={color}
                      />
                      <Pressable
                        style={styles.favoriteColorRemove}
                        onPress={() => removeFavoriteColor(color)}
                        hitSlop={6}
                        accessibilityRole="button"
                        accessibilityLabel={t.removeFavoriteColor}
                      >
                        <Feather name="x" size={9} color={colors.foreground} />
                      </Pressable>
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <Text style={styles.noFavoriteColors}>{t.noFavoriteColors}</Text>
              )}

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
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      {/* Add points */}
      <Modal visible={addModal !== null} transparent animationType="fade" onRequestClose={closeAddModal}>
        <KeyboardAvoidingView
          style={[
            styles.overlay,
            tutorialVisible && tutorialStep >= 4 && tutorialStep <= 7 && { backgroundColor: "transparent" },
          ]}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalCard}>
            {(() => {
              const p = players.find((pl) => pl.id === addModal?.playerId);
              return (
                <Text style={styles.modalTitle}>
                  {t.pointsFor} <Text style={{ color: p?.color }}>{p ? translatePlayerName(p.name, lang) : ""}</Text>
                </Text>
              );
            })()}
            <View ref={addModalInputRef} collapsable={false}>
              <TextInput
                style={[styles.modalInput, styles.transparentInput]}
                placeholder="0"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="number-pad"
                value={pointsInput}
                onChangeText={setPointsInput}
                autoFocus={!tutorialVisible}
                selectTextOnFocus={false}
                contextMenuHidden
              />
            </View>
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
              ref={addModalExtraToggleRef}
              style={[styles.extraToggleRow, styles.extraModeToggleRow]}
              onPress={() => { setExtraMode((v) => !v); Haptics.selectionAsync(); }}
            >
              <View style={[styles.extraCheckbox, extraMode && styles.extraCheckboxOn]}>
                {extraMode ? <Feather name="check" size={14} color={colors.background} /> : null}
              </View>
              <Text style={styles.extraToggleText}>{t.extraToggle}</Text>
            </Pressable>
            <Pressable ref={addModalTieBtnRef} style={styles.tieBtn} onPress={handleTie}>
              <Feather name="minus-circle" size={16} color={colors.mutedForeground} />
              <Text style={styles.tieBtnText}>{t.tie}</Text>
            </Pressable>
            <View style={styles.modalBtns}>
              <Pressable style={styles.modalCancel} onPress={closeAddModal}>
                <Text style={styles.modalCancelText}>{t.cancel}</Text>
              </Pressable>
              <Pressable
                ref={addModalAddBtnRef}
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
                <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>{t.save}</Text>
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
                <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>{t.save}</Text>
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
                                      const num = mesaEntries.length - eIdx;
                                      return renderPreviousGameEntry(game, entry, num);
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
                            const num = game.entries.length - eIdx;
                            return renderPreviousGameEntry(game, entry, num);
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
              style={[styles.modalConfirm, { backgroundColor: colors.primary, marginTop: 10, flex: 0, flexGrow: 0, flexShrink: 0, minHeight: 46, justifyContent: "center" }]}
              onPress={() => setHistoryModal(false)}
            >
              <Text style={[styles.modalConfirmText, { color: colors.primaryForeground }]}>{t.close}</Text>
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
                  {LANGUAGE_OPTIONS.map((option) => (
                    <Pressable
                      key={option.value}
                      style={[styles.langChip, lang === option.value && styles.langChipActive]}
                      onPress={() => setLang(option.value)}
                      accessibilityRole="button"
                      accessibilityLabel={`${option.flag} ${t[option.labelKey]}`}
                    >
                      <Text style={styles.langFlag}>{option.flag}</Text>
                      <Text style={[styles.langChipText, lang === option.value && styles.langChipTextActive]}>
                        {t[option.labelKey]}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* App-wide text size */}
              <View style={styles.langSection}>
                <Text style={styles.langLabel}>{t.textSizeTitle}</Text>
                <View style={styles.textSizeRow}>
                  {TEXT_SIZE_OPTIONS.map(({ value }) => {
                    const selected = textSize === value;
                    const label =
                      value === "small"
                        ? t.textSizeSmall
                        : value === "medium"
                          ? t.textSizeMedium
                          : t.textSizeLarge;
                    return (
                      <Pressable
                        key={value}
                        style={[
                          styles.textSizeChip,
                          selected && styles.textSizeChipActive,
                        ]}
                        onPress={() => {
                          setTextSize(value);
                          Haptics.selectionAsync();
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={label}
                        testID={`text-size-${value}`}
                      >
                        <Text
                          style={[
                            styles.textSizeChipText,
                            selected && styles.textSizeChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
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
              style={[styles.modalConfirm, { backgroundColor: colors.primary, marginTop: 14, flex: 0, flexGrow: 0, flexShrink: 0, minHeight: 48, justifyContent: "center", alignSelf: "center", paddingHorizontal: 56 }]}
              onPress={() => setSettingsModal(false)}
            >
              <Text style={[styles.modalConfirmText, { color: colors.primaryForeground, fontSize: 16, lineHeight: 16, includeFontPadding: false }]}>{t.done}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Tutorial overlay */}
      <TutorialOverlay
        key={tutorialLayerKey}
        visible={tutorialVisible}
        steps={tutorialSteps}
        currentStep={tutorialStep}
        onNext={() => {
          if (tutorialStep >= tutorialSteps.length - 1) {
            setTutorialVisible(false);
            setTutorialSeen(true);
            AsyncStorage.setItem("domino_tutorial_seen", "true");
          } else {
            setTutorialStep(tutorialStep + 1);
          }
        }}
        onSkip={() => {
          setTutorialVisible(false);
          setTutorialSeen(true);
          AsyncStorage.setItem("domino_tutorial_seen", "true");
        }}
        onBack={() => {
          if (tutorialStep > 0) setTutorialStep(tutorialStep - 1);
        }}
        t={t}
        colors={colors}
      />
      <LanguageSelectionModal
        visible={needsLanguageSelection}
        t={t}
        colors={colors}
        onSelect={setLang}
      />
    </View>
  );
}

function LanguageSelectionModal({
  visible,
  t,
  colors,
  onSelect,
}: {
  visible: boolean;
  t: ReturnType<typeof useLang>["t"];
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onSelect: (lang: Lang) => void;
}) {
  const styles = makeStyles(colors);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.languageWelcomeOverlay}>
        <View style={styles.languageWelcomeCard}>
          <Text style={styles.languageWelcomeTitle}>{t.firstLanguageTitle}</Text>
          <Text style={styles.languageWelcomeSubtitle}>{t.firstLanguageSubtitle}</Text>
          <View style={styles.languageWelcomeGrid}>
            {LANGUAGE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={styles.languageWelcomeOption}
                onPress={() => onSelect(option.value)}
                accessibilityRole="button"
                accessibilityLabel={`${option.flag} ${t[option.labelKey]}`}
              >
                <Text style={styles.languageWelcomeFlag}>{option.flag}</Text>
                <Text style={styles.languageWelcomeName}>{t[option.labelKey]}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
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
      minHeight: 42,
      paddingVertical: 4,
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
      alignItems: "flex-start",
      paddingVertical: 6,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      gap: 6,
    },
    entryLabelsWrap: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
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
      flexShrink: 1,
      minWidth: 40,
    },
    entryAmountColumn: {
      alignItems: "flex-end",
      flexShrink: 0,
    },
    entryPointsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
    },
    entryPoints: {
      fontFamily: "Inter_700Bold",
      fontSize: 14,
      color: colors.foreground,
      minWidth: 36,
      textAlign: "right",
    },
    recoveredEyeButton: {
      minWidth: 24,
      minHeight: 24,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 6,
    },
    entryPreviousValue: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 4,
      paddingTop: 1,
    },
    entryPreviousLabel: {
      color: colors.mutedForeground,
      fontFamily: "Inter_400Regular",
      fontSize: 10,
    },
    entryPreviousPoints: {
      color: colors.mutedForeground,
      fontFamily: "Inter_600SemiBold",
      fontSize: 11,
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
    languageWelcomeOverlay: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.78)",
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 18,
    },
    languageWelcomeCard: {
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.card,
      borderRadius: 24,
      padding: 24,
      borderWidth: 1,
      borderColor: colors.border,
    },
    languageWelcomeTitle: {
      fontFamily: "Inter_700Bold",
      fontSize: 23,
      color: colors.foreground,
      textAlign: "center",
      marginBottom: 8,
    },
    languageWelcomeSubtitle: {
      fontFamily: "Inter_400Regular",
      fontSize: 14,
      lineHeight: 20,
      color: colors.mutedForeground,
      textAlign: "center",
      marginBottom: 22,
    },
    languageWelcomeGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      gap: 10,
    },
    languageWelcomeOption: {
      width: "48%",
      minHeight: 82,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 10,
    },
    languageWelcomeFlag: {
      fontSize: 29,
      lineHeight: 34,
      marginBottom: 4,
    },
    languageWelcomeName: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.foreground,
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
    renameModalScroll: {
      width: "100%",
    },
    renameModalScrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingVertical: 18,
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
    saveFavoriteBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 11,
      paddingVertical: 10,
      marginBottom: 14,
    },
    saveFavoriteText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.primary,
    },
    favoriteColorsLabel: {
      marginBottom: 8,
    },
    favoriteColorsRow: {
      gap: 13,
      paddingTop: 2,
      paddingHorizontal: 3,
      paddingBottom: 16,
    },
    favoriteColorItem: {
      width: 38,
      height: 43,
      alignItems: "center",
      position: "relative",
    },
    favoriteColorSwatch: {
      width: 34,
      height: 34,
      borderRadius: 17,
      borderWidth: 2,
      borderColor: colors.card,
    },
    favoriteColorRemove: {
      position: "absolute",
      right: -4,
      top: -4,
      width: 16,
      height: 16,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.border,
    },
    noFavoriteColors: {
      fontFamily: "Inter_400Regular",
      fontSize: 12,
      color: colors.mutedForeground,
      textAlign: "center",
      marginBottom: 16,
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
      flexWrap: "wrap",
      gap: 8,
    },
    langChip: {
      width: "31%",
      flexGrow: 0,
      flexShrink: 0,
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
    langFlag: {
      fontSize: 20,
      lineHeight: 24,
      marginBottom: 3,
    },
    langChipTextActive: {
      color: colors.primary,
    },
    textSizeRow: {
      flexDirection: "row",
      gap: 8,
    },
    textSizeChip: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 4,
      paddingVertical: 9,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
    },
    textSizeChipActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + "22",
    },
    textSizeChipText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 13,
      color: colors.mutedForeground,
      textAlign: "center",
    },
    textSizeChipTextActive: {
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
      minWidth: 40,
      minHeight: 40,
      paddingHorizontal: 8,
      paddingVertical: 7,
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
    extraModeToggleRow: {
      transform: [{ translateY: -10 }],
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
    recoveredBadge: {
      backgroundColor: colors.primary + "20",
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
      marginLeft: 2,
    },
    recoveredBadgeText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 9,
      color: colors.primary,
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
      marginTop: 0,
      transform: [{ translateY: -10 }],
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
    historyPanel: {
      overflow: "hidden",
      paddingLeft: 24,
      paddingRight: 10,
      gap: 2,
    },
    historyPanelRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 2,
    },
    historyPanelLabel: {
      fontFamily: "Inter_400Regular",
      fontSize: 11,
      color: colors.mutedForeground,
    },
    historyPanelValue: {
      fontFamily: "Inter_700Bold",
      fontSize: 13,
      color: "#fff",
      textAlign: "right",
    },
    showTutorialBtn: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      marginTop: 14,
      paddingVertical: 12,
      borderRadius: 10,
      borderWidth: 1.5,
    },
    showTutorialText: {
      fontFamily: "Inter_600SemiBold",
      fontSize: 14,
    },
  });
}
