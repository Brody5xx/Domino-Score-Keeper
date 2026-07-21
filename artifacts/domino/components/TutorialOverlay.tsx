import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Translations } from "@/constants/translations";
import { useColors } from "@/hooks/useColors";

const SCREEN = Dimensions.get("window");

interface TutorialStep {
  targetRef?: React.RefObject<View | null>;
  text: string;
  action?: () => void;
  actionDelay?: number;
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
  const actionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          // Decide tooltip position: if target is in bottom half, tooltip goes above
          const screenCenterY = SCREEN.height / 2;
          setTooltipPos(y + height / 2 > screenCenterY ? "top" : "bottom");
        }
      );
    },
    []
  );

  // Measure target when step changes
  useEffect(() => {
    if (!visible) {
      setTargetRect(null);
      return;
    }
    const step = steps[currentStep];
    if (step?.targetRef) {
      // Small delay to allow layout to settle
      const timer = setTimeout(() => measureTarget(step.targetRef!), 100);
      return () => clearTimeout(timer);
    } else {
      setTargetRect(null);
    }
  }, [visible, currentStep, steps, measureTarget]);

  // Fade animation on step change
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

  // Execute auto-action after delay
  useEffect(() => {
    if (!visible) return;
    const step = steps[currentStep];
    if (step?.action && typeof step.actionDelay === "number") {
      actionTimerRef.current = setTimeout(() => {
        step.action?.();
      }, step.actionDelay);
    }
    return () => {
      if (actionTimerRef.current) {
        clearTimeout(actionTimerRef.current);
        actionTimerRef.current = null;
      }
    };
  }, [visible, currentStep, steps]);

  if (!visible || currentStep >= steps.length) return null;

  const step = steps[currentStep];
  const padding = 6;

  // Cutout coordinates (relative to screen)
  const cx = targetRect ? targetRect.x - padding : SCREEN.width / 2 - 60;
  const cy = targetRect ? targetRect.y - padding : SCREEN.height / 2 - 30;
  const cw = targetRect ? targetRect.width + padding * 2 : 120;
  const ch = targetRect ? targetRect.height + padding * 2 : 60;

  const topBarH = Math.max(0, cy);
  const bottomBarY = Math.min(SCREEN.height, cy + ch);
  const leftBarW = Math.max(0, cx);
  const rightBarX = Math.min(SCREEN.width, cx + cw);
  const midBarH = Math.max(0, ch);

  // Tooltip position
  const tooltipBelow = cy + ch + 20;
  const tooltipAbove = cy - 140;
  const tooltipY = tooltipPos === "bottom" ? tooltipBelow : tooltipAbove;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dark overlay with cutout */}
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]} pointerEvents="auto">
        {/* Top dark bar */}
        <View style={[styles.bar, { top: 0, left: 0, right: 0, height: topBarH }]} />
        {/* Bottom dark bar */}
        <View style={[styles.bar, { top: bottomBarY, left: 0, right: 0, bottom: 0 }]} />
        {/* Left dark bar (mid section) */}
        <View style={[styles.bar, { top: topBarH, left: 0, width: leftBarW, height: midBarH }]} />
        {/* Right dark bar (mid section) */}
        <View style={[styles.bar, { top: topBarH, left: rightBarX, right: 0, height: midBarH }]} />

        {/* Highlight border around target */}
        {targetRect && (
          <View
            style={{
              position: "absolute",
              left: cx,
              top: cy,
              width: cw,
              height: ch,
              borderWidth: 3,
              borderColor: colors.primary,
              borderRadius: 12,
              backgroundColor: "transparent",
            }}
          />
        )}

        {/* Pulsing circle indicator on target center */}
        {targetRect && <PulsingDot x={cx + cw / 2} y={cy + ch / 2} color={colors.primary} />}

        {/* Tooltip card */}
        <View
          style={[
            styles.tooltip,
            {
              top: Math.max(16, Math.min(tooltipY, SCREEN.height - 180)),
              left: 24,
              right: 24,
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          {/* Arrow pointing to target */}
          <View
            style={[
              styles.arrow,
              tooltipPos === "bottom"
                ? { top: -8, borderBottomColor: colors.card }
                : { bottom: -8, borderTopColor: colors.card },
              tooltipPos === "bottom"
                ? { borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: "transparent" }
                : { borderLeftColor: "transparent", borderRightColor: "transparent", borderBottomColor: "transparent" },
            ]}
          />

          <Text style={[styles.tooltipText, { color: colors.foreground }]}>
            {step.text}
          </Text>

          {/* Navigation buttons */}
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

          {/* Step dots */}
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
  );
}

function PulsingDot({ x, y, color }: { x: number; y: number; color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 2, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 0, useNativeDriver: true }),
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
        left: x - 12,
        top: y - 12,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: color,
        transform: [{ scale }],
        opacity,
      }}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    backgroundColor: "rgba(0,0,0,0.78)",
  },
  tooltip: {
    position: "absolute",
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    gap: 14,
    alignItems: "center",
  },
  arrow: {
    position: "absolute",
    width: 0,
    height: 0,
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
