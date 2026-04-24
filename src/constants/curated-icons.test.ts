import { describe, it, expect } from 'vitest';
import { CURATED_ICONS, resolveIconLocal, findCuratedByFilename } from './curated-icons';

describe('CURATED_ICONS', () => {
  it('has unique ids', () => {
    const ids = CURATED_ICONS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('each entry has remoteUrl starting with https://maps.google.com/mapfiles/', () => {
    for (const i of CURATED_ICONS) {
      expect(i.remoteUrl.startsWith('https://maps.google.com/mapfiles/')).toBe(true);
    }
  });

  it('each entry has localUrl under /icons/', () => {
    for (const i of CURATED_ICONS) {
      expect(i.localUrl).toBe(`/icons/${i.id}.png`);
    }
  });
});

describe('resolveIconLocal', () => {
  it('returns localUrl for known remoteUrl', () => {
    const icon = CURATED_ICONS[0];
    expect(resolveIconLocal(icon.remoteUrl)).toBe(icon.localUrl);
  });

  it('normalizes http:// to https://', () => {
    const icon = CURATED_ICONS[0];
    const httpUrl = icon.remoteUrl.replace('https://', 'http://');
    expect(resolveIconLocal(httpUrl)).toBe(icon.localUrl);
  });

  it('returns the original URL for unknown sources', () => {
    expect(resolveIconLocal('https://example.com/custom.png')).toBe('https://example.com/custom.png');
  });

  it('returns undefined for undefined input', () => {
    expect(resolveIconLocal(undefined)).toBeUndefined();
  });
});

describe('findCuratedByFilename', () => {
  it('matches filename from relative path', () => {
    const icon = CURATED_ICONS[0];
    expect(findCuratedByFilename(`icons/${icon.id}.png`)).toBe(icon);
  });

  it('returns undefined for unknown filenames', () => {
    expect(findCuratedByFilename('icons/does-not-exist.png')).toBeUndefined();
  });
});
