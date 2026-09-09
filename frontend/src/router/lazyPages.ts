import { lazy } from 'react'

export const ChatPage = lazy(() => import('@/pages/ChatPage'))
export const KnowledgePage = lazy(() => import('@/pages/KnowledgePage'))
export const KnowledgeDocumentListPage = lazy(() => import('@/pages/KnowledgeDocumentListPage'))
export const KnowledgeDocumentEditorPage = lazy(() => import('@/pages/KnowledgeDocumentEditorPage'))
export const MattingPage = lazy(() => import('@/pages/MattingPage'))
export const CampaignPage = lazy(() => import('@/pages/CampaignPage'))
export const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage'))
export const AdminFeedbackPage = lazy(() => import('@/pages/AdminFeedbackPage'))