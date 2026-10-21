import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Icon } from '@astryxdesign/core/Icon'
import { Selector } from '@astryxdesign/core/Selector'
import { SideNav, SideNavItem } from '@astryxdesign/core/SideNav'
import { VStack } from '@astryxdesign/core/VStack'
import { AppRoutes } from './routes'
import { StudioProvider, useStudio } from './studio'
import { styles } from './styles'

const NAV = [
  { to: '/', label: '概览', icon: 'info' },
  { to: '/studio', label: '档案', icon: 'wrench' },
  { to: '/prompts', label: '题库', icon: 'viewColumns' },
  { to: '/monitor', label: '监测', icon: 'search' },
  { to: '/diagnosis', label: '诊断', icon: 'check' },
  { to: '/drafts', label: '内容起草', icon: 'copy' },
  { to: '/compare', label: '对比', icon: 'arrowsUpDown' },
] as const

export function App() {
  return (
    <StudioProvider>
      <Shell />
    </StudioProvider>
  )
}

function Shell() {
  const location = useLocation()
  const navigate = useNavigate()
  const { studios, studioId, setStudioId } = useStudio()

  return (
    <AppShell
      variant="elevated"
      height="fill"
      contentPadding={0}
      xstyle={styles.full}
      sideNav={
        <SideNav
          aria-label="主导航"
          footer={
            studios.length > 0 ? (
              <VStack gap={2}>
                <Selector
                  label="当前工作室"
                  value={studioId}
                  options={studios.map((studio) => ({ value: studio.id, label: studio.name }))}
                  onChange={(value) => {
                    if (value) setStudioId(value)
                  }}
                />
              </VStack>
            ) : null
          }
        >
          {NAV.map((item) => (
            <SideNavItem
              key={item.to}
              label={item.label}
              href={item.to}
              icon={<Icon icon={item.icon} />}
              isSelected={location.pathname === item.to}
              onClick={(event) => {
                event.preventDefault()
                navigate(item.to)
              }}
            />
          ))}
        </SideNav>
      }
    >
      <AppRoutes />
    </AppShell>
  )
}
