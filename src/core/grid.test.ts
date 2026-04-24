import { describe, it, expect } from 'vitest';
import { getSquareName, generateGridSquares } from './grid';

describe('getSquareName', () => {
  it('row=0, col=0, startLetter=A → A1', () => {
    expect(getSquareName(0, 0, 'A')).toBe('A1');
  });

  it('row=1, col=2, startLetter=A → B3', () => {
    expect(getSquareName(1, 2, 'A')).toBe('B3');
  });

  it('custom startLetter: row=0, col=0, startLetter=Д → Д1', () => {
    expect(getSquareName(0, 0, 'Д')).toBe('Д1');
  });

  it('custom startLetter: row=2, col=0, startLetter=Д → Ж1 (Д+2)', () => {
    expect(getSquareName(2, 0, 'Д')).toBe('Ж1');
  });

  it('wraps after Я for Cyrillic (28 letters in alphabet)', () => {
    expect(getSquareName(28, 0, 'А')).toBe('А1');
  });

  it('wraps after Z for Latin', () => {
    expect(getSquareName(26, 0, 'A')).toBe('A1');
  });
});

describe('generateGridSquares', () => {
  const zone = { north: 43.01, south: 43.0, east: 131.01, west: 131.0 };

  it('generates squares inside zone', () => {
    const squares = generateGridSquares(zone, 200, 'A');
    expect(squares.length).toBeGreaterThan(0);
    squares.forEach(sq => {
      expect(sq.bounds.north).toBeLessThanOrEqual(zone.north);
      expect(sq.bounds.south).toBeGreaterThanOrEqual(zone.south);
      expect(sq.bounds.west).toBeGreaterThanOrEqual(zone.west);
      expect(sq.bounds.east).toBeLessThanOrEqual(zone.east);
    });
  });

  it('names start from given letter', () => {
    const squares = generateGridSquares(zone, 200, 'Б');
    const firstRow = squares.filter(s => s.row === 0);
    expect(firstRow[0].name).toMatch(/^Б/);
  });

  it('marks A1 as isScale', () => {
    const squares = generateGridSquares(zone, 200, 'A');
    const a1 = squares.find(s => s.name === 'A1');
    expect(a1?.isScale).toBe(true);
  });

  it('marks A2 as isSnail', () => {
    const squares = generateGridSquares(zone, 200, 'A');
    const a2 = squares.find(s => s.name === 'A2');
    if (a2) {
      expect(a2.isSnail).toBe(true);
    }
  });

  it('returns empty for too-small zone', () => {
    const tiny = { north: 43.0001, south: 43.0, east: 131.0001, west: 131.0 };
    const squares = generateGridSquares(tiny, 1000, 'A');
    expect(squares).toHaveLength(0);
  });
});
