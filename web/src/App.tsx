import { useLocation, useNavigate } from 'react-router-dom'
import { AppShell } from '@astryxdesign/core/AppShell'
import { Icon } from '@astryxdesign/core/Icon'
import { Selector } from '@astryxdesign/core/Selector'
import { SideNav, SideNavItem, SideNavSection } from '@astryxdesign/core/SideNav'
import { AppRoutes } from './routes'
import { StudioProvider, useStudio } from './studio'
import { styles } from './styles'

const GROUPS = [
  { title: '总览', items: [{ to: '/', label: '概览', icon: 'info' }] },
  {
    title: '品牌与素材',
    items: [
      { to: '/studio', label: '品牌', icon: 'wrench' },
      { to: '/library', label: '素材库', icon: 'checkDouble' },
    ],
  },
  {
    title: '监测循环',
    items: [
      { to: '/prompts', label: '题库', icon: 'viewColumns' },
      { to: '/monitor', label: '监测', icon: 'search' },
      { to: '/compare', label: '对比', icon: 'arrowsUpDown' },
      { to: '/diagnosis', label: '诊断', icon: 'check' },
    ],
  },
  { title: '内容', items: [{ to: '/drafts', label: '内容起草', icon: 'copy' }] },
] as const

const SETTINGS = { to: '/settings', label: '设置', icon: 'menu' } as const

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

  const link = (item: { to: string; label: string; icon: (typeof GROUPS)[number]['items'][number]['icon'] | (typeof SETTINGS)['icon'] }) => (
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
  )

  return (
    <AppShell
      variant="elevated"
      height="fill"
      contentPadding={0}
      xstyle={styles.full}
      sideNav={
        <SideNav
          aria-label="主导航"
          header={
            studios.length > 0 ? (
              <Selector
                label="当前品牌"
                placement="below"
                width="100%"
                value={studioId}
                options={studios.map((studio) => ({ value: studio.id, label: studio.name }))}
                onChange={(value) => {
                  if (value) setStudioId(value)
                }}
              />
            ) : null
          }
          footer={link(SETTINGS)}
        >
          {GROUPS.map((group) => (
            <SideNavSection key={group.title} title={group.title}>
              {group.items.map((item) => link(item))}
            </SideNavSection>
          ))}
        </SideNav>
      }
    >
      <AppRoutes />
    </AppShell>
  )
}
