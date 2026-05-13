// Pet bubble notification message pools

const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

// ── Pomodoro ──────────────────────────────────────────────────────────────────

const FOCUS_END_WITH_TASK: Array<(task: string) => string> = [
  (task) => `Focus session done! "${task}" is looking great~`,
  (task) => `Great work on "${task}"! Time for a well-earned break~`,
]

const FOCUS_END_GENERIC: string[] = [
  `You crushed it! Take a little break, you deserve it~`,
  `Ding ding! Break time. Go grab some water~`,
  `Nice work! Rest up before the next round~`,
  `Session complete~ I'm proud of you!`,
  `That's a wrap! Break time~`,
]

const BREAK_END_MSGS: string[] = [
  `Break's over! Ready to dive back in?`,
  `Let's go! Your next focus session is starting~`,
  `Okay okay, back to work we go~`,
  `Refreshed? Let's make this session count!`,
  `Time to focus again! You've got this~`,
]

const DEFAULT_TASK = 'Task name'

export const focusEndMessage = (task: string): string => {
  if (!task || task === DEFAULT_TASK) return pick(FOCUS_END_GENERIC)
  return Math.random() < 0.4 ? pick(FOCUS_END_WITH_TASK)(task) : pick(FOCUS_END_GENERIC)
}

export const breakEndMessage = (): string =>
  pick(BREAK_END_MSGS)

// ── Schedule events ───────────────────────────────────────────────────────────

const EVENT_MSGS: Array<(title: string) => string> = [
  (title) => `Hey! "${title}" is starting now~`,
  (title) => `Heads up — "${title}" is happening right now!`,
  (title) => `Don't forget: "${title}" starts now~`,
  (title) => `Time for "${title}"! Go go go~`,
]

export const eventMessage = (title: string): string =>
  pick(EVENT_MSGS)(title)

// ── Habits ────────────────────────────────────────────────────────────────────

const HABIT_MSGS: Array<(name: string, icon: string) => string> = [
  (name, icon) => `Time for ${icon} ${name}! You've got this~`,
  (name, icon) => `Hey, don't skip ${icon} ${name} today!`,
  (name, icon) => `${icon} ${name} time! Small steps, big wins~`,
  (name, icon) => `Your ${icon} ${name} reminder is here~ Let's do it!`,
  (name, icon) => `${icon} ${name} o'clock! I believe in you~`,
]

export const habitMessage = (name: string, icon: string): string =>
  pick(HABIT_MSGS)(name, icon)
