import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import Mapping from './pages/Mapping'
import './index.css'

function Router() {
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return hash === '#mapping' ? <Mapping /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
