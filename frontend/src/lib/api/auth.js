/**
 * Auth API — Carmen SSO token exchange.
 */

/**
 * Exchange a Carmen SSO token for an OCR session JWT.
 * @param {string} token  - Raw Carmen token from URL params
 * @param {string} bu     - Business Unit name from URL params
 * @returns {Promise<{ access_token: string, expires_in: number, user: object }>}
 */
export async function exchangeSSOToken(token, bu, user = '') {
  const res = await fetch('/api/v1/auth/exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, bu, user }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `SSO exchange failed (${res.status})`)
  }

  return res.json()
}

/**
 * Revoke the current OCR session (logout).
 * @param {string} accessToken
 */
export async function revokeSession(accessToken) {
  await fetch('/api/v1/auth/session', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).catch(() => {}) // best-effort
}
