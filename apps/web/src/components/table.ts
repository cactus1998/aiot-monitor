export interface Column<Row, Sort extends string = string> {
  key: string
  label: string
  /** Sort field this column maps to; omit for unsortable columns. */
  sortKey?: Sort
  align?: 'left' | 'right' | 'center'
  format: (row: Row) => string
}
