import { useState } from 'react'

export function useModal() {
  const [modal, setModal] = useState({ show: false })

  function showModal(config) {
    setModal({ show: true, ...config })
  }

  function closeModal() {
    setModal({ show: false })
  }

  return { modal, showModal, closeModal }
}
