export default function AISuggestBar({
  onSuggest,
  onAcceptAll,
  hasSuggestions = false,
  loading = false,
  disabled = false,
  onRefresh,
  refreshLoading = false,
}) {
  const isDisabled = loading || disabled

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      {hasSuggestions && onAcceptAll && (
        <button
          onClick={onAcceptAll}
          style={{
            padding: '0.4rem 0.8rem',
            background: '#d97706',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.8rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'white',
            fontWeight: 500,
          }}
        >
          <i className="fas fa-check-double" style={{ color: 'inherit', background: 'none', width: 'auto', height: 'auto', borderRadius: 0, display: 'inline', padding: 0 }} /> Accept All
        </button>
      )}
      <button
        onClick={onSuggest}
        disabled={isDisabled}
        style={{
          padding: '0.4rem 0.8rem',
          background: isDisabled
            ? 'var(--gray-100)'
            : 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)',
          border: 'none',
          borderRadius: '6px',
          fontSize: '0.8rem',
          cursor: isDisabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          color: isDisabled ? 'var(--gray-400)' : 'white',
          fontWeight: 500,
          boxShadow: isDisabled ? 'none' : '0 2px 10px rgba(79,70,229,0.25)',
        }}
      >
        <i
          className={`fas fa-wand-magic-sparkles${loading ? ' fa-spin' : ''}`}
          style={{
            color: 'inherit',
            background: 'none',
            width: 'auto',
            height: 'auto',
            borderRadius: 0,
            display: 'inline',
            padding: 0,
          }}
        />
        {' '}AI Suggest
      </button>
      {onRefresh && (
        <button
          onClick={onRefresh}
          disabled={refreshLoading}
          style={{
            padding: '0.4rem 0.8rem',
            background: 'white',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontSize: '0.8rem',
            cursor: refreshLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            color: 'var(--text-2)',
          }}
        >
          <i className={`fas fa-sync-alt${refreshLoading ? ' fa-spin' : ''}`} style={{ color: 'inherit', background: 'none', width: 'auto', height: 'auto', borderRadius: 0, display: 'inline', padding: 0 }} />
          {' '}Refresh
        </button>
      )}
    </div>
  )
}
