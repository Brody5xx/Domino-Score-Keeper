import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Rect } from "react-native-svg";
import { useGame } from "@/context/GameContext";

// ── pip layouts ────────────────────────────────────────────────────────────────
const PIPS: Record<number, [number, number][]> = {
  0: [],
  1: [[9, 9]],
  2: [[4, 4], [14, 14]],
  3: [[4, 4], [9, 9], [14, 14]],
  4: [[4, 4], [14, 4], [4, 14], [14, 14]],
  5: [[4, 4], [14, 4], [9, 9], [4, 14], [14, 14]],
  6: [[4, 3], [14, 3], [4, 9], [14, 9], [4, 15], [14, 15]],
};

const W = 62, H = 30, R = 5, PAD = 6;

type TileData = [number, number, number, number, number, number];

function DominoTile({
  x, y, angle, v1, v2, scale = 1,
}: {
  x: number; y: number; angle: number;
  v1: number; v2: number; scale?: number;
}) {
  return (
    <G transform={`translate(${x},${y}) rotate(${angle}) scale(${scale}) translate(${-W / 2},${-H / 2})`}>
      <Rect x={0} y={0} width={W} height={H} rx={R} ry={R}
        fill="#24243A" stroke="#484870" strokeWidth={1.2} />
      <Line x1={W / 2} y1={4} x2={W / 2} y2={H - 4} stroke="#484870" strokeWidth={1} />
      {PIPS[v1]?.map(([px, py], i) => (
        <Circle key={`l${i}`} cx={PAD + px} cy={PAD + py} r={2.2} fill="#606090" />
      ))}
      {PIPS[v2]?.map(([px, py], i) => (
        <Circle key={`r${i}`} cx={W / 2 + PAD + px} cy={PAD + py} r={2.2} fill="#606090" />
      ))}
    </G>
  );
}

// ── theme generators ───────────────────────────────────────────────────────────

const SCATTER_TILES: TileData[] = [
  [-12,  70, -28, 6, 3, 1.15], [130,  28,  14, 2, 5, 0.90],
  [310,  90, -42, 5, 4, 1.05], [420,  35,  22, 1, 6, 0.85],
  [ 55, 190,  36, 4, 2, 1.10], [210, 155, -18, 6, 1, 0.95],
  [370, 215,  -8, 3, 3, 1.00], [  0, 330,  12, 5, 5, 0.88],
  [185, 310,  48, 2, 6, 1.20], [395, 340, -35, 4, 1, 0.92],
  [ 85, 450, -22, 6, 6, 1.08], [260, 430,  30, 1, 4, 0.87],
  [445, 480, -14, 3, 2, 1.00], [ 20, 560,  42, 5, 3, 0.95],
  [195, 555, -10, 2, 2, 1.12], [375, 600,  25, 6, 4, 0.90],
  [ 95, 680, -32, 4, 5, 1.05], [290, 710,  16, 1, 3, 0.88],
  [440, 745, -20, 6, 2, 1.00], [160, 805,  38, 3, 6, 0.94],
];

const VALS: [number, number][] = [
  [6,3],[2,5],[5,4],[1,6],[3,3],[6,1],[4,2],[5,5],[2,6],
  [1,1],[3,6],[4,3],[6,2],[5,0],[2,4],[0,6],[3,5],[1,4],
  [4,4],[0,5],[3,2],[6,6],[5,1],[2,2],[4,6],[1,3],[0,4],
];

function generateDiagonalTiles(): TileData[] {
  const tiles: TileData[] = [];
  const angle = 42;
  const [sx, sy] = [62, 55];
  const [px, py] = [-67, 74];
  for (let s = 0; s < 3; s++) {
    for (let i = 0; i < 9; i++) {
      const [v1, v2] = VALS[(s * 9 + i) % VALS.length];
      tiles.push([-10 + s * px + i * sx, -15 + s * py + i * sy, angle, v1, v2, 0.95]);
    }
  }
  return tiles;
}

function generateGridTiles(): TileData[] {
  const tiles: TileData[] = [];
  const [cols, rows] = [6, 13];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const [v1, v2] = VALS[(r * cols + c) % VALS.length];
      tiles.push([25 + c * 72, 25 + r * 68, (r + c) % 2 === 0 ? 0 : 90, v1, v2, 0.60]);
    }
  }
  return tiles;
}

function generateRadialTiles(): TileData[] {
  const tiles: TileData[] = [];
  const [cx, cy] = [200, 430];
  let idx = 0;
  const v = () => { const d = VALS[idx++ % VALS.length]; return d; };

  tiles.push([cx, cy, 0, 6, 6, 1.1]);

  for (let i = 0; i < 6; i++) {
    const a = i * 60, rad = (a * Math.PI) / 180;
    const [v1, v2] = v();
    tiles.push([Math.round(cx + 95 * Math.cos(rad)), Math.round(cy + 95 * Math.sin(rad)), a + 90, v1, v2, 0.90]);
  }
  for (let i = 0; i < 8; i++) {
    const a = i * 45, rad = (a * Math.PI) / 180;
    const [v1, v2] = v();
    tiles.push([Math.round(cx + 185 * Math.cos(rad)), Math.round(cy + 185 * Math.sin(rad)), a + 90, v1, v2, 1.00]);
  }
  for (let i = 0; i < 11; i++) {
    const a = i * 33, rad = (a * Math.PI) / 180;
    const [v1, v2] = v();
    tiles.push([Math.round(cx + 280 * Math.cos(rad)), Math.round(cy + 280 * Math.sin(rad)), a + 90, v1, v2, 1.05]);
  }
  return tiles;
}

const GIANT_TILES: TileData[] = [
  [ -25,  50, -22, 6, 4, 3.0], [430, 115,  32, 5, 3, 2.7],
  [ 200, -18,   0, 3, 6, 2.5], [-30, 445,  18, 2, 6, 2.8],
  [ 450, 495, -28, 4, 5, 2.6], [200, 850,   5, 3, 3, 2.5],
];

const THEME_MAP: Record<string, () => TileData[]> = {
  scatter:  () => SCATTER_TILES,
  diagonal: generateDiagonalTiles,
  grid:     generateGridTiles,
  radial:   generateRadialTiles,
  giant:    () => GIANT_TILES,
};

const OPACITY_MAP: Record<string, number> = {
  scatter: 0.32, diagonal: 0.30, grid: 0.28, radial: 0.30, giant: 0.20,
};

// ── component ─────────────────────────────────────────────────────────────────
export default function DominoBackground() {
  const { bgTheme } = useGame();
  const tiles = useMemo(() => (THEME_MAP[bgTheme] ?? THEME_MAP.scatter)(), [bgTheme]);
  const opacity = OPACITY_MAP[bgTheme] ?? 0.30;

  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Svg width="100%" height="100%" opacity={opacity}>
        {tiles.map(([x, y, angle, v1, v2, scale], idx) => (
          <DominoTile key={idx} x={x} y={y} angle={angle} v1={v1} v2={v2} scale={scale} />
        ))}
      </Svg>
    </View>
  );
}
