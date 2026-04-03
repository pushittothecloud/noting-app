import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { NavBar } from './components/NavBar'
import { Home } from './screens/Home'
import { Session } from './screens/Session'
import { Results } from './screens/Results'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { useSettingsStore } from './modules/settings/settingsStore'
import './index.css'

export function App() {
  const theme = useSettingsStore((s) => s.settings.theme)

  return (
    <div data-theme={theme} style={{ minHeight: '100vh' }}>
      <BrowserRouter>
        <NavBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/session" element={<Session />} />
          <Route path="/results" element={<Results />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </BrowserRouter>
    </div>
  )
}
