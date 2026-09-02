import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export interface BreadcrumbItem {
    label: string
    href?: string
}

export function useAppBreadcrumbs(): BreadcrumbItem[] {
    const { pathname } = useLocation(); // 获取当前路径
    console.log('本地钩子',useLocation());

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

    if (pathname === '/knowledge') {
        return [home, { label: '知识库 Knowledge', href: '/knowledge' }];
    }
    
    if (pathname === '/ops/matting') {
        return [home, { label: '抠图 Matting', href: '/ops/matting' }]
    }

    if (pathname === '/ops/campaign') {
        return [home, { label: '活动帖 Campaign', href: '/ops/campaign' }]
    }
    return [home, { label: 'Workbench' }];
    }, [pathname])
}