import React, {
  createContext,
  forwardRef,
  useContext,
} from "react";
import {
  Text as NativeText,
  TextInput as NativeTextInput,
  StyleSheet,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from "react-native";
import { useTextSize } from "@/context/TextSizeContext";

const InheritedFontSizeContext = createContext<number | null>(null);

function scaledTextStyle(
  style: StyleProp<TextStyle> | undefined,
  scale: number,
  inheritedFontSize: number | null,
) {
  const flattenedStyle = StyleSheet.flatten(style);
  const styledFontSize = flattenedStyle?.fontSize;
  const baseFontSize =
    typeof styledFontSize === "number"
      ? styledFontSize
      : inheritedFontSize ?? 14;
  const styledLineHeight = flattenedStyle?.lineHeight;

  return {
    baseFontSize,
    style: [
      style,
      {
        fontSize: baseFontSize * scale,
        ...(typeof styledLineHeight === "number"
          ? { lineHeight: styledLineHeight * scale }
          : {}),
      },
    ],
  };
}

export const ScaledText = forwardRef<
  React.ElementRef<typeof NativeText>,
  TextProps
>(function ScaledText({ children, style, ...props }, ref) {
  const { scale } = useTextSize();
  const inheritedFontSize = useContext(InheritedFontSizeContext);
  const scaled = scaledTextStyle(style, scale, inheritedFontSize);

  return (
    <NativeText ref={ref} {...props} style={scaled.style}>
      <InheritedFontSizeContext.Provider value={scaled.baseFontSize}>
        {children}
      </InheritedFontSizeContext.Provider>
    </NativeText>
  );
});

export const ScaledTextInput = forwardRef<
  React.ElementRef<typeof NativeTextInput>,
  TextInputProps
>(function ScaledTextInput({ style, ...props }, ref) {
  const { scale } = useTextSize();
  const flattenedStyle = StyleSheet.flatten(style);
  const fontSize =
    typeof flattenedStyle?.fontSize === "number" ? flattenedStyle.fontSize : 14;
  const lineHeight = flattenedStyle?.lineHeight;

  return (
    <NativeTextInput
      ref={ref}
      {...props}
      style={[
        style,
        {
          fontSize: fontSize * scale,
          ...(typeof lineHeight === "number"
            ? { lineHeight: lineHeight * scale }
            : {}),
        },
      ]}
    />
  );
});