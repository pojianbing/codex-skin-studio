import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import './index.css'
import App from './App.tsx'
import { NativeThemeSync } from './components/native-theme-sync.tsx'

let isThemeHangerWindow = false
try {
  isThemeHangerWindow = getCurrentWebviewWindow().label === 'hanger'
} catch {
  // Browser previews do not expose the Tauri window metadata.
}
if (isThemeHangerWindow) {
  document.documentElement.classList.add('theme-hanger-window')
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      storageKey="cs-app-theme"
    >
      <NativeThemeSync />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
