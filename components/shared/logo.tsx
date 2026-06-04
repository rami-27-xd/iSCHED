import Image from 'next/image'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Show only the icon without text */
  iconOnly?: boolean
}

const ICON_SIZES = { sm: 32, md: 48, lg: 80 }

export function Logo({ size = 'md', className, iconOnly: _iconOnly = false }: LogoProps) {
  const px = ICON_SIZES[size]
  return (
    <Image
      src="/images/logo.png"
      alt="iSched"
      width={px}
      height={px}
      className={className}
      priority
    />
  )
}
