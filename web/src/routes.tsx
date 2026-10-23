import { lazy, Suspense, type ComponentType } from 'react'
import { Route, Routes } from 'react-router-dom'
import { Spinner } from '@astryxdesign/core/Spinner'

function lazyPage<T extends Record<string, ComponentType>>(loader: () => Promise<T>, name: keyof T & string) {
  return lazy(() => loader().then((mod) => ({ default: mod[name] })))
}

const OverviewPage = lazyPage(() => import('./pages/OverviewPage'), 'OverviewPage')
const StudioPage = lazyPage(() => import('./pages/StudioPage'), 'StudioPage')
const LibraryPage = lazyPage(() => import('./pages/LibraryPage'), 'LibraryPage')
const LibraryEditPage = lazyPage(() => import('./pages/LibraryEditPage'), 'LibraryEditPage')
const PromptsPage = lazyPage(() => import('./pages/PromptsPage'), 'PromptsPage')
const MonitorPage = lazyPage(() => import('./pages/MonitorPage'), 'MonitorPage')
const DiagnosisPage = lazyPage(() => import('./pages/DiagnosisPage'), 'DiagnosisPage')
const DraftsListPage = lazyPage(() => import('./pages/DraftsListPage'), 'DraftsListPage')
const DraftsPage = lazyPage(() => import('./pages/DraftsPage'), 'DraftsPage')
const ComparePage = lazyPage(() => import('./pages/ComparePage'), 'ComparePage')
const SettingsPage = lazyPage(() => import('./pages/SettingsPage'), 'SettingsPage')

export function AppRoutes() {
  return (
    <Suspense fallback={<Spinner label="正在打开" />}>
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
    </Suspense>
  )
}
