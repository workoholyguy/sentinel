/** Joins class names, skipping falsy ones (stands in for the `cn` package). */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
