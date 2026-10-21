import { Route, Routes } from 'react-router-dom'
import { ComparePage } from './pages/ComparePage'
import { DiagnosisPage } from './pages/DiagnosisPage'
import { MonitorPage } from './pages/MonitorPage'
import { OverviewPage } from './pages/OverviewPage'
import { PromptsPage } from './pages/PromptsPage'
import { StudioPage } from './pages/StudioPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/studio" element={<StudioPage />} />
      <Route path="/prompts" element={<PromptsPage />} />
      <Route path="/monitor" element={<MonitorPage />} />
      <Route path="/diagnosis" element={<DiagnosisPage />} />
      <Route path="/compare" element={<ComparePage />} />
    </Routes>
  )
}
