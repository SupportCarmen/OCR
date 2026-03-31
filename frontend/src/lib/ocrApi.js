/**
 * Upload a file to the OCR backend and return the extracted_data object.
 * @param {File} file
 * @returns {Promise<object>} extracted_data from the completed task
 */
export async function extractFromFile(file) {
  const formData = new FormData()
  formData.append('files', file)

  const uploadRes = await fetch('/api/v1/ocr/extract', {
    method: 'POST',
    body: formData,
  })

  if (!uploadRes.ok) {
    const err = await uploadRes.json().catch(() => ({}))
    throw new Error(err.detail || `Upload failed (${uploadRes.status})`)
  }

  const { task_ids } = await uploadRes.json()
  const taskId = task_ids[0]

  const taskRes = await fetch(`/api/v1/ocr/tasks/${taskId}`)
  if (!taskRes.ok) throw new Error(`ดึงผล OCR ไม่สำเร็จ (${taskRes.status})`)

  const task = await taskRes.json()
  if (task.status === 'failed') {
    throw new Error(task.error_message || 'OCR processing failed')
  }

  return task.extracted_data || {}
}
