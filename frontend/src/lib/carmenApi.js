const SUBMIT_ENDPOINT = 'https://dev.carmen4.com/Carmen.API/api/interface/PMS/Test/Daily'
const SUBMIT_TOKEN = 'direct f9ebce3d77f2f445dee52ba252cc53ee|d1f09146-6393-434b-a4a1-117845aff2ca'

/**
 * Submit the processed document payload to the Carmen API.
 * @param {{ BankType: string, ImportDate: string, Header: object, Details: object[] }} payload
 * @returns {Promise<void>} resolves on success, throws on HTTP error
 */
export async function submitToCarmen(payload) {
  const res = await fetch(SUBMIT_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: SUBMIT_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errTxt = await res.text()
    throw new Error(`ไม่สามารถส่งข้อมูลได้ (${res.status})\n${errTxt}`)
  }
}
