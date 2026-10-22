import type { ReactNode } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Heading } from '@astryxdesign/core/Heading'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent, LayoutHeader } from '@astryxdesign/core/Layout'
import { StackItem } from '@astryxdesign/core/Stack'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { styles } from './styles'

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
  return <Banner status="error" title="没有完成" description={message} container="section" />
}

export function InfoBanner({ title, description }: { title: string; description?: string }) {
  return <Banner status="info" title={title} description={description} container="card" />
}

export function WarningBanner({ title, description }: { title: string; description?: string }) {
  return <Banner status="warning" title={title} description={description} container="section" />
}
