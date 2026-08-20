/**
 * 用户改显示名时强制保留原扩展名，否则后端存成无后缀文件
 */
export function splitFileName(name: string): { base: string; ext: string } {
    const lastDot = name.lastIndexOf('.');
    if (lastDot <= 0) {
        return { base: name, ext: '' };
    }

    return {
        base: name.slice(0, lastDot), // 不保留点号,示例：image
        ext: name.slice(lastDot), // 保留点号,示例：.jpg
    }
}

/**合并文件名 */
export function joinFileName(base: string, ext: string): string {
    const trimmed = base.trim();
    return ext ? `${trimmed}${ext}` : trimmed;
}