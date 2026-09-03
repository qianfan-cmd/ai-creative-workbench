import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export interface BreadcrumbItem {
    label: string
    href?: string
}

export function useAppBreadcrumbs(): BreadcrumbItem[] {
    const { pathname } = useLocation()

    return useMemo(() => {
        const home: BreadcrumbItem = { label: 'Workbench', href: '/assets' };

        if (pathname === '/assets/upload') {
           return [
            home,
            { label: '素材 Assets', href: '/assets' },
            { label: '上传 Upload', href: '/assets/upload' }
        ]
    }

    if (pathname.startsWith('/assets/')) {
        return [home, { label: '素材 Assets'}];
    }

    if (pathname === '/chat') {
        return [home, { label: 'AI 对话 Chat', href: '/chat' }];
    }

    if (pathname === '/knowledge/documents') {
        return [
            home,
            { label: '知识库 Knowledge', href: '/knowledge' },
            { label: '文档库 Documents', href: '/knowledge/documents' },
        ];
    }

    if (pathname.startsWith('/knowledge/documents/')) {
        return [
            home,
            { label: '知识库 Knowledge', href: '/knowledge' },
            { label: '文档库 Documents', href: '/knowledge/documents' },
            { label: '编辑文档' },
        ];
    }

    if (pathname === '/knowledge') {
        return [home, { label: '知识库 Knowledge', href: '/knowledge' }];
    }
    
    if (pathname === '/ops/matting') {
        return [home, { label: '抠图 Matting', href: '/ops/matting' }]
    }

    if (pathname === '/ops/campaign') {
        return [home, { label: '活动帖 Campaign', href: '/ops/campaign' }]
    }

    if (pathname === '/settings') {
        return [home, { label: '设置 Settings', href: '/settings' }]
    }

    return [home, { label: 'Workbench' }];
    }, [pathname])
}