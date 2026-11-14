import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

// Register PWA Service Worker for offline resilience & instant caching
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully with scope:', reg.scope)
      })
      .catch((err) => {
        console.warn('[PWA] Service Worker registration failed:', err)
      })
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
