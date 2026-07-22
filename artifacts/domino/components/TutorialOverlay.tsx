"use no memo";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { Translations } from "@/constants/translations";
import { useColors } from "@/hooks/useColors";

const SCREEN = Dimensions.get("window");

export interface TutorialStep {
  targetRef?: React.RefObject<View | null>;
  text: string;
  action?: () => void;
  actionDelay?: number;
  autoAdvanceDelay?: number; // ms after action to auto-call onNext
}

interface TutorialOverlayProps {
  visible: boolean;
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  t: Translations;
  colors: ReturnType<typeof useColors>;
}

interface TargetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export default function TutorialOverlay({
  visible,
  steps,
  currentStep,
  onNext,
  onSkip,
  t,
  colors,
}: TutorialOverlayProps) {
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState<"top" | "bottom">("bottom");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const onNextRef = useRef(onNext);
  onNextRef.current = onNext;

  const measureTarget = useCallback(
    (ref: React.RefObject<View | null>) => {
      if (!ref.current) {
        setTargetRect(null);
        return;
      }
      (ref.current as any).measureInWindow(
        (x: number, y: number, width: number, height: number) => {
          const rect = { x, y, width, height };
          setTargetRect(rect);
          const screenCenterY = SCREEN.height / 2;
          setTooltipPos(y + height / 2 > screenCenterY ? "top" : "bottom");
        }
      );
    },
    []
  );

  useEffect(() => {
    if (!visible) {
      setTargetRect(null);
      return;
    }
    const step = steps[currentStep];
    if (step?.targetRef) {
      const timer = setTimeout(() => measureTarget(step.targetRef!), 150);
      return () => clearTimeout(timer);
    } else {
      setTargetRect(null);
    }
  }, [visible, currentStep, steps, measureTarget]);

  useEffect(() => {
    if (!visible) {
      fadeAnim.setValue(0);
      return;
    }
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [visible, currentStep, fadeAnim]);

  // Execute step action (app presses button automatically) then optionally auto-advance
  const executedStepRef = useRef<number>(-1);
  useEffect(() => {
    if (!visible) {
      executedStepRef.current = -1;
      return;
    }
    const step = steps[currentStep];
    if (!step?.action) return;
    if (executedStepRef.current === currentStep) return; // already ran for this step
    executedStepRef.current = currentStep;
    const delay = step.actionDelay ?? 0;
    const actionTimer = setTimeout(() => {
      step.action?.();
      if (typeof step.autoAdvanceDelay === "number" && step.autoAdvanceDelay >= 0) {
        const advanceTimer = setTimeout(() => {
          onNextRef.current();
        }, step.autoAdvanceDelay);
        timersRef.current.push(advanceTimer);
      }
    }, delay);
    timersRef.current.push(actionTimer);
    return () => {
      timersRef.current.forEach(clearTimeout);
      timersRef.current = [];
    };
  }, [visible, currentStep, steps]);

  if (!visible || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const hasTarget = targetRect !== null;
  const padding = 8;

  // Cutout coords
  const cx = hasTarget ? targetRect!.x - padding : 0;
  const cy = hasTarget ? targetRect!.y - padding : 0;
  const cw = hasTarget ? targetRect!.width + padding * 2 : SCREEN.width;
  const ch = hasTarget ? targetRect!.height + padding * 2 : SCREEN.height;

  const topBarH = Math.max(0, cy);
  const bottomBarY = Math.min(SCREEN.height, cy + ch);
  const leftBarW = hasTarget ? Math.max(0, cx) : 0;
  const rightBarX = hasTarget ? Math.min(SCREEN.width, cx + cw) : SCREEN.width;
  const midBarH = hasTarget ? Math.max(0, ch) : 0;

  // Tooltip placement
  const tooltipBelow = cy + ch + 24;
  const tooltipAbove = cy - 150;
  let tooltipY = hasTarget
    ? (tooltipPos === "bottom" ? tooltipBelow : tooltipAbove)
    : SCREEN.height / 2 - 100;
  tooltipY = Math.max(60, Math.min(tooltipY, SCREEN.height - 200));

  return (
    <Modal visible={visible} transparent animationType="none">
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="auto">
          {/* Top bar */}
          <View style={[styles.bar, { top: 0, left: 0, right: 0, height: topBarH }]} />
          {/* Bottom bar */}
          <View style={[styles.bar, { top: bottomBarY, left: 0, right: 0, bottom: 0 }]} />
          {/* Left middle bar */}
          <View style={[styles.bar, { top: topBarH, left: 0, width: leftBarW, height: midBarH }]} />
          {/* Right middle bar */}
          <View style={[styles.bar, { top: topBarH, left: rightBarX, right: 0, height: midBarH }]} />

          {/* Glow border + pulsing dot around target */}
          {hasTarget && (
            <>
              <View style={{
                position: "absolute",
                left: cx, top: cy, width: cw, height: ch,
                borderWidth: 3, borderColor: colors.primary,
                borderRadius: 14, backgroundColor: "transparent",
              }} />
              <View style={{
                position: "absolute",
                left: cx + 2, top: cy + 2,
                width: cw - 4, height: ch - 4,
                borderWidth: 1, borderColor: colors.primary + "66",
                borderRadius: 12, backgroundColor: "transparent",
              }} />
              <PulsingDot x={cx + cw / 2} y={cy + ch / 2} color={colors.primary} />
            </>
          )}

          {/* Tooltip card */}
          <View style={[
            styles.tooltip,
            {
              top: tooltipY,
              left: 22, right: 22,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}>
            {hasTarget && (
              <View style={[
                styles.arrow,
                tooltipPos === "bottom"
                  ? {
                      top: -10,
                      borderBottomColor: colors.card,
                      borderTopColor: "transparent",
                      borderLeftColor: "transparent",
                      borderRightColor: "transparent",
                    }
                  : {
                      bottom: -10,
                      borderTopColor: colors.card,
                      borderBottomColor: "transparent",
                      borderLeftColor: "transparent",
                      borderRightColor: "transparent",
                    },
              ]} />
            )}

            <Text style={[styles.tooltipText, { color: colors.foreground }]}>
              {step.text}
            </Text>

            <View style={styles.tooltipBtns}>
              <Pressable
                style={[styles.tooltipBtn, styles.tooltipBtnSecondary, { borderColor: colors.border }]}
                onPress={onSkip}
              >
                <Text style={[styles.tooltipBtnText, { color: colors.mutedForeground }]}>
                  {t.tutorialSkip}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.tooltipBtn, styles.tooltipBtnPrimary, { backgroundColor: colors.primary }]}
                onPress={onNext}
              >
                <Text style={[styles.tooltipBtnText, { color: colors.primaryForeground }]}>
                  {currentStep < steps.length - 1 ? t.tutorialNext : t.tutorialDone}
                </Text>
              </Pressable>
            </View>

            <View style={styles.dotsRow}>
              {steps.map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    {
                      backgroundColor:
                        i === currentStep ? colors.primary : colors.mutedForeground + "44",
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function PulsingDot({ x, y, color }: { x: number; y: number; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 2.5, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 900, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.6, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [scale, opacity]);

  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x - 14, top: y - 14,
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: color,
        transform: [{ scale }], opacity,
      }}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  tooltip: {
    position: "absolute",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
    gap: 14,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 20,
  },
  arrow: {
    position: "absolute",
    width: 0, height: 0,
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    alignSelf: "center",
  },
  tooltipText: {
    fontFamily: "Inter_500Medium",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  tooltipBtns: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  tooltipBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
  },
  tooltipBtnPrimary: {
    borderWidth: 0,
  },
  tooltipBtnSecondary: {
    backgroundColor: "transparent",
  },
  tooltipBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
