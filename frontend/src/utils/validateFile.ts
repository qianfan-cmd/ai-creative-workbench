/**验证文件 */
const ALLOWED_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'md']
const MAX_SIZE = 52_428_800

export default function validateFile(file: File): string | null {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXT.includes(ext)) {
        return `仅支持 ${ALLOWED_EXT.join(', ')} 格式文件`;
    }
    if (file.size > MAX_SIZE) {
        return `文件大小不能超过50MB`;
    }
    return null;
}

export { ALLOWED_EXT, MAX_SIZE };