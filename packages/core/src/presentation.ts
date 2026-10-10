export function formatFindingDescription(value: string): string {
  return value
    .replace(/^Synthetic /, "")
    .replace(/^./, (char) => char.toUpperCase());
}
