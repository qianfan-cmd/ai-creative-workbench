import { createBrowserRouter, Navigate } from 'react-router-dom'
import { ChatPage, KnowledgePage, KnowledgeDocumentListPage, KnowledgeDocumentEditorPage, CampaignPage, MattingPage, AdminUsersPage, AdminFeedbackPage } from '@/router/lazyPages'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import ForgotPasswordPage from '@/pages/ForgotPasswordPage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import AssetUploadPage from '@/pages/AssetUploadPage'
import AssetListPage from '@/pages/AssetListPage'
import AuthGuard from '@/components/AuthGuard'
import GuestGuard from '@/components/GuestGuard'
import NotFoundPage from '@/pages/NotFoundPage'
import TagsPage from '@/pages/TagsPage'
import SettingsPage from '@/pages/SettingsPage'
import AdminGuard from '@/components/AdminGuard'

export const router = createBrowserRouter([
  {
    element: <GuestGuard />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
    ],
  },
  {
    element: <AuthGuard />,
    children: [
      {
        path: '/',
        element: <MainLayout />,
        children: [
          { index: true, element: <Navigate to="/assets" replace /> },
          { path: 'assets', element: <AssetListPage /> },
          { path: 'assets/upload', element: <AssetUploadPage /> },
          { path: 'tags', element: <TagsPage /> },
          { path: 'chat', element: <ChatPage /> },
          { path: 'knowledge', element: <KnowledgePage /> },
          { path: 'knowledge/documents', element: <KnowledgeDocumentListPage /> },
          { path: 'knowledge/documents/:id', element: <KnowledgeDocumentEditorPage /> },
          { path: 'ops/matting', element: <MattingPage /> },
          { path: 'ops/campaign', element: <CampaignPage /> },
          { path: 'settings', element: <SettingsPage /> },
          {
            element: <AdminGuard />,
            children: [
              { path: 'admin/users', element: <AdminUsersPage /> },
              { path: 'admin/feedback', element: <AdminFeedbackPage /> },
            ],
          },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])