import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ConfigProvider } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import { workbenchTheme } from '@/style-guide/antdTheme'
import '@/style-guide/global.css'
import DesignPreviewPage from '@/style-guide/DesignPreviewPage'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConfigProvider theme={workbenchTheme} locale={zhCN}>
      <DesignPreviewPage />
    </ConfigProvider>
  </StrictMode>,
)
