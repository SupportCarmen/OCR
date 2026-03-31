import { DETAIL_COLUMNS } from '../constants'

export default function DetailTable({ details, onUpdate, onAddRow, onDeleteRow, readOnly }) {
  return (
    <div className="data-card">
      <h3 className="card-title">
        <i className="fas fa-list-alt" /> ข้อมูลรายการ (Detail)
      </h3>
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {DETAIL_COLUMNS.map(col => <th key={col}>{col}</th>)}
              {!readOnly && <th style={{ textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {details.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {DETAIL_COLUMNS.map(col => (
                  <td key={col}>
                    <input
                      type="text"
                      className="detail-input"
                      value={row[col] ?? ''}
                      readOnly={readOnly}
                      onChange={e => !readOnly && onUpdate?.(rowIdx, col, e.target.value)}
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td style={{ textAlign: 'center' }}>
                    <button
                      className="btn-delete"
                      title="ลบรายการ"
                      onClick={() => onDeleteRow(rowIdx)}
                    >
                      <i className="fas fa-trash" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button className="btn-add-row" onClick={onAddRow}>
          <i className="fas fa-plus-circle" /> เพิ่มรายการ
        </button>
      )}
    </div>
  )
}
