import { describe, expect, it } from 'vitest';

import { formatBytes, formatDuration, shortFingerprint } from './recording';

describe('formatDuration', () => {
  it('reads as a length, with the seconds always two digits', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(7)).toBe('0:07');
    expect(formatDuration(271)).toBe('4:31');
    expect(formatDuration(720)).toBe('12:00');
  });

  it('rounds to the nearest second and rolls over into the minute', () => {
    expect(formatDuration(59.6)).toBe('1:00');
    expect(formatDuration(30.4)).toBe('0:30');
  });

  it('shows nothing negative, whatever a caller hands it', () => {
    expect(formatDuration(-1)).toBe('0:00');
  });
});

describe('formatBytes', () => {
  it('counts small files in bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(999)).toBe('999 B');
  });

  it('climbs a unit every thousand, the way the file manager does', () => {
    expect(formatBytes(1000)).toBe('1.0 kB');
    expect(formatBytes(7_200_000)).toBe('7.2 MB');
    expect(formatBytes(2_500_000_000)).toBe('2.5 GB');
  });

  it('stops climbing at gigabytes rather than inventing a unit', () => {
    expect(formatBytes(4_000_000_000_000)).toBe('4000.0 GB');
  });
});

describe('shortFingerprint', () => {
  it('keeps as much as an eye can compare', () => {
    expect(shortFingerprint('a'.repeat(64))).toBe('aaaaaaaaaaaa');
    expect(shortFingerprint('0123456789abcdef'.repeat(4))).toBe('0123456789ab');
  });
});
