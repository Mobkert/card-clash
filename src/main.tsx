import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

const BUILD_ID = '2026-08-31-mp3'
const buildKey = 'card-clash-build'
const previousBuild = localStorage.getItem(buildKey)
if (previousBuild && previousBuild !== BUILD_ID) {
  localStorage.setItem(buildKey, BUILD_ID)
  if ('caches' in window) {
    void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  }
  location.reload()
} else {
  localStorage.setItem(buildKey, BUILD_ID)
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
