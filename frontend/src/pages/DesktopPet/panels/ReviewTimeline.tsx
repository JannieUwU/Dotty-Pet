/**
 * ReviewTimeline — floating cards with a left-side timeline.
 * Each card has a date circle on the left; circles are connected by a vertical line.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type React from 'react'
import type { ReviewsStatus } from '../usePetStore'
import { useT } from '../../../i18n'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Review {
  id: string
  date: string          // ISO date string "YYYY-MM-DD"
  rating: 1 | 2 | 3 | 4 | 5
  mood: string          // emoji
  title: string
  content: string
}

interface ReviewTimelineProps {
  reviews: Review[]
  loading?: boolean
  reviewsStatus?: ReviewsStatus
  retentionCutoff?: string   // YYYY-MM-DD
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MONTH_LABELS: Record<number, string> = {
  0: 'Jan', 1: 'Feb', 2: 'Mar', 3: 'Apr', 4: 'May', 5: 'Jun',
  6: 'Jul', 7: 'Aug', 8: 'Sep', 9: 'Oct', 10: 'Nov', 11: 'Dec',
}

function groupByMonth(reviews: Review[]): { key: string; label: string; items: Review[] }[] {
  const sorted = [...reviews].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const map = new Map<string, Review[]>()
  for (const r of sorted) {
    const [ry, rm] = r.date.split('-').map(Number)
    const key = `${ry}-${String(rm).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(r)
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const year  = Number(key.slice(0, 4))
    const month = Number(key.slice(5)) - 1
    return { key, label: `${MONTH_LABELS[month]} ${year}`, items }
  })
}

// All circles and lines use the system accent color
const ACCENT       = '#83B5B5'
const ACCENT_BG    = 'rgba(131,181,181,0.12)'
const ACCENT_LIGHT = 'rgba(131,181,181,0.30)'

// ── ReviewCard ────────────────────────────────────────────────────────────────

const ReviewCard = ({
  review,
  index,
  isLast,
}: {
  review: Review
  index: number
  isLast: boolean       // controls whether the connector line extends below
}) => {
  const [visible, setVisible] = useState(false)
  const [hovered, setHovered] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect() } },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const stars  = Array.from({ length: 5 }, (_, i) => i < review.rating ? '★' : '☆')
  const [y, m, d] = review.date.split('-').map(Number)
  const dayNum    = d
  const dateStr   = new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  // Entrance animation delay — stagger cards
  const entranceDelay = `${index * 0.055}s`

  return (
    // Outer row: [timeline track | card body]
    <div
      ref={ref}
      style={{
        display: 'flex',
        alignItems: 'stretch',   // track stretches to full card height
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(12px)',
        transition: `opacity 0.36s ease ${entranceDelay}, transform 0.36s ease ${entranceDelay}`,
        willChange: 'opacity, transform',
        marginBottom: 8,
      }}
    >
      {/* ── Left timeline track ─────────────────────────────────────── */}
      <div style={{
        width: 32,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        // Vertically align circle with the top of the card (accounting for card padding)
        paddingTop: 10,
      }}>
        {/* Date circle */}
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: '50%',
            background: ACCENT_BG,
            border: `1.5px solid ${ACCENT_LIGHT}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transform: hovered ? 'scale(1.12)' : 'scale(1)',
            transition: 'transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
            zIndex: 1,
          }}
          aria-hidden="true"
        >
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: ACCENT,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}>
            {dayNum}
          </span>
        </div>

        {/* Connector line */}
        {!isLast && (
          <div style={{
            flex: 1,
            width: 1.5,
            minHeight: 8,
            marginTop: 3,
            background: `linear-gradient(to bottom, ${ACCENT_LIGHT} 0%, #e8e8e8 100%)`,
          }} />
        )}
      </div>

      {/* ── Floating card ───────────────────────────────────────────── */}
      <div
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          flex: 1,
          background: 'var(--c-bg-card)',
          borderRadius: 12,
          padding: '10px 13px',
          boxShadow: hovered
            ? '0 6px 20px rgba(0,0,0,0.10), 0 2px 6px rgba(0,0,0,0.06)'
            : '0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
          transform: hovered ? 'translateY(-2px) scale(1.018)' : 'translateY(0) scale(1)',
          transition: 'box-shadow 0.22s ease, transform 0.22s cubic-bezier(0.34,1.56,0.64,1)',
          cursor: 'default',
          willChange: 'transform, box-shadow',
        }}
        role="article"
        aria-label={`Review: ${review.title}, ${review.rating} stars`}
      >
        {/* Header: mood + title/date + stars */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 7 }}>
          <span style={{ fontSize: 16, lineHeight: 1, flexShrink: 0, marginTop: 1 }} aria-hidden="true">
            {review.mood}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: 'var(--c-text-base)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {review.title}
            </div>
            <div style={{ fontSize: 9, color: 'var(--c-text-faint)', marginTop: 1 }}>{dateStr}</div>
          </div>
          <div
            style={{ display: 'flex', gap: 1, flexShrink: 0, paddingTop: 1 }}
            aria-label={`${review.rating} out of 5 stars`}
          >
            {stars.map((s, i) => (
              <span
                key={`star-${review.id}-${i}`}
                style={{
                  fontSize: 10,
                  color: s === '★'
                    ? (review.rating >= 4 ? '#83B5B5' : review.rating === 3 ? '#F9CE9C' : '#e0a0a0')
                    : 'var(--c-border)',
                }}
                aria-hidden="true"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Content */}
        <p style={{ fontSize: 10, color: 'var(--c-text-muted)', lineHeight: 1.65, margin: 0 }}>
          {review.content}
        </p>
      </div>
    </div>
  )
}

// ── Skeleton card (generating state) ─────────────────────────────────────────

const SkeletonCard = () => (
  <div style={{ display: 'flex', alignItems: 'flex-start', marginBottom: 8 }}>
    {/* Skeleton circle */}
    <div style={{ width: 32, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 10 }}>
      <div style={shimmer({ width: 24, height: 24, borderRadius: '50%' })} />
    </div>
    {/* Skeleton body */}
    <div style={{
      flex: 1, background: 'var(--c-bg-card)', borderRadius: 12, padding: '10px 13px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={shimmer({ width: 18, height: 18, borderRadius: '50%' })} />
        <div style={{ flex: 1 }}>
          <div style={shimmer({ width: '55%', height: 9, borderRadius: 4, marginBottom: 5 })} />
          <div style={shimmer({ width: '30%', height: 7, borderRadius: 4 })} />
        </div>
      </div>
      <div style={shimmer({ width: '88%', height: 8, borderRadius: 4, marginBottom: 5 })} />
      <div style={shimmer({ width: '65%', height: 8, borderRadius: 4 })} />
    </div>
  </div>
)

function shimmer(extra: React.CSSProperties): React.CSSProperties {
  return {
    background: 'linear-gradient(90deg, var(--c-bg-muted) 25%, var(--c-border) 50%, var(--c-bg-muted) 75%)',
    backgroundSize: '200% 100%',
    animation: 'shimmer 1.4s infinite',
    flexShrink: 0,
    ...extra,
  }
}

// ── ReviewTimeline ────────────────────────────────────────────────────────────

export const ReviewTimeline = ({ reviews, loading, reviewsStatus, retentionCutoff }: ReviewTimelineProps) => {
  const scrollRef  = useRef<HTMLDivElement>(null)
  const [atTop,    setAtTop]    = useState(true)
  const [atBottom, setAtBottom] = useState(true)
  const t = useT()

  const groups = groupByMonth(reviews)

  // Flatten all reviews in display order so we can compute the global last index
  const allReviews = groups.flatMap(g => g.items)

  const syncFades = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setAtTop(el.scrollTop < 8)
    setAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 8)
  }, [])

  useEffect(() => {
    const id = requestAnimationFrame(syncFades)
    return () => cancelAnimationFrame(id)
  }, [reviews.length, syncFades])

  const isGenerating = reviewsStatus === 'generating'
  const isError      = reviewsStatus === 'error'

  const retentionLabel = retentionCutoff
    ? (() => {
        const [y, m, d] = retentionCutoff.split('-').map(Number)
        return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      })()
    : null

  return (
    <div style={outerStyle}>
      {/* Header */}
      <div style={headerRow}>
        <span style={titleStyle}>{t.desktopPet.reviews.title}</span>
        <span style={countStyle} aria-live="polite">
          {loading ? '—' : `${reviews.length} ${reviews.length === 1 ? t.desktopPet.reviews.entry : t.desktopPet.reviews.entries}`}
        </span>
      </div>

      {/* Retention hint */}
      {!loading && retentionLabel && (
        <div style={retentionHint} aria-label={`Reviews kept since ${retentionLabel}`}>
          {t.desktopPet.reviews.keptSince(retentionLabel, t.desktopPet.reviews.months3)}
        </div>
      )}

      {/* Scroll area */}
      <div style={scrollWrap}>
        {/* Top fade */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 24,
          background: 'linear-gradient(to bottom, var(--c-bg-page) 0%, transparent 100%)',
          pointerEvents: 'none', zIndex: 2,
          opacity: atTop ? 0 : 1, transition: 'opacity 0.2s',
        }} aria-hidden="true" />

        <div
          ref={scrollRef}
          onScroll={syncFades}
          style={scrollList}
          role="feed"
          aria-label="Review timeline"
          aria-busy={loading}
        >
          {/* Loading */}
          {loading && (
            <div style={centeredWrap} role="status">
              <div style={spinnerStyle} />
              <span style={{ fontSize: 10, color: 'var(--c-text-xfaint)' }}>{t.desktopPet.reviews.loading}</span>
            </div>
          )}

          {/* Generating skeleton */}
          {!loading && isGenerating && (
            <div role="status" aria-label="Generating yesterday's review">
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, paddingLeft: 34 }}>
                <div style={spinnerStyle} />
                <span style={{ fontSize: 9, color: 'var(--c-text-faint)' }}>{t.desktopPet.reviews.generating}</span>
              </div>
              <SkeletonCard />
            </div>
          )}

          {/* Empty */}
          {!loading && !isGenerating && reviews.length === 0 && !isError && (
            <div style={centeredWrap} role="status">
              <span style={{ fontSize: 26 }} aria-hidden="true">🐾</span>
              <span style={{ fontSize: 10, color: 'var(--c-text-xfaint)', textAlign: 'center' as const }}>
                {t.desktopPet.reviews.noReviews.split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br />}</span>
                ))}
              </span>
            </div>
          )}

          {/* Error */}
          {!loading && isError && (
            <div style={centeredWrap} role="alert">
              <span style={{ fontSize: 20 }} aria-hidden="true">⚠️</span>
              <span style={{ fontSize: 10, color: '#e0a0a0', textAlign: 'center' as const }}>
                {t.desktopPet.reviews.loadError.split('\n').map((line, i) => (
                  <span key={i}>{line}{i === 0 && <br />}</span>
                ))}
              </span>
            </div>
          )}

          {/* Cards grouped by month */}
          {!loading && groups.map((group) => (
            <div key={group.key}>
              {/* Month label — indented to align with card body (past the 32px track) */}
              <div style={monthLabel} aria-label={`Month: ${group.label}`}>
                {group.label}
              </div>

              {group.items.map((review) => {
                // A card is "last" only if it's the very last review across all groups
                const globalIndex = allReviews.indexOf(review)
                const isLast = globalIndex === allReviews.length - 1
                return (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    index={globalIndex}
                    isLast={isLast}
                  />
                )
              })}
            </div>
          ))}

          <div style={{ height: 8 }} aria-hidden="true" />
        </div>

        {/* Bottom fade */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 24,
          background: 'linear-gradient(to top, var(--c-bg-page) 0%, transparent 100%)',
          pointerEvents: 'none', zIndex: 2,
          opacity: atBottom ? 0 : 1, transition: 'opacity 0.2s',
        }} aria-hidden="true" />
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const outerStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column',
  height: '100%', minHeight: 300, overflow: 'hidden',
}
const headerRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '2px 2px 8px', flexShrink: 0,
}
const titleStyle: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: 'var(--c-text-primary)',
}
const countStyle: React.CSSProperties = {
  fontSize: 9, color: 'var(--c-text-faint)',
}
const retentionHint: React.CSSProperties = {
  fontSize: 9, color: 'var(--c-text-xfaint)',
  padding: '0 2px 8px', flexShrink: 0,
}
const scrollWrap: React.CSSProperties = {
  flex: 1, position: 'relative', overflow: 'hidden',
}
const scrollList: React.CSSProperties = {
  height: '100%', overflowY: 'auto', overflowX: 'hidden',
  padding: '2px 4px 0 2px',
  scrollbarWidth: 'thin' as const,
  scrollbarColor: 'var(--c-border) transparent',
}
const monthLabel: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, color: 'var(--c-text-faint)',
  textTransform: 'uppercase', letterSpacing: '0.07em',
  paddingLeft: 34,
  padding: '4px 2px 6px 34px',
}
const centeredWrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  padding: '40px 0',
}
const spinnerStyle: React.CSSProperties = {
  width: 16, height: 16, borderRadius: '50%',
  border: '2px solid var(--c-border)', borderTopColor: '#83B5B5',
  animation: 'spin 0.8s linear infinite',
  flexShrink: 0,
}
