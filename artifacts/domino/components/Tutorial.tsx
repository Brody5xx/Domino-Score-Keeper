import React, { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import type { Translations } from "@/constants/translations";
import { useColors } from "@/hooks/useColors";

interface TutorialProps {
  visible: boolean;
  onClose: () => void;
  step: number;
  onStepChange: (step: number) => void;
  t: Translations;
  colors: ReturnType<typeof useColors>;
}

const TOTAL_STEPS = 7;

export default function Tutorial({ visible, onClose, step, onStepChange, t, colors }: TutorialProps) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
    return () => {
      slideAnim.setValue(0);
    };
  }, [step]);

  const titles = [
    t.tutorialStep1Title,
    t.tutorialStep2Title,
    t.tutorialStep3Title,
    t.tutorialStep4Title,
    t.tutorialStep5Title,
    t.tutorialStep6Title,
    t.tutorialStep7Title,
  ];
  const bodies = [
    t.tutorialStep1Body,
    t.tutorialStep2Body,
    t.tutorialStep3Body,
    t.tutorialStep4Body,
    t.tutorialStep5Body,
    t.tutorialStep6Body,
    t.tutorialStep7Body,
  ];

  const canGoBack = step > 0;
  const canGoNext = step < TOTAL_STEPS - 1;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: "#000000CC" }]}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              transform: [
                {
                  translateY: slideAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [40, 0],
                  }),
                },
              ],
              opacity: slideAnim,
            },
          ]}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.foreground }]}>{titles[step]}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.bodyScroll}>
            <Text style={[styles.body, { color: colors.mutedForeground }]}>{bodies[step]}</Text>
          </ScrollView>

          {/* Step dots */}
          <View style={styles.dotsRow}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  {
                    backgroundColor:
                      i === step ? colors.primary : colors.mutedForeground + "44",
                  },
                ]}
              />
            ))}
          </View>

          {/* Buttons */}
          <View style={styles.btnsRow}>
            {canGoBack ? (
              <Pressable
                style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                onPress={() => onStepChange(step - 1)}
              >
                <Text style={[styles.btnTextSecondary, { color: colors.mutedForeground }]}>
                  {t.tutorialBack}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.btn, styles.btnSecondary, { borderColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.btnTextSecondary, { color: colors.mutedForeground }]}>
                  {t.tutorialSkip}
                </Text>
              </Pressable>
            )}

            {canGoNext ? (
              <Pressable
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                onPress={() => onStepChange(step + 1)}
              >
                <Text style={[styles.btnTextPrimary, { color: colors.primaryForeground }]}>
                  {t.tutorialNext}
                </Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.btn, styles.btnPrimary, { backgroundColor: colors.primary }]}
                onPress={onClose}
              >
                <Text style={[styles.btnTextPrimary, { color: colors.primaryForeground }]}>
                  {t.tutorialDone}
                </Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxHeight: "75%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  title: {
    fontFamily: "Inter_700Bold",
    fontSize: 18,
    flex: 1,
    lineHeight: 24,
  },
  bodyScroll: {
    maxHeight: 260,
  },
  body: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    lineHeight: 22,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  btnsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    paddingTop: 4,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  btnPrimary: {
    borderWidth: 0,
  },
  btnSecondary: {
    backgroundColor: "transparent",
  },
  btnTextPrimary: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  btnTextSecondary: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
