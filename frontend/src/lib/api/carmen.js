/**
 * Carmen API — proxy calls to the Carmen ERP system.
 */

import { apiFetch } from './client'

export async function fetchAccountCodes() {
  const res = await apiFetch('/api/v1/ocr/carmen/account-codes')
  if (!res.ok) throw new Error(`Failed to fetch account codes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

export async function fetchDepartments() {
  const res = await apiFetch('/api/v1/ocr/carmen/departments')
  if (!res.ok) throw new Error(`Failed to fetch departments (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

export async function fetchGLPrefixes() {
  const res = await apiFetch('/api/v1/ocr/carmen/gl-prefix')
  if (!res.ok) throw new Error(`Failed to fetch GL prefixes (${res.status})`)
  const json = await res.json()
  return json.Data || []
}

export async function submitToCarmen(payload) {
  const res = await apiFetch('/api/v1/ocr/carmen/gljv', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errTxt = await res.text()
    throw new Error(`Carmen GL JV ล้มเหลว (${res.status}): ${errTxt}`)
  }
  return res.json()
}

export async function submitAPInvoiceToCarmen(payload) {
  const res = await apiFetch('/api/v1/ocr/carmen/invoice', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errTxt = await res.text()
    throw new Error(`Carmen Invoice ล้มเหลว (${res.status}): ${errTxt}`)
  }
  return res.json()
}

export async function submitInputTax(payload) {
  const res = await apiFetch('/api/v1/ocr/carmen/input-tax', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const errTxt = await res.text()
    throw new Error(`Carmen Input Tax ล้มเหลว (${res.status}): ${errTxt}`)
  }
  return res.json()
}
