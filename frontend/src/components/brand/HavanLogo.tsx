import Image from 'next/image'

type HavanLogoProps = {
  size?: number
  variant?: 'light' | 'dark'
  className?: string
}

export function HavanLogo({
  size = 48,
  variant = 'light',
  className = '',
}: HavanLogoProps) {
  return (
    <span
      className={className}
      data-variant={variant}
      style={{
        display: 'inline-flex',
        width: size * 2.2,
        height: size,
        overflow: 'hidden',
        alignItems: 'center',
        borderRadius: 0,
        background: 'transparent',
      }}
    >
      <Image
        src="/brand/havan-logo.png"
        alt="Havan"
        width={size * 2.2}
        height={size}
        priority={size >= 56}
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
      />
    </span>
  )
}
