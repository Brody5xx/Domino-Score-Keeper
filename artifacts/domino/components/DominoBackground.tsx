import React from "react";
import { ImageBackground, StyleSheet, View, type ImageSourcePropType } from "react-native";
import { useGame } from "@/context/GameContext";

const IMAGES: Record<string, ImageSourcePropType> = {
  whiskey: require("../assets/backgrounds/whiskey.png"),
  wood: require("../assets/backgrounds/wood.png"),
  chain: require("../assets/backgrounds/chain.png"),
  marble: require("../assets/backgrounds/marble.png"),
  neon: require("../assets/backgrounds/neon.png"),
};

// Overlay opacity per theme so the UI stays readable over each photo.
const OVERLAY: Record<string, string> = {
  whiskey: "rgba(15,15,20,0.55)",
  wood: "rgba(15,15,20,0.58)",
  chain: "rgba(15,15,20,0.45)",
  marble: "rgba(15,15,20,0.52)",
  neon: "rgba(15,15,20,0.50)",
};

export default function DominoBackground() {
  const { bgTheme } = useGame();
  const source = IMAGES[bgTheme] ?? IMAGES.whiskey;
  const overlay = OVERLAY[bgTheme] ?? "rgba(15,15,20,0.55)";

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <ImageBackground source={source} style={StyleSheet.absoluteFill} resizeMode="cover">
        <View style={[StyleSheet.absoluteFill, { backgroundColor: overlay }]} />
      </ImageBackground>
    </View>
  );
}
