import { useEffect, useState, type ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { StackItem } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { styles } from './styles'
import { useStudio } from './studio'
import { TIP_EVENT, clearDismissedTips, dismissTip, readDismissedTips, tipStorageKey } from './tips'

export function PageFrame({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <Layout
      height="fill"
      xstyle={styles.full}
      header={
        <LayoutHeader hasDivider>
          <HStack gap={3} vAlign="center" wrap="wrap">
            <StackItem size="fill">
              <VStack gap={1}>
                <Heading level={1}>{title}</Heading>
                {description ? (
                  <Text type="supporting" color="secondary">
                    {description}
                  </Text>
                ) : null}
              </VStack>
            </StackItem>
            {actions}
          </HStack>
        </LayoutHeader>
      }
      content={<LayoutContent>{children}</LayoutContent>}
    />
  )
}

export function ErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return <Banner status="error" title="没有完成" description={message} container="card" />
}

export function InfoBanner({ title, onDismiss }: { title: string; onDismiss?: () => void }) {
  return (
    <Banner key={title} status="info" title={title} container="card" isDismissable dismissLabel="关闭" onDismiss={onDismiss} />
  )
}

export function TipBanner({
  id,
  page,
  title,
  status = 'info',
}: {
  id: string
  page: string
  title: string
  status?: 'info' | 'warning'
}) {
  const { studioId, loading } = useStudio()
  const key = tipStorageKey(studioId, page, id)
  const [gone, setGone] = useState(false)
  useEffect(() => {
    if (loading) return
    const sync = () => setGone(readDismissedTips(localStorage).includes(key))
    sync()
    window.addEventListener(TIP_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(TIP_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [key, loading])
  if (loading || gone) return null
  return (
    <Banner
      status={status}
      title={title}
      container="card"
      isDismissable
      dismissLabel="关闭"
      onDismiss={() => {
        dismissTip(localStorage, key)
        window.dispatchEvent(new Event(TIP_EVENT))
      }}
    />
  )
}

export function restoreDismissedTips() {
  clearDismissedTips(localStorage)
  window.dispatchEvent(new Event(TIP_EVENT))
}
