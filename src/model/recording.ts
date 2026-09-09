/**
 * The passport of a recording: what identifies the file, apart from the sound in it.
 *
 * Markup travels without audio — exported as a sidecar, re-attached to a file the player
 * picks again later. What makes that safe is the fingerprint: the same bytes give the same
 * digest, so a sidecar can say out loud whether it belongs to the recording in front of it.
 * The rest is for the person doing the picking, who remembers a file by its name, its
 * length and roughly how big it was.
 */

export interface AudioPassport {
  fileName: string;
  bytes: number;
  durationSec: number;
  /** SHA-256 of the whole file, lower-case hex. */
  sha256: string;
}

/** Minutes and seconds, the way a player reads a length: `4:31`, `0:07`, `12:00`. */
export function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/**
 * A file size to recognize the file by, not to account for it: one decimal place is enough
 * to tell 7.2 MB apart from 3.4 MB, and a byte count would be enough to tell nothing.
 * Units are the powers of 1000 the operating system shows, so the number here matches the
 * number in the file manager the player got it from.
 */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${Math.max(0, Math.round(bytes))} B`;
  const units = ['kB', 'MB', 'GB'];
  let size = bytes / 1000;
  let unit = 0;
  while (size >= 1000 && unit < units.length - 1) {
    size /= 1000;
    unit += 1;
  }
  return `${size.toFixed(1)} ${units[unit]}`;
}

/**
 * As much of the fingerprint as a person can compare by eye. Nobody reads 64 hex digits;
 * twelve are already far past the point where two of your own recordings could collide,
 * and the full digest stays a click away for anyone who wants to check it against a shell.
 */
export function shortFingerprint(sha256: string): string {
  return sha256.slice(0, 12);
}
