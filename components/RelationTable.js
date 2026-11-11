import { plural } from '@/lib/format';

// Shows “Relação.coluna” with a faded prefix.
function ColumnLabel({ column }) {
  const text = String(column);
  const dot = text.lastIndexOf('.');
  if (dot <= 0) return text;
  return <><span className="col-prefix">{text.slice(0, dot + 1)}</span>{text.slice(dot + 1)}</>;
}

// Generic table. `mark` = [[row, col]] cells to highlight; `keyColumns` underlined;
// `rowClass(row, index)` adds a class to a row; `empty` is shown when there are no rows.
export default function RelationTable({ columns, rows, title, mark = [], keyColumns = [], rowClass, empty }) {
  const marked = new Set(mark.map(([row, col]) => `${row}:${col}`));
  return (
    <div className="table-card">
      {title && <div className="table-label"><span>{title}</span><small>{plural(rows.length, 'tupla', 'tuplas')}</small></div>}
      <div className="table-scroll">
        <table className="relation-table">
          <thead><tr>{columns.map((column, index) => <th key={index} className={keyColumns.includes(column) ? 'key-col' : undefined}><ColumnLabel column={column} /></th>)}</tr></thead>
          {rows.length > 0 && (
            <tbody>
              {rows.map((row, r) => (
                <tr key={r} className={rowClass?.(row, r) || undefined}>
                  {row.map((cell, c) => (
                    <td key={c} className={marked.has(`${r}:${c}`) ? 'cell-mark' : undefined}>{cell === '' ? <span className="cell-empty">—</span> : String(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          )}
        </table>
      </div>
      {rows.length === 0 && empty && <p className="empty-result">{empty}</p>}
    </div>
  );
}
