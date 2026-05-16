import { useState, useRef, useEffect } from 'react'
import { useT } from '../../i18n'

const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
  <div id={id} style={{ marginBottom: 36 }}>
    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--c-text-base)', marginBottom: 10, paddingBottom: 6, borderBottom: '0.5px solid var(--c-border)' }}>{title}</div>
    <div style={{ fontSize: 10, color: 'var(--c-text-secondary)', lineHeight: 1.9 }}>{children}</div>
  </div>
)

const Row = ({ label, desc }: { label: string; desc: string }) => (
  <div style={{ display: 'flex', gap: 8, marginBottom: 5 }}>
    <span style={{ fontWeight: 700, color: 'var(--c-text-base)', minWidth: 150, flexShrink: 0 }}>{label}</span>
    <span style={{ color: 'var(--c-text-secondary)' }}>{desc}</span>
  </div>
)

const Sub = ({ title }: { title: string }) => (
  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-base)', marginTop: 14, marginBottom: 6 }}>{title}</div>
)

const Tip = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: 'var(--c-accent-tint)', border: '0.5px solid var(--c-accent)', borderRadius: 8, padding: '6px 10px', marginTop: 8, fontSize: 9, color: 'var(--c-text-base)' }}>
    💡 {children}
  </div>
)

const Warn = ({ children }: { children: React.ReactNode }) => (
  <div style={{ background: 'rgba(249,206,156,0.12)', border: '0.5px solid #F9CE9C', borderRadius: 8, padding: '6px 10px', marginTop: 8, fontSize: 9, color: 'var(--c-text-base)' }}>
    ⚠️ {children}
  </div>
)

const Steps = ({ steps }: { steps: readonly string[] }) => (
  <ol style={{ margin: '6px 0 6px 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
    {steps.map((s, i) => <li key={i} style={{ fontSize: 10, color: 'var(--c-text-secondary)', lineHeight: 1.7 }}>{s}</li>)}
  </ol>
)

export const QuickStartPage = () => {
  const t = useT()
  const qs = t.quickStart
  const [active, setActive] = useState('overview')
  const scrollRef = useRef<HTMLDivElement>(null)

  const SECTIONS = [
    { id: 'overview',   label: qs.sections.overview },
    { id: 'schedule',   label: qs.sections.schedule },
    { id: 'pomodoro',   label: qs.sections.pomodoro },
    { id: 'habits',     label: qs.sections.habits },
    { id: 'tracker',    label: qs.sections.tracker },
    { id: 'breakdown',  label: qs.sections.breakdown },
    { id: 'statistics', label: qs.sections.statistics },
    { id: 'resource',   label: qs.sections.resource },
    { id: 'pet',        label: qs.sections.pet },
    { id: 'settings',   label: qs.sections.settings },
  ]

  const scrollTo = (id: string) => {
    setActive(id)
    scrollRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      for (const s of [...SECTIONS].reverse()) {
        const el = container.querySelector(`#${s.id}`) as HTMLElement | null
        if (el && el.offsetTop <= container.scrollTop + 40) { setActive(s.id); break }
      }
    }
    container.addEventListener('scroll', onScroll)
    return () => container.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--c-bg-page)', borderRadius: 18, border: '0.5px solid var(--c-border)', overflow: 'hidden' }}>
      {/* Top nav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '0 14px', height: 38, borderBottom: '0.5px solid var(--c-border)', flexShrink: 0, overflowX: 'auto' }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--c-text-base)', marginRight: 10, flexShrink: 0 }}>{qs.title}</span>
        {SECTIONS.map((s) => (
          <div
            key={s.id}
            onClick={() => scrollTo(s.id)}
            style={{
              padding: '4px 10px',
              borderRadius: 6,
              cursor: 'pointer',
              flexShrink: 0,
              background: active === s.id ? 'var(--c-text-primary)' : 'transparent',
              transition: 'background 0.15s',
            }}
          >
            <span style={{ fontSize: 9, fontWeight: 600, color: active === s.id ? 'var(--c-bg-page)' : 'var(--c-text-muted)' }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* Content */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 28px' }}>

        <Section id="overview" title={qs.overview.title}>
          <p style={{ marginBottom: 10 }}>{qs.overview.intro}</p>
          <Sub title={qs.overview.archTitle} />
          <Row label="Electron UI" desc={qs.overview.electron} />
          <Row label="Python backend" desc={qs.overview.backend} />
          <Row label="Unity" desc={qs.overview.unity} />
          <Sub title={qs.overview.navTitle} />
          <Row label={qs.sections.overview} desc={qs.overview.sidebar} />
          <Row label={qs.sections.settings} desc={qs.overview.tray} />
          <Tip>{qs.overview.tip}</Tip>
        </Section>

        <Section id="schedule" title={qs.schedule.title}>
          <p style={{ marginBottom: 10 }}>{qs.schedule.intro}</p>
          <Sub title={qs.schedule.addTitle} />
          <Steps steps={qs.schedule.steps} />
          <Sub title={qs.schedule.viewsTitle} />
          <Row label="Daily" desc={qs.schedule.daily} />
          <Row label="Weekly" desc={qs.schedule.weekly} />
          <Row label="Monthly" desc={qs.schedule.monthly} />
          <Row label="Month picker" desc={qs.schedule.picker} />
          <Sub title={qs.schedule.colorsTitle} />
          <Row label="Teal #83B5B5" desc={qs.schedule.colorTeal} />
          <Row label="Orange #F9CE9C" desc={qs.schedule.colorOrange} />
          <Row label="Green #C1D09D" desc={qs.schedule.colorGreen} />
          <Row label="Blue-grey #BFC5D5" desc={qs.schedule.colorBlue} />
          <Sub title={qs.schedule.goalsTitle} />
          <Row label={t.common.add} desc={qs.schedule.goalsAdd} />
          <Row label={`${t.common.edit} / ${t.common.delete}`} desc={qs.schedule.goalsEdit} />
          <Sub title={qs.schedule.countdownTitle} />
          <Row label={t.common.countdown} desc={qs.schedule.countdown} />
          <Tip>{qs.schedule.tip}</Tip>
        </Section>

        <Section id="pomodoro" title={qs.pomodoro.title}>
          <p style={{ marginBottom: 10 }}>{qs.pomodoro.intro}</p>
          <Sub title={qs.pomodoro.timerTitle} />
          <Row label="Task name" desc={qs.pomodoro.taskName} />
          <Row label="Focus" desc={qs.pomodoro.focusDur} />
          <Row label="Break" desc={qs.pomodoro.breakDur} />
          <Row label="Start / Pause" desc={qs.pomodoro.startPause} />
          <Row label="Skip" desc={qs.pomodoro.skip} />
          <Sub title={qs.pomodoro.advTitle} />
          <Row label="Auto-start Break" desc={qs.pomodoro.autoBreak} />
          <Row label="Auto-start Focus" desc={qs.pomodoro.autoFocus} />
          <Row label="Long Break" desc={qs.pomodoro.longBreak} />
          <Sub title={qs.pomodoro.histTitle} />
          <Row label="Donut chart" desc={qs.pomodoro.donut} />
          <Row label="Daily / Weekly / Monthly" desc={qs.pomodoro.views} />
          <Sub title={qs.pomodoro.tasksTitle} />
          <Row label="Task list" desc={qs.pomodoro.taskList} />
          <Tip>{qs.pomodoro.tip}</Tip>
        </Section>

        <Section id="habits" title={qs.habits.title}>
          <p style={{ marginBottom: 10 }}>{qs.habits.intro}</p>
          <Sub title={qs.habits.addTitle} />
          <Steps steps={qs.habits.steps} />
          <Sub title={qs.habits.checkinTitle} />
          <Row label="Check in" desc={qs.habits.checkin} />
          <Row label="Undo" desc={qs.habits.undo} />
          <Sub title={qs.habits.colorsTitle} />
          <p>{qs.habits.colors}</p>
          <Tip>{qs.habits.tip}</Tip>
          <Warn>{qs.habits.warn}</Warn>
        </Section>

        <Section id="tracker" title={qs.tracker.title}>
          <p style={{ marginBottom: 10 }}>{qs.tracker.intro}</p>
          <Sub title={qs.tracker.gridTitle} />
          <Row label="Each row" desc={qs.tracker.row} />
          <Row label="Squares" desc={qs.tracker.squares} />
          <Row label="Stats" desc={qs.tracker.stats} />
          <Sub title={qs.tracker.badgesTitle} />
          <Row label="🥇 Medal" desc={qs.tracker.medal} />
          <Row label="🏆 Trophy" desc={qs.tracker.trophy} />
          <Row label="👑 Crown" desc={qs.tracker.crown} />
          <Sub title={qs.tracker.pageTitle} />
          <Row label="Pages" desc={qs.tracker.pages} />
          <Tip>{qs.tracker.tip}</Tip>
        </Section>

        <Section id="breakdown" title={qs.breakdown.title}>
          <p style={{ marginBottom: 10 }}>{qs.breakdown.intro}</p>
          <Sub title={qs.breakdown.selectTitle} />
          <p>{qs.breakdown.select}</p>
          <Sub title={qs.breakdown.addTitle} />
          <Steps steps={qs.breakdown.steps} />
          <Sub title={qs.breakdown.editTitle} />
          <Row label="Name" desc={qs.breakdown.name} />
          <Row label="Icon" desc={qs.breakdown.icon} />
          <Row label="Note" desc={qs.breakdown.note} />
          <Row label="Mark as done" desc={qs.breakdown.done} />
          <Row label="Insert Before / After" desc={qs.breakdown.insert} />
          <Row label={t.common.delete} desc={qs.breakdown.del} />
          <Tip>{qs.breakdown.tip}</Tip>
        </Section>

        <Section id="statistics" title={qs.statistics.title}>
          <p style={{ marginBottom: 10 }}>{qs.statistics.intro}</p>
          <Sub title={qs.statistics.overviewTitle} />
          <Row label="Focus Time" desc={qs.statistics.focusTime} />
          <Row label="Tasks Done" desc={qs.statistics.tasksDone} />
          <Row label="Best Streak" desc={qs.statistics.streak} />
          <Row label="Goals" desc={qs.statistics.goals} />
          <Row label="Donut chart" desc={qs.statistics.donut} />
          <Sub title={qs.statistics.habitTitle} />
          <Row label="365-day heatmap" desc={qs.statistics.heatmap} />
          <Row label="30-day line chart" desc={qs.statistics.lineChart} />
          <Sub title={qs.statistics.focusTitle} />
          <Row label="Bar chart" desc={qs.statistics.bar} />
          <Row label="Pie chart" desc={qs.statistics.pie} />
          <Tip>{qs.statistics.tip}</Tip>
        </Section>

        <Section id="resource" title={qs.resource.title}>
          <p style={{ marginBottom: 10 }}>{qs.resource.intro}</p>
          <Sub title={qs.resource.folderTitle} />
          <Steps steps={qs.resource.folderSteps} />
          <Sub title={qs.resource.importTitle} />
          <Steps steps={qs.resource.importSteps} />
          <Sub title={qs.resource.browseTitle} />
          <Row label="Grid view" desc={qs.resource.grid} />
          <Row label="List view" desc={qs.resource.list} />
          <Row label="Sort" desc={qs.resource.sort} />
          <Row label={t.common.search} desc={qs.resource.search} />
          <Sub title={qs.resource.opsTitle} />
          <Row label="Right-click" desc={qs.resource.rightClick} />
          <Row label="Breadcrumb" desc={qs.resource.breadcrumb} />
          <Tip>{qs.resource.tip}</Tip>
          <Warn>{qs.resource.warn}</Warn>
        </Section>

        <Section id="pet" title={qs.pet.title}>
          <p style={{ marginBottom: 10 }}>{qs.pet.intro}</p>
          <Sub title={qs.pet.basicTitle} />
          <Row label="Drag" desc={qs.pet.drag} />
          <Row label="Always on top" desc={qs.pet.alwaysTop} />
          <Row label="Right-click" desc={qs.pet.rightClick} />
          <Sub title={qs.pet.emotionTitle} />
          <Row label="Focused" desc={qs.pet.focused} />
          <Row label="Happy" desc={qs.pet.happy} />
          <Row label="Tired" desc={qs.pet.tired} />
          <Row label="Idle" desc={qs.pet.idle} />
          <Sub title={qs.pet.chatTitle} />
          <Row label="Chat" desc={qs.pet.chat} />
          <Row label="Daily memo" desc={qs.pet.memo} />
          <Row label="Daily review" desc={qs.pet.review} />
          <Sub title={qs.pet.notifTitle} />
          <Row label="Speech bubbles" desc={qs.pet.bubbles} />
          <Row label="Break reminders" desc={qs.pet.breakReminder} />
          <Tip>{qs.pet.tip}</Tip>
        </Section>

        <Section id="settings" title={qs.settings.title}>
          <p style={{ marginBottom: 10 }}>{qs.settings.intro}</p>
          <Sub title={qs.settings.aiTitle} />
          <Row label="Ollama" desc={qs.settings.ollama} />
          <Sub title={qs.settings.pomodoroTitle} />
          <Row label="Focus" desc={qs.settings.focusDur} />
          <Row label="Break" desc={qs.settings.breakDur} />
          <Row label="Long Break" desc={qs.settings.longBreakDur} />
          <Sub title={qs.settings.retentionTitle} />
          <Row label="Retention" desc={qs.settings.retention} />
          <Sub title={qs.settings.accountTitle} />
          <Row label="Username" desc={qs.settings.username} />
          <Row label="Avatar" desc={qs.settings.avatar} />
          <Row label="Password" desc={qs.settings.changePw} />
          <Row label="Theme" desc={qs.settings.theme} />
          <Tip>{qs.settings.tip}</Tip>
        </Section>

        <div style={{ height: 20 }} />
      </div>
    </div>
  )
}
