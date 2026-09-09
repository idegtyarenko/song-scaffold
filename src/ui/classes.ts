/** Class names, joined. */

/**
 * A class name, or the absence of one. `false` is what `condition && 'name'` leaves behind
 * when the condition does not hold, and `undefined` is an optional `className` prop that
 * nobody passed.
 */
type ClassName = string | false | null | undefined;

/**
 * Join the class names that are actually there.
 *
 * Every element here is a block plus whatever modifiers apply right now, and the modifiers
 * are conditional. Written out, that is a `filter(Boolean).join(' ')` on the end of each
 * array — long enough to wrap the line and hide the names it is joining.
 */
export function cx(...names: ClassName[]): string {
  return names.filter(Boolean).join(' ');
}
