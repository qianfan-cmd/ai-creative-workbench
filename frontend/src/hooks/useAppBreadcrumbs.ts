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

    return [home, { label: 'Workbench' }];
    }, [pathname])
}