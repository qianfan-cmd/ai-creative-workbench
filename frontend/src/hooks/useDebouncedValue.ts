import { useEffect, useState } from 'react'

/**
 * 将 value 延迟一段时间后输出
 */
export default function useDebouncedValue<T>(value: T, delayMs = 300): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDebounced(value)
        }, delayMs)

        return () => window.clearTimeout(timer);
    }, [value, delayMs]);

    return debounced;
}