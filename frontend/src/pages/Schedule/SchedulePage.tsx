import { ContainerA } from './ContainerA'
import { ContainerB } from './ContainerB'
import { ContainerC } from './ContainerC'

export const SchedulePage = () => (
  <div style={{ padding: '8px 10px 8px 10px', display: 'flex', flexDirection: 'column', gap: 8, height: '100%', boxSizing: 'border-box' }}>
    {/* Row 1 */}
    <div style={{ display: 'flex', gap: 8, flexShrink: 0, width: '100%' }}>
      <ContainerA />
      <ContainerB />
    </div>
    {/* Row 2 */}
    <ContainerC />
  </div>
)
