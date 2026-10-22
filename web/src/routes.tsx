import { Route, Routes } from 'react-router-dom'
import { ComparePage } from './pages/ComparePage'
import { DiagnosisPage } from './pages/DiagnosisPage'
import { DraftsListPage } from './pages/DraftsListPage'
import { DraftsPage } from './pages/DraftsPage'
import { LibraryEditPage } from './pages/LibraryEditPage'
import { LibraryPage } from './pages/LibraryPage'
import { MonitorPage } from './pages/MonitorPage'
import { OverviewPage } from './pages/OverviewPage'
import { PromptsPage } from './pages/PromptsPage'
import { SettingsPage } from './pages/SettingsPage'
import { StudioPage } from './pages/StudioPage'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/studio" element={<StudioPage />} />
      <Route path="/library" element={<LibraryPage />} />
      <Route path="/library/new" element={<LibraryEditPage />} />
      <Route path="/library/:assetId" element={<LibraryEditPage />} />
      <Route path="/prompts" element={<PromptsPage />} />
      <Route path="/monitor" element={<MonitorPage />} />
      <Route path="/diagnosis" element={<DiagnosisPage />} />
      <Route path="/drafts" element={<DraftsListPage />} />
      <Route path="/drafts/new" element={<DraftsPage />} />
      <Route path="/drafts/:draftId" element={<DraftsPage />} />
      <Route path="/compare" element={<ComparePage />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  )
}
