/** Cell values with the whitespace trimmed, empties dropped, and duplicates collapsed.
 *  Used to see past merged cells, which ExcelJS returns as the same value repeated
 *  across every column the merge spans. */
export function nonEmptyDistinctValues(row: string[]): string[] {
  return [...new Set(row.map((cell) => cell.trim()).filter((cell) => cell.length > 0))]
}

/** Heuristic: within the first ~10 rows, the row with the most *distinct* non-empty cells is
 *  the header; anything above it (title/subtitle rows in generated reports) is a banner. */
export function findHeaderRowIndex(rows: string[][]): number {
  let bestIndex = 0
  let bestCount = -1
  const searchLimit = Math.min(rows.length, 10)
  for (let i = 0; i < searchLimit; i++) {
    const count = nonEmptyDistinctValues(rows[i]).length
    if (count > bestCount) {
      bestCount = count
      bestIndex = i
    }
  }
  return bestIndex
}
