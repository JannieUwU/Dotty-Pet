const AVATAR_COLORS = ['#1F2937', '#496D64', '#D98D3D', '#4F5D8C', '#9D4D63', '#5D8F77']

export const getAvatarInitial = (name?: string) => {
  const firstChar = name?.trim().charAt(0)
  return firstChar ? firstChar.toUpperCase() : 'G'
}

export const getAvatarColor = (seed?: string) => {
  const value = seed || 'guest'
  const hash = value.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}
