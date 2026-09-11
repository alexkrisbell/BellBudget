export function monthRange(month: number, year: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  return { start, end: `${endYear}-${String(endMonth).padStart(2, '0')}-01` }
}

// Returns `monthsBack` {month, year} entries ending at `from`'s month, oldest first.
export function trailingMonths(monthsBack: number, from = new Date()): { month: number; year: number }[] {
  const months: { month: number; year: number }[] = []
  let month = from.getMonth() + 1
  let year = from.getFullYear()
  for (let i = 0; i < monthsBack; i++) {
    months.unshift({ month, year })
    month -= 1
    if (month === 0) {
      month = 12
      year -= 1
    }
  }
  return months
}
