import { useState } from 'react'

interface NavItemProps {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}

export const NavItem = ({ icon, label, active, onClick }: NavItemProps) => {
  const [hovered, setHovered] = useState(false)
  const highlighted = hovered || active

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: '100%',
        height: 28,
        borderRadius: 6,
        background: active
          ? 'var(--c-accent-tint)'
          : hovered ? 'var(--c-bg-hover)' : 'transparent',
        border: highlighted ? '0.5px solid var(--c-border)' : '0.5px solid transparent',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        paddingLeft: 8,
        cursor: 'pointer',
        transition: 'background 0.18s ease, border-color 0.18s ease',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <span style={{ color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {icon}
      </span>
      <span style={{
        fontFamily: 'Inter', fontSize: 10,
        fontWeight: active ? 600 : 500,
        color: active ? 'var(--c-text-primary)' : 'var(--c-text-secondary)',
        transition: 'color 0.18s ease',
      }}>
        {label}
      </span>
    </div>
  )
}
