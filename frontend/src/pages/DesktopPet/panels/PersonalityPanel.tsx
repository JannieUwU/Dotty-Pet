import { useEffect, useState, useCallback } from 'react'
import type React from 'react'
import { usePetStore } from '../usePetStore'
import { useBackendStore } from '../../../store/backendStore'
import { useT } from '../../../i18n'

const MAX_CHARS = 500
const MIN_CHARS = 10
const FC = '#83B5B5'

// ── Preset templates ──────────────────────────────────────────────────────────
// Inspired by Character.AI / Replika starter personas — lowers blank-page anxiety.

const PRESETS = [
  { label: 'Warm & Casual', text: 'Speak in a warm, casual tone like a close friend. Use simple language, be encouraging, and add light humor when the mood is right.' },
  { label: 'Calm & Gentle', text: 'Speak softly and patiently. Keep things calm and reassuring. Never rush — take time to acknowledge feelings before moving to tasks.' },
  { label: 'Energetic', text: 'Be upbeat and enthusiastic! Use short punchy sentences, celebrate wins loudly, and keep the energy high throughout the day.' },
  { label: 'Professional', text: 'Keep a polished, professional tone. Be concise and precise. Focus on clarity and efficiency while staying approachable.' },
]

// ── Client-side content policy ────────────────────────────────────────────────

interface PolicyViolation {
  category: string
  message: string
}

const POLICY_RULES: Array<{ pattern: RegExp; category: string; message: string }> = [
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/i, category: 'Prompt Injection', message: 'Instruction override attempts are not allowed.' },
  { pattern: /\bdan\s*(?:mode|prompt)?\b/i, category: 'Prompt Injection', message: 'Jailbreak attempts are not allowed.' },
  { pattern: /\bdeveloper\s+mode\b/i, category: 'Prompt Injection', message: 'Jailbreak attempts are not allowed.' },
  { pattern: /(?:bypass|override|disable)\s+(?:safety|filter|restriction)/i, category: 'Prompt Injection', message: 'Safety bypass attempts are not allowed.' },
  { pattern: /\b(?:overthrow|topple|subvert)\s+(?:the\s+)?(?:government|state|regime)\b/i, category: 'Political Content', message: 'Political extremism content is not allowed.' },
  { pattern: /\b(?:terrorist|terrorism|extremist|radicali[sz]e)\b/i, category: 'Political Content', message: 'Extremist content is not allowed.' },
  { pattern: /\b(?:election|vote|ballot)\s+(?:fraud|manipulation|rigging)\b/i, category: 'Political Content', message: 'Election manipulation content is not allowed.' },
  { pattern: /\b(?:explicit|graphic|hardcore)\s+(?:sex|sexual|adult|porn|erotic)\b/i, category: 'Adult Content', message: 'Explicit sexual content is not allowed.' },
  { pattern: /\bnsfw\b/i, category: 'Adult Content', message: 'Adult content is not allowed.' },
  { pattern: /\b(?:porn|pornograph|hentai|xxx)\b/i, category: 'Adult Content', message: 'Adult content is not allowed.' },
  { pattern: /\b(?:minor|child|underage|teen|loli|shota)\s+(?:sex|sexual|nude|naked|explicit|erotic|porn)\b/i, category: 'Prohibited Content', message: 'Content involving minors in sexual contexts is strictly prohibited.' },
  { pattern: /\b(?:how\s+to\s+)?(?:make|build|create)\s+(?:a\s+)?(?:bomb|explosive|weapon)\b/i, category: 'Violent Content', message: 'Weapons or violence instructions are not allowed.' },
  { pattern: /\b(?:mass\s+)?(?:shooting|killing|murder|massacre)\s+(?:plan|guide|tutorial)\b/i, category: 'Violent Content', message: 'Violent content is not allowed.' },
  { pattern: /\bself[- ]harm\b/i, category: 'Self-Harm Content', message: 'Self-harm content is not allowed.' },
  { pattern: /\bsuicid(?:e|al)\s+(?:method|how|way|plan)\b/i, category: 'Self-Harm Content', message: 'Self-harm content is not allowed.' },
  { pattern: /\b(?:kill|exterminate|eliminate)\s+(?:all\s+)?(?:jews?|muslims?|blacks?|whites?|asians?|gays?)\b/i, category: 'Hate Speech', message: 'Hate speech targeting protected groups is not allowed.' },
  { pattern: /\b(?:racial|ethnic|religious)\s+(?:slur|epithet|hate|cleansing)\b/i, category: 'Hate Speech', message: 'Hate speech is not allowed.' },
  { pattern: /\b(?:how\s+to\s+)?(?:make|cook|synthesize)\s+(?:meth|heroin|cocaine|fentanyl)\b/i, category: 'Illegal Activity', message: 'Drug manufacturing content is not allowed.' },

  // Profanity / slurs (standalone words)
  { pattern: /\b(?:bitch|bitches|bitchy)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:whore|whores|wh0re)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:slut|sluts)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:cunt|cunts)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:fuck|fucker|fucking|fucked|fucks)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:shit|shits|shitty)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:asshole|assholes)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:bastard|bastards)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:dick|dickhead)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:pussy|pussies)\b/i, category: 'Offensive Language', message: 'Profanity or offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:nigger|nigga)\b/i, category: 'Hate Speech', message: 'Hate speech or slurs are not allowed.' },
  { pattern: /\b(?:faggot|fag|dyke)\b/i, category: 'Hate Speech', message: 'Hate speech or slurs are not allowed.' },
  { pattern: /\b(?:retard|retarded)\b/i, category: 'Offensive Language', message: 'Offensive language is not allowed in personality prompts.' },
  { pattern: /\b(?:chink|spic|kike|wetback|gook|towelhead)\b/i, category: 'Hate Speech', message: 'Hate speech or slurs are not allowed.' },
]

function checkPolicy(text: string): PolicyViolation | null {
  for (const rule of POLICY_RULES) {
    if (rule.pattern.test(text)) return { category: rule.category, message: rule.message }
  }
  return null
}

function mapBackendError(error: string): PolicyViolation | null {
  const e = error.toLowerCase()
  if (e.includes('injection') || e.includes('jailbreak') || e.includes('bypass') || e.includes('system prompt'))
    return { category: 'Prompt Injection', message: error }
  if (e.includes('political') || e.includes('extremis') || e.includes('election'))
    return { category: 'Political Content', message: error }
  if (e.includes('sexual') || e.includes('adult') || e.includes('porn') || e.includes('minor'))
    return { category: 'Adult Content', message: error }
  if (e.includes('violen') || e.includes('weapon') || e.includes('terrorist') || e.includes('explosive'))
    return { category: 'Violent Content', message: error }
  if (e.includes('hate') || e.includes('discriminat') || e.includes('slur'))
    return { category: 'Hate Speech', message: error }
  if (e.includes('drug'))
    return { category: 'Illegal Activity', message: error }
  if (e.includes('profanity') || e.includes('offensive'))
    return { category: 'Offensive Language', message: error }
  if (e.includes('sensitive') || e.includes('disallowed') || e.includes('not allowed') || e.includes('prohibited'))
    return { category: 'Policy Violation', message: error }
  return null
}

// ── Safety modal ──────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  'Prompt Injection': '🔒',
  'Political Content': '🚫',
  'Adult Content': '🔞',
  'Prohibited Content': '⛔',
  'Violent Content': '⚠️',
  'Self-Harm Content': '💙',
  'Hate Speech': '🚫',
  'Illegal Activity': '⚠️',
  'Offensive Language': '🚫',
  'Policy Violation': '🚫',
}

const SafetyModal = ({ violation, onClose }: { violation: PolicyViolation; onClose: () => void }) => {
  const t = useT()
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const displayCategory = t.desktopPet.personality.categoryNames[violation.category] ?? violation.category

  return (
    <div style={overlayStyle} onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="safety-modal-title">
      <div style={modalStyle} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 36, lineHeight: 1 }}>{CATEGORY_ICONS[violation.category] ?? '🚫'}</div>
        <div style={modalCategory} id="safety-modal-title">{t.desktopPet.personality.safetyDetected(displayCategory)}</div>
        <p style={modalMessage}>{violation.message}</p>
        <p style={modalHint}>
          {t.desktopPet.personality.safetyHint}
        </p>
        <button onClick={onClose} style={modalBtn} autoFocus>{t.desktopPet.personality.safetyGotIt}</button>
      </div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────

export const PersonalityPanel = ({ fillHeight = false }: { fillHeight?: boolean }) => {
  const {
    personality, personalityDraft,
    personalityLoading, personalitySaving, personalityError, personalitySaved,
    fetchPersonality, setPersonalityDraft, savePersonality,
  } = usePetStore()
  const backendStatus = useBackendStore(s => s.status)
  const t = useT()

  const [violation, setViolation] = useState<PolicyViolation | null>(null)
  const [showPresets, setShowPresets] = useState(false)

  useEffect(() => {
    if (backendStatus === 'ready') fetchPersonality()
  }, [backendStatus, fetchPersonality])

  // Show modal when backend returns a policy error
  useEffect(() => {
    if (!personalityError) return
    const v = mapBackendError(personalityError)
    if (v) setViolation(v)
  }, [personalityError])

  const trimmed = personalityDraft.trim()
  const charCount = personalityDraft.length
  const overLimit = charCount > MAX_CHARS
  const tooShort = trimmed.length > 0 && trimmed.length < MIN_CHARS
  const barPct = Math.min(100, (charCount / MAX_CHARS) * 100)
  const barColor = overLimit ? '#e05' : barPct > 80 ? '#F9CE9C' : FC

  // Unsaved changes: draft differs from last saved value
  const hasUnsaved = trimmed !== '' && trimmed !== personality.trim()

  const isSaveDisabled = personalitySaving || overLimit || !trimmed || tooShort

  const handleSave = useCallback(() => {
    const v = checkPolicy(personalityDraft)
    if (v) { setViolation(v); return }
    savePersonality()
  }, [personalityDraft, savePersonality])

  const applyPreset = (text: string) => {
    setPersonalityDraft(text)
    setShowPresets(false)
  }

  const isNonPolicyError = personalityError && !mapBackendError(personalityError)

  return (
    <>
      {violation && <SafetyModal violation={violation} onClose={() => setViolation(null)} />}

      <div style={{
        ...panelStyle,
        ...(fillHeight ? { flex: 1, minHeight: 0, overflow: 'hidden', height: '100%' } : {}),
      }}>

        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={panelTitle}>{t.desktopPet.personality.title}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {!personalityLoading && personality && (
              <button
                onClick={() => setPersonalityDraft(personality)}
                style={restoreBtn}
                aria-label="Restore last saved personality"
                title={personality}
              >
                {t.desktopPet.personality.restore}
              </button>
            )}
            <button
              onClick={() => setShowPresets(v => !v)}
              style={presetToggleBtn(showPresets)}
              aria-expanded={showPresets}
              aria-label="Toggle style presets"
            >
              {t.desktopPet.personality.presets} {showPresets ? '▲' : '▼'}
            </button>
          </div>
        </div>

        <div style={{ fontSize: 9, color: 'var(--c-text-faint)', lineHeight: 1.6, flexShrink: 0 }}>
          {t.desktopPet.personality.customize}
        </div>

        {/* Preset chips */}
        {showPresets && (
          <div style={presetsGrid}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p.text)}
                style={presetChip(personalityDraft === p.text)}
                title={p.text}
              >
                {t.desktopPet.personality.presetNames[p.label] ?? p.label}
              </button>
            ))}
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={personalityDraft}
          onChange={e => setPersonalityDraft(e.target.value)}
          placeholder={t.desktopPet.personality.placeholder}
          style={textareaStyle(overLimit, fillHeight)}
          rows={fillHeight ? undefined : 5}
          maxLength={MAX_CHARS + 50}
          aria-label="Personality prompt"
          aria-describedby="personality-counter"
        />

        {/* Validation hints */}
        {tooShort && (
          <div style={hintBox}>
            {t.desktopPet.personality.tooShort(MIN_CHARS)}
          </div>
        )}

        {/* Character counter + progress bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }} id="personality-counter">
          <div style={progressBar}>
            <div style={progressFill(barPct, barColor)} />
          </div>
          <span style={{ fontSize: 9, color: overLimit ? '#e05' : 'var(--c-text-faint)', flexShrink: 0, minWidth: 48, textAlign: 'right' as const }}>
            {charCount} / {MAX_CHARS}
          </span>
        </div>

        {/* Inline error (non-policy only) */}
        {isNonPolicyError && (
          <div style={errorBox} role="alert" aria-live="polite">
            {personalityError}
          </div>
        )}

        {/* Save row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={handleSave}
            disabled={isSaveDisabled}
            style={saveBtn(isSaveDisabled)}
            aria-label="Save personality"
          >
            {personalitySaving ? t.desktopPet.personality.saving : t.common.save}
          </button>

          {personalitySaved && (
            <span style={savedBadge} role="status">{t.desktopPet.personality.saved}</span>
          )}

          {/* Unsaved indicator */}
          {hasUnsaved && !personalitySaved && !personalitySaving && (
            <span style={unsavedDot} title="Unsaved changes" aria-label="Unsaved changes" />
          )}

          <span style={{ fontSize: 9, color: 'var(--c-text-xfaint)', marginLeft: 'auto' }}>
            {t.desktopPet.personality.safetyNote}
          </span>
        </div>
      </div>
    </>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
const modalStyle: React.CSSProperties = {
  background: 'var(--c-bg-card)', borderRadius: 16, padding: '28px 28px 24px',
  width: 320, maxWidth: 'calc(100vw - 40px)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
}
const modalCategory: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: 'var(--c-text-primary)', textAlign: 'center',
}
const modalMessage: React.CSSProperties = {
  fontSize: 11, color: 'var(--c-text-secondary)', textAlign: 'center', lineHeight: 1.6, margin: 0,
}
const modalHint: React.CSSProperties = {
  fontSize: 10, color: 'var(--c-text-faint)', textAlign: 'center', lineHeight: 1.6,
  margin: 0, padding: '8px 0 4px',
  borderTop: '0.5px solid var(--c-border)', width: '100%',
}
const modalBtn: React.CSSProperties = {
  marginTop: 4, height: 34, padding: '0 28px', borderRadius: 9,
  border: 'none', background: 'var(--c-text-primary)', color: 'white',
  fontFamily: 'Inter', fontSize: 11, fontWeight: 600, cursor: 'pointer',
}
const panelStyle: React.CSSProperties = {
  background: 'var(--c-bg-subtle)', borderRadius: 14, border: '0.5px solid var(--c-border)',
  padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10,
}
const panelTitle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)', flexShrink: 0,
}
const restoreBtn: React.CSSProperties = {
  height: 22, padding: '0 10px', borderRadius: 6,
  border: '0.5px solid var(--c-border)', background: 'var(--c-bg-card)',
  fontFamily: 'Inter', fontSize: 9, color: FC,
  fontWeight: 600, cursor: 'pointer', flexShrink: 0,
}
const presetToggleBtn = (active: boolean): React.CSSProperties => ({
  height: 22, padding: '0 10px', borderRadius: 6,
  border: `0.5px solid ${active ? FC : 'var(--c-border)'}`,
  background: active ? `${FC}18` : 'var(--c-bg-card)',
  fontFamily: 'Inter', fontSize: 9, color: active ? FC : 'var(--c-text-faint)',
  fontWeight: 600, cursor: 'pointer', flexShrink: 0,
})
const presetsGrid: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, flexShrink: 0,
}
const presetChip = (active: boolean): React.CSSProperties => ({
  height: 24, padding: '0 10px', borderRadius: 20,
  border: `0.5px solid ${active ? FC : 'var(--c-border)'}`,
  background: active ? `${FC}22` : 'var(--c-bg-card)',
  fontFamily: 'Inter', fontSize: 9,
  color: active ? FC : 'var(--c-text-muted)',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer', whiteSpace: 'nowrap',
})
const textareaStyle = (overLimit: boolean, fillHeight = false): React.CSSProperties => ({
  width: '100%', boxSizing: 'border-box' as const,
  border: `0.5px solid ${overLimit ? '#ffaaaa' : 'var(--c-border)'}`,
  borderRadius: 10, padding: '10px 12px',
  fontFamily: 'Inter', fontSize: 10, color: 'var(--c-text-primary)',
  lineHeight: 1.6, resize: fillHeight ? 'none' as const : 'vertical' as const,
  outline: 'none', background: 'var(--c-bg-card)',
  transition: 'border-color 0.15s',
  overflow: 'auto',
  ...(fillHeight ? { flex: 1, minHeight: 0 } : {}),
})
const hintBox: React.CSSProperties = {
  fontSize: 9, color: 'var(--c-text-faint)', background: 'var(--c-bg-subtle)',
  border: '0.5px solid var(--c-border-light)', borderRadius: 7,
  padding: '6px 10px', flexShrink: 0,
}
const progressBar: React.CSSProperties = {
  flex: 1, height: 4, borderRadius: 2, background: 'var(--c-border)', overflow: 'hidden',
}
const progressFill = (pct: number, color: string): React.CSSProperties => ({
  height: '100%', width: `${pct}%`, background: color,
  borderRadius: 2, transition: 'width 0.1s, background 0.2s',
})
const errorBox: React.CSSProperties = {
  background: '#fff0f0', border: '0.5px solid #ffcccc', borderRadius: 8,
  padding: '8px 10px', fontSize: 9, color: '#cc3333', lineHeight: 1.5,
  flexShrink: 0,
}
const saveBtn = (disabled: boolean): React.CSSProperties => ({
  height: 30, padding: '0 18px', borderRadius: 8, border: 'none',
  background: disabled ? 'var(--c-text-disabled)' : 'var(--c-text-primary)', color: 'white',
  fontFamily: 'Inter', fontSize: 10, fontWeight: 600,
  cursor: disabled ? 'default' : 'pointer',
  transition: 'background 0.15s', flexShrink: 0,
})
const savedBadge: React.CSSProperties = {
  fontSize: 9, color: FC, fontWeight: 600,
}
const unsavedDot: React.CSSProperties = {
  width: 6, height: 6, borderRadius: '50%',
  background: '#F9CE9C', flexShrink: 0,
}
