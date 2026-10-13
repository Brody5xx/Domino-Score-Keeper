import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  View,
} from "react-native";
import { ScaledText as Text } from "@/components/ScaledText";
import type { Translations } from "@/constants/translations";
import { useColors } from "@/hooks/useColors";

const SCREEN = Dimensions.get("window");

export interface TutorialStep {
  targetRef?: React.RefObject<View | null>;
  text: string;
  actionDelay?: number;
  autoAdvanceDelay?: number;
}

interface TutorialOverlayProps {
  visible: boolean;
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  onBack?: () => void;
  t: Translations;
  colors: ReturnType<typeof useColors>;
}

export default function TutorialOverlay({
  visible,
  steps,
  currentStep,
  onNext,
  onSkip,
  onBack,
  t,
  colors,
}: TutorialOverlayProps) {
  const [targetLayout, setTargetLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;
  const containerRef = useRef<View>(null);
  const step = steps[currentStep];

  useEffect(() => {
    if (!visible || !step?.targetRef) {
      setTargetLayout(null);
      return;
    }
    const measure = () => {
      if (!step.targetRef?.current) return;
      step.targetRef.current.measureInWindow((x, y, width, height) => {
        if (width <= 0 || height <= 0) return;
        // En Android, measureInWindow no cuenta la barra de estado (hora/bateria)
        // pero la capa del tutorial si empieza en el borde de la pantalla.
        // Sumamos esa altura para que el recuadro caiga encima del boton.
        const statusBar =
          Platform.OS === "android" ? (StatusBar.currentHeight ?? 0) : 0;
        const apply = (ox: number, oy: number) =>
          setTargetLayout({
            x: x - ox,
            y: y - oy + statusBar,
            width,
            height,
          });
        if (containerRef.current) {
          containerRef.current.measureInWindow((cx, cy) => apply(cx, cy));
        } else {
          apply(0, 0);
        }
      });
    };
    measure();
    const id = setInterval(measure, 300);
    return () => clearInterval(id);
  }, [visible, step, currentStep]);

  useEffect(() => {
    if (!visible) return;
    pulse.setValue(1);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.15,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    return () => { pulse.stopAnimation(); };
  }, [visible, currentStep]);

  const tooltipLayout = useCallback(() => {
    const bottomOffset =
      step.text.length > 150 ? 290 : step.text.length > 110 ? 260 : 210;
    // Fallback when measure fails (e.g. elements inside ScrollView):
    // always place tooltip at bottom since most tutorial targets are upper-screen.
    if (!targetLayout) return { top: SCREEN.height - bottomOffset, arrowAtTop: true };
    const targetCenter = targetLayout.y + targetLayout.height / 2;
    // If target is in upper half, place tooltip at bottom so user sees changes
    if (targetCenter < SCREEN.height * 0.5) {
      return { top: SCREEN.height - bottomOffset, arrowAtTop: true };
    }
    // Target in lower half: place tooltip at top
    return { top: 20, arrowAtTop: false };
  }, [targetLayout, step?.text]);

  if (!visible || !step) return null;

  const showNav = currentStep >= 0;
  const isLast = currentStep >= steps.length - 1;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View ref={containerRef} collapsable={false} style={styles.container} pointerEvents="box-none">
        {/* Dark overlay with spotlight cutout */}
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          <View style={StyleSheet.absoluteFill}>
            {targetLayout && (
              <>
                <View style={[styles.darkBand, { top: 0, height: targetLayout.y }]} />
                <View style={[styles.darkBand, { top: targetLayout.y + targetLayout.height, bottom: 0 }]} />
                <View style={[styles.darkSide, { left: 0, top: targetLayout.y, width: targetLayout.x, height: targetLayout.height }]} />
                <View style={[styles.darkSide, { left: targetLayout.x + targetLayout.width, top: targetLayout.y, right: 0, height: targetLayout.height }]} />
              </>
            )}
            {!targetLayout && <View style={styles.fullDark} />}
          </View>

          {/* Spotlight border + pulse dot */}
          {targetLayout && (
            <Animated.View
              style={[
                styles.spotlightBorder,
                {
                  left: targetLayout.x - 4,
                  top: targetLayout.y - 4,
                  width: targetLayout.width + 8,
                  height: targetLayout.height + 8,
                  borderColor: colors.primary,
                  transform: [{ scale: pulse }],
                },
              ]}
            >
              <View style={[styles.pulseDot, { backgroundColor: colors.primary }]} />
            </Animated.View>
          )}
        </View>

        {/* Tooltip */}
        {(() => {
          const { top } = tooltipLayout();
          return (
        <View
          style={[
            styles.tooltip,
            {
              top,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
          pointerEvents="auto"
        >
          <Text style={[styles.tooltipText, { color: colors.foreground }]}>
            {step.text}
          </Text>

          <View style={styles.btnRow}>
            {showNav && currentStep > 0 && onBack && (
              <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.border }]} onPress={onBack}>
                <Text style={[styles.btnText, { color: colors.mutedForeground }]}>{t.tutorialBack}</Text>
              </Pressable>
            )}
            {!isLast && (
              <Pressable style={[styles.btn, styles.btnOutline, { borderColor: colors.border }]} onPress={onSkip}>
                <Text style={[styles.btnText, { color: colors.mutedForeground }]}>{t.tutorialSkip}</Text>
              </Pressable>
            )}
            <Pressable
              style={[
                styles.btn,
                isLast ? { backgroundColor: colors.primary } : styles.btnOutline,
                { borderColor: colors.border },
              ]}
              onPress={isLast ? onSkip : onNext}
            >
              <Text style={[styles.btnText, { color: isLast ? "#fff" : colors.foreground }]}>
                {isLast ? t.tutorialDone : t.tutorialNext}
              </Text>
            </Pressable>
          </View>

          {/* Step dots */}
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === currentStep && { backgroundColor: colors.primary, width: 14 },
                  i !== currentStep && { backgroundColor: colors.mutedForeground + "55" },
                ]}
              />
            ))}
          </View>
        </View>
          );
        })()}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: SCREEN.width,
    height: SCREEN.height,
  },
  darkBand: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  darkSide: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  fullDark: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  spotlightBorder: {
    position: "absolute",
    borderWidth: 2.5,
    borderRadius: 14,
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    position: "absolute",
    right: -10,
    top: -10,
  },
  tooltip: {
    position: "absolute",
    left: 20,
    right: 20,
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    alignItems: "center",
  },
  tooltipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 14,
  },
  btnRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "center",
    width: "100%",
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    maxWidth: 140,
  },
  btnOutline: {
    backgroundColor: "transparent",
  },
  btnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 5,
    marginTop: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
