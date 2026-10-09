import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type TextSize = "small" | "medium" | "large";

export const TEXT_SIZE_OPTIONS: Array<{ value: TextSize; scale: number }> = [
  { value: "small", scale: 0.9 },
  { value: "medium", scale: 1 },
  { value: "large", scale: 1.16 },
];

const STORAGE_KEY = "domino_text_size_v1";

interface TextSizeContextValue {
  textSize: TextSize;
  scale: number;
  setTextSize: (size: TextSize) => void;
}

const TextSizeContext = createContext<TextSizeContextValue | null>(null);

function isTextSize(value: string | null): value is TextSize {
  return value === "small" || value === "medium" || value === "large";
}

export function TextSizeProvider({ children }: { children: React.ReactNode }) {
  const [textSize, setTextSizeState] = useState<TextSize>("medium");
  const userChangedSize = useRef(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((storedSize) => {
        if (mounted && !userChangedSize.current && isTextSize(storedSize)) {
          setTextSizeState(storedSize);
        }
      })
      .catch((error) => {
        console.warn("Unable to load the saved text size preference.", error);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const setTextSize = useCallback((size: TextSize) => {
    userChangedSize.current = true;
    setTextSizeState(size);
    AsyncStorage.setItem(STORAGE_KEY, size).catch((error) => {
      console.warn("Unable to save the text size preference.", error);
    });
  }, []);

  const scale =
    TEXT_SIZE_OPTIONS.find((option) => option.value === textSize)?.scale ?? 1;
  const value = useMemo(
    () => ({ textSize, scale, setTextSize }),
    [textSize, scale, setTextSize],
  );

  return (
    <TextSizeContext.Provider value={value}>
      {children}
    </TextSizeContext.Provider>
  );
}

export function useTextSize() {
  const context = useContext(TextSizeContext);
  if (!context) {
    throw new Error("useTextSize must be used within TextSizeProvider");
  }
  return context;
}