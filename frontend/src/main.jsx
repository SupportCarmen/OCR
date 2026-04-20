import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import Home from './pages/Home'
import App from './App'
import Mapping from './pages/Mapping'
import './index.css'

function getRoute() {
  // Normalize: "#/CreditCardOCR" → "creditcardocr"
  return window.location.hash.replace(/^#\/?/, '').toLowerCase()
}

function Router() {
  const [route, setRoute] = useState(getRoute());

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (route.startsWith('creditcardocr')) {
    // Sub-routes under CreditCardOCR
    const sub = route.replace('creditcardocr', '').replace(/^\//, '')
    if (sub === 'mapping') return <Mapping />
    return <App />
  }
  return <Home />
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
