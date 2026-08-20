/**840 KB / 1.2 MB */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`; // 小于1MB，显示KB
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; // 大于1MB，显示MB
}

/** 2026-08-10 */
export function formatDate(iso: string): string {
    return iso.slice(0, 10); // 截取前10位，得到2026-08-10
}

/** image/png → PNG；image/svg+xml → SVG+XML */
export function formatMimeBadge(mime: string): string {
    const sub = mime.split('/')[1];
    return sub.toUpperCase();
}

/** 较上7天 +18% / 较上7天 -10% / 较上7天 持平 */
export function formatPrev7DaysDelta(current: number, prev: number): string {
    if (current === 0) {
        return '近期无上传';
    }

  if (prev === 0) {
    return '较上7天 +100%';
  }
  
  const pct = Math.round(((current - prev) / prev) * 100)
  if (pct === 0) return '较上7天 持平'
  return pct > 0 ? `较上7天 +${pct}%` : `较上7天 ${pct}%`
}