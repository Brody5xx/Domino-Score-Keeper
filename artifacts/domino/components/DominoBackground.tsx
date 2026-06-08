import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, G, Line, Rect } from "react-native-svg";

// ── pip layouts ────────────────────────────────────────────────────────────────
// Each half-tile is 26×26 with a 4px inset pip area (18×18 usable).
const PIP_POSITIONS: Record<number, [number, number][]> = {
  0: [],
  1: [[9, 9]],
  2: [
    [4, 4],
    [14, 14],
  ],
  3: [
    [4, 4],
    [9, 9],
    [14, 14],
  ],
  4: [
    [4, 4],
    [14, 4],
    [4, 14],
    [14, 14],
  ],
  5: [
    [4, 4],
    [14, 4],
    [9, 9],
    [4, 14],
    [14, 14],
  ],
  6: [
    [4, 3],
    [14, 3],
    [4, 9],
    [14, 9],
    [4, 15],
    [14, 15],
  ],
};

// ── single tile ────────────────────────────────────────────────────────────────
// Tile: 62 × 30  (landscape). Half-tile: 31 × 30.
const W = 62;
const H = 30;
const R = 5;        // corner radius
const PAD = 6;      // pip-area left/top offset inside each half

interface TileProps {
  x: number;        // centre x
  y: number;        // centre y
  angle: number;    // degrees
  v1: number;       // left half value 0-6
  v2: number;       // right half value 0-6
  scale?: number;
}

function DominoTile({ x, y, angle, v1, v2, scale = 1 }: TileProps) {
  const fill = "#24243A";
  const stroke = "#484870";
  const pipColor = "#606090";

  return (
    <G
      transform={`translate(${x},${y}) rotate(${angle}) scale(${scale}) translate(${-W / 2},${-H / 2})`}
    >
      {/* body */}
      <Rect
        x={0}
        y={0}
        width={W}
        height={H}
        rx={R}
        ry={R}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.2}
      />
      {/* centre divider */}
      <Line
        x1={W / 2}
        y1={4}
        x2={W / 2}
        y2={H - 4}
        stroke={stroke}
        strokeWidth={1}
      />

      {/* left pips */}
      {PIP_POSITIONS[v1]?.map(([px, py], i) => (
        <Circle
          key={`l${i}`}
          cx={PAD + px}
          cy={PAD + py}
          r={2.2}
          fill={pipColor}
        />
      ))}

      {/* right pips */}
      {PIP_POSITIONS[v2]?.map(([px, py], i) => (
        <Circle
          key={`r${i}`}
          cx={W / 2 + PAD + px}
          cy={PAD + py}
          r={2.2}
          fill={pipColor}
        />
      ))}
    </G>
  );
}

// ── tile layout ────────────────────────────────────────────────────────────────
// [x, y, angle, v1, v2, scale]  — centred on a ~400×860 canvas
const TILES: [number, number, number, number, number, number][] = [
  // top zone
  [-12,  70,  -28, 6, 3, 1.15],
  [130,  28,   14, 2, 5, 0.90],
  [310,  90,  -42, 5, 4, 1.05],
  [420,  35,   22, 1, 6, 0.85],
  // upper-mid
  [ 55, 190,   36, 4, 2, 1.10],
  [210, 155,  -18, 6, 1, 0.95],
  [370, 215,   -8, 3, 3, 1.00],
  // mid
  [ -8, 330,   12, 5, 5, 0.88],
  [180, 310,   48, 2, 6, 1.20],
  [390, 340,  -35, 4, 1, 0.92],
  // lower-mid
  [ 85, 450,  -22, 6, 6, 1.08],
  [260, 430,   30, 1, 4, 0.87],
  [440, 480,  -14, 3, 2, 1.00],
  // lower zone
  [ 20, 560,   42, 5, 3, 0.95],
  [195, 555,  -10, 2, 2, 1.12],
  [370, 600,   25, 6, 4, 0.90],
  // bottom
  [ 95, 680,  -32, 4, 5, 1.05],
  [290, 710,   16, 1, 3, 0.88],
  [435, 740,  -20, 6, 2, 1.00],
  [160, 800,   38, 3, 6, 0.94],
];

// ── component ─────────────────────────────────────────────────────────────────
export default function DominoBackground() {
  return (
    <View style={[StyleSheet.absoluteFill, { pointerEvents: "none" }]}>
      <Svg width="100%" height="100%" opacity={0.35}>
        {TILES.map(([x, y, angle, v1, v2, scale], idx) => (
          <DominoTile
            key={idx}
            x={x}
            y={y}
            angle={angle}
            v1={v1}
            v2={v2}
            scale={scale}
          />
        ))}
      </Svg>
    </View>
  );
}
