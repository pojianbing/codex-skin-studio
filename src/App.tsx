import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'
import { SkinStudioApp } from '@/components/studio/skin-studio-app'
import { ThemeHanger } from '@/components/theme-hanger'

function App() {
  return getCurrentWebviewWindow().label === 'hanger' ? <ThemeHanger /> : <SkinStudioApp />
}

export default App
