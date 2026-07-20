import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import App from './App.tsx'
import { NativeThemeSync } from './components/native-theme-sync.tsx'

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
