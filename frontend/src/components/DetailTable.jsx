import { DETAIL_COLUMNS, DETAIL_LABELS } from '../constants'

const formatAmount = (value) => {
  if (!value) return ''
  const num = parseFloat(String(value).replace(/,/g, ''))
  if (isNaN(num)) return String(value)
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const amountFields = ['PayAmt', 'CommisAmt', 'TaxAmt', 'Total', 'WHTAmount']

export default function DetailTable({ details, onUpdate, onAddRow, onDeleteRow, readOnly }) {
  return (
    <div className="data-card">
      <div className="card-title">
        <div className="card-title-left">
          <i className="fas fa-list" /> ข้อมูลรายการ (Details)
        </div>
        <span className="row-count">{details.length} รายการ</span>
      </div>
      <div className="card-body-flush table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {DETAIL_COLUMNS.map(col => {
                const labelHtml = DETAIL_LABELS[col] || col
                return (
                  <th key={col} dangerouslySetInnerHTML={{ __html: labelHtml }} />
                )
              })}
              {!readOnly && <th style={{ textAlign: 'center' }}>Action</th>}
            </tr>
          </thead>
          <tbody>
            {details.map((row, rowIdx) => (
              <tr key={rowIdx}>
                {DETAIL_COLUMNS.map(col => {
                  const isAmountField = amountFields.includes(col)
                  const displayValue = isAmountField ? formatAmount(row[col]) : (row[col] ?? '')
                  return (
                    <td key={col}>
                      <input
                        type="text"
                        className="detail-input"
                        value={displayValue}
                        readOnly={readOnly}
                        onChange={e => !readOnly && onUpdate?.(rowIdx, col, e.target.value)}
                      />
                    </td>
                  )
                })}
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
