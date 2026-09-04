import { Avatar } from 'antd'
import type { UserVO } from '@/types/api'
import { normalizeMediaUrl } from '@/utils/mediaUrl'

interface UserAvatarProps {
  user?: UserVO | null
  size?: number
  className?: string
  fallbackName?: string
}

function buildInitials(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return '?'
  return trimmed.slice(0, 2).toUpperCase()
}

export default function UserAvatar({
  user,
  size = 32,
  className,
  fallbackName = '运营账号',
}: UserAvatarProps) {
  const displayName = user?.username?.trim() || fallbackName
  const avatarSrc = normalizeMediaUrl(user?.avatarUrl)
  const initials = buildInitials(displayName)

  if (avatarSrc) {
    return (
      <Avatar
        size={size}
        src={avatarSrc}
        className={className}
        alt={displayName}
      >
        {initials}
      </Avatar>
    )
  }

  return (
    <Avatar size={size} className={className}>
      {initials}
    </Avatar>
  )
}
