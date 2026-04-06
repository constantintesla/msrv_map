import type { Bounds, GridSquare } from '../types';
import { metersToDegreesLat, metersToDegreesLng } from '../utils/geo';

// === Cyrillic alphabet for grid naming ===
const CYRILLIC_UPPER = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ';
const LATIN_UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isCyrillic(char: string): boolean {
  const code = char.charCodeAt(0);
  return code >= 0x0400 && code <= 0x04FF;
}

/** Get square name: row → letter (from startLetter), col → number */
export function getSquareName(row: number, col: number, startLetter: string): string {
  const alphabet = isCyrillic(startLetter) ? CYRILLIC_UPPER : LATIN_UPPER;
  const startIndex = alphabet.indexOf(startLetter.toUpperCase());
  const idx = startIndex >= 0 ? startIndex : 0;
  const letterIndex = (idx + row) % alphabet.length;
  return `${alphabet[letterIndex]}${col + 1}`;
}

/** Generate grid squares within bounds */
export function generateGridSquares(
  zone: Bounds,
  gridSizeMeters: number,
  startLetter: string,
): GridSquare[] {
  const avgLat = (zone.north + zone.south) / 2;
  const sizeDegLat = metersToDegreesLat(gridSizeMeters);
  const sizeDegLng = metersToDegreesLng(gridSizeMeters, avgLat);

  const cols = Math.floor((zone.east - zone.west) / sizeDegLng);
  const rows = Math.floor((zone.north - zone.south) / sizeDegLat);

  if (cols === 0 || rows === 0) return [];

  const squares: GridSquare[] = [];
  const startLat = zone.north;
  const startLng = zone.west;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const north = startLat - row * sizeDegLat;
      const south = north - sizeDegLat;
      const west = startLng + col * sizeDegLng;
      const east = west + sizeDegLng;

      const name = getSquareName(row, col, startLetter);

      squares.push({
        row,
        col,
        name,
        bounds: { north, south, east, west },
        isScale: name === `${startLetter}1`,
        isSnail: name === `${startLetter}2`,
      });
    }
  }

  return squares;
}

/** Compute grid bounds from squares */
export function computeGridBounds(squares: GridSquare[]): Bounds | null {
  if (squares.length === 0) return null;
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  for (const sq of squares) {
    north = Math.max(north, sq.bounds.north);
    south = Math.min(south, sq.bounds.south);
    east = Math.max(east, sq.bounds.east);
    west = Math.min(west, sq.bounds.west);
  }
  return { north, south, east, west };
}

/** Shift all squares by meters in a direction */
export function shiftSquares(
  squares: GridSquare[],
  direction: 'up' | 'down' | 'left' | 'right',
  meters: number,
): GridSquare[] {
  const avgLat = squares.length > 0
    ? squares.reduce((sum, sq) => sum + (sq.bounds.north + sq.bounds.south) / 2, 0) / squares.length
    : 0;

  const dLat = metersToDegreesLat(meters);
  const dLng = metersToDegreesLng(meters, avgLat);

  let latShift = 0;
  let lngShift = 0;

  switch (direction) {
    case 'up': latShift = dLat; break;
    case 'down': latShift = -dLat; break;
    case 'left': lngShift = -dLng; break;
    case 'right': lngShift = dLng; break;
  }

  return squares.map(sq => ({
    ...sq,
    bounds: {
      north: sq.bounds.north + latShift,
      south: sq.bounds.south + latShift,
      east: sq.bounds.east + lngShift,
      west: sq.bounds.west + lngShift,
    },
  }));
}

/** Get unique rows from squares */
export function getGridRows(squares: GridSquare[]): number[] {
  return [...new Set(squares.map(s => s.row))].sort((a, b) => a - b);
}

/** Get unique cols from squares */
export function getGridCols(squares: GridSquare[]): number[] {
  return [...new Set(squares.map(s => s.col))].sort((a, b) => a - b);
}
