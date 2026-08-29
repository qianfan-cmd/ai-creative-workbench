import { createBrowserRouter, Navigate } from 'react-router-dom'
import MainLayout from '@/layouts/MainLayout'
import LoginPage from '@/pages/LoginPage'
import RegisterPage from '@/pages/RegisterPage'
import AssetUploadPage from '@/pages/AssetUploadPage'
import AssetListPage from '@/pages/AssetListPage'
import AuthGuard from '@/components/AuthGuard'
import GuestGuard from '@/components/GuestGuard'
import NotFoundPage from '@/pages/NotFoundPage'
import TagsPage from '@/pages/TagsPage'
import ChatPage from '@/pages/ChatPage'
import KnowledgePage from '@/pages/KnowledgePage'

export const router = createBrowserRouter([
  {
    element: <GuestGuard />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
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
        ],
      },
    ],
  },
  {
    path: '*',
    element: <NotFoundPage />,
  },
])