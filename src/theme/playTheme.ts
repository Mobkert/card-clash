export interface PlayTheme {
  id: string
  name: string
  cssVars: Record<string, string>
  cloudCount: number
  starCount: number
  showSun: boolean
  showMoon: boolean
  hillPaths: { back: string; mid: string; front: string }
  floaters: string[]
  uiVariant: 'arcade' | 'glass' | 'bold'
}

const HILL_VARIANTS = [
  {
    back: 'M0,160 C180,90 320,120 480,80 C640,40 820,100 960,70 C1080,48 1140,90 1200,110 L1200,200 L0,200 Z',
    mid: 'M0,180 C200,120 380,150 560,110 C740,70 900,130 1080,95 C1140,82 1180,110 1200,125 L1200,200 L0,200 Z',
    front: 'M0,190 C240,145 420,165 600,135 C780,105 960,155 1200,140 L1200,200 L0,200 Z',
  },
  {
    back: 'M0,150 C150,100 350,130 500,75 C680,35 850,95 1000,65 C1100,50 1150,85 1200,100 L1200,200 L0,200 Z',
    mid: 'M0,175 C220,115 400,140 580,100 C760,65 920,125 1100,88 C1160,75 1185,105 1200,118 L1200,200 L0,200 Z',
    front: 'M0,188 C260,150 440,170 620,128 C800,98 980,148 1200,132 L1200,200 L0,200 Z',
  },
  {
    back: 'M0,165 C120,110 280,145 420,95 C600,55 780,115 920,82 C1040,58 1120,95 1200,115 L1200,200 L0,200 Z',
    mid: 'M0,182 C180,125 360,155 540,118 C720,82 880,138 1060,102 C1130,88 1175,115 1200,128 L1200,200 L0,200 Z',
    front: 'M0,192 C200,155 380,172 560,142 C740,112 920,158 1200,145 L1200,200 L0,200 Z',
  },
  {
    back: 'M0,155 C200,85 380,115 520,70 C700,30 860,90 980,60 C1085,42 1145,88 1200,108 L1200,200 L0,200 Z',
    mid: 'M0,178 C240,118 420,148 600,108 C780,68 940,128 1120,92 C1165,80 1190,108 1200,122 L1200,200 L0,200 Z',
    front: 'M0,188 C280,138 460,158 640,125 C820,95 1000,145 1200,135 L1200,200 L0,200 Z',
  },
] as const

const MOODS = [
  {
    name: 'Sunset Arena',
    sky: ['#ff8a65', '#f06292', '#7e57c2', '#311b92'],
    aurora: ['rgba(255, 183, 77, 0.35)', 'rgba(244, 143, 177, 0.28)'],
    hills: ['#8d6e63', '#ad1457', '#558b2f'],
    ground: ['#7cb342', '#33691e'],
    accent: '#ff7043',
    sun: true,
    moon: false,
  },
  {
    name: 'Ocean Clash',
    sky: ['#4dd0e1', '#29b6f6', '#5c6bc0', '#1a237e'],
    aurora: ['rgba(128, 222, 234, 0.35)', 'rgba(100, 181, 246, 0.25)'],
    hills: ['#0277bd', '#00838f', '#2e7d32'],
    ground: ['#66bb6a', '#1b5e20'],
    accent: '#26c6da',
    sun: true,
    moon: false,
  },
  {
    name: 'Candy Battle',
    sky: ['#f48fb1', '#ce93d8', '#90caf9', '#5e35b1'],
    aurora: ['rgba(255, 182, 193, 0.4)', 'rgba(206, 147, 216, 0.3)'],
    hills: ['#ec407a', '#ab47bc', '#66bb6a'],
    ground: ['#aed581', '#558b2f'],
    accent: '#ff4081',
    sun: true,
    moon: false,
  },
  {
    name: 'Neon Night',
    sky: ['#1a1030', '#311b92', '#4a148c', '#0d0221'],
    aurora: ['rgba(0, 229, 255, 0.28)', 'rgba(233, 30, 99, 0.22)'],
    hills: ['#4527a0', '#6a1b9a', '#1b5e20'],
    ground: ['#2e7d32', '#1b4332'],
    accent: '#00e5ff',
    sun: false,
    moon: true,
  },
  {
    name: 'Golden Fields',
    sky: ['#fff59d', '#ffcc80', '#ffb74d', '#f57c00'],
    aurora: ['rgba(255, 241, 118, 0.4)', 'rgba(255, 183, 77, 0.3)'],
    hills: ['#a1887f', '#8d6e63', '#689f38'],
    ground: ['#9ccc65', '#558b2f'],
    accent: '#ffb300',
    sun: true,
    moon: false,
  },
  {
    name: 'Arctic Showdown',
    sky: ['#e1f5fe', '#b3e5fc', '#81d4fa', '#0277bd'],
    aurora: ['rgba(179, 229, 252, 0.45)', 'rgba(129, 212, 250, 0.35)'],
    hills: ['#78909c', '#546e7a', '#eceff1'],
    ground: ['#cfd8dc', '#90a4ae'],
    accent: '#29b6f6',
    sun: false,
    moon: true,
  },
] as const

const FLOATER_POOLS = [
  ['♠', '♥', '♣', '♦', '★', '✦'],
  ['⚔', '🛡', '⚡', '🔥', '❄', '💫'],
  ['🃏', '🎴', '✨', '⭐', '🌟', '💥'],
  ['🌀', '☄', '🌈', '🎯', '🏆', '💎'],
] as const

const UI_VARIANTS = ['arcade', 'glass', 'bold'] as const

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1))
}

export const MENU_THEME: PlayTheme = {
  id: 'menu',
  name: 'Card Clash',
  cloudCount: 4,
  starCount: 20,
  showSun: true,
  showMoon: false,
  hillPaths: HILL_VARIANTS[0],
  floaters: ['♠', '♥', '♣', '♦', '✦', '★'],
  uiVariant: 'glass',
  cssVars: {
    '--bg-base': '#1a237e',
    '--bg-sky-1': '#4fc3f7',
    '--bg-sky-2': '#7e57c2',
    '--bg-sky-3': '#3949ab',
    '--bg-sky-4': '#1a237e',
    '--bg-glow-1': 'rgba(255, 241, 118, 0.45)',
    '--bg-glow-2': 'rgba(255, 138, 128, 0.35)',
    '--bg-glow-3': 'rgba(179, 136, 255, 0.4)',
    '--bg-aurora-1': 'rgba(129, 199, 132, 0.25)',
    '--bg-aurora-2': 'rgba(255, 213, 79, 0.2)',
    '--bg-sun-x': '88%',
    '--bg-sun-y': '6%',
    '--bg-sun-core': 'radial-gradient(circle at 35% 35%, #fff9c4, #ffeb3b 45%, #ff9800 100%)',
    '--bg-hill-back': '#5c6bc0',
    '--bg-hill-mid': '#7e57c2',
    '--bg-hill-front': '#43a047',
    '--bg-ground-1': '#66bb6a',
    '--bg-ground-2': '#2e7d32',
    '--ui-accent': '#ffd700',
    '--ui-accent-soft': 'rgba(255, 215, 0, 0.15)',
    '--ui-accent-text': '#ffd700',
    '--ui-panel-bg': 'rgba(15, 20, 55, 0.62)',
    '--ui-panel-border': 'rgba(255, 255, 255, 0.14)',
    '--ui-radius': '14px',
    '--ui-header-bg': 'rgba(255, 255, 255, 0.08)',
    '--cloud-speed-1': '38s',
    '--cloud-speed-2': '48s',
  },
}

export function generatePlayTheme(): PlayTheme {
  const mood = pick(MOODS)
  const hills = pick(HILL_VARIANTS)
  const floaters = pick(FLOATER_POOLS)
  const uiVariant = pick(UI_VARIANTS)
  const sunX = `${rand(8, 85)}%`
  const sunY = `${rand(4, 18)}%`

  return {
    id: `play_${Date.now()}_${randInt(1000, 9999)}`,
    name: mood.name,
    cloudCount: randInt(2, 6),
    starCount: mood.moon ? randInt(35, 55) : randInt(12, 28),
    showSun: mood.sun,
    showMoon: mood.moon,
    hillPaths: hills,
    floaters: [...floaters].sort(() => Math.random() - 0.5).slice(0, 6),
    uiVariant,
    cssVars: {
      '--bg-base': mood.sky[3],
      '--bg-sky-1': mood.sky[0],
      '--bg-sky-2': mood.sky[1],
      '--bg-sky-3': mood.sky[2],
      '--bg-sky-4': mood.sky[3],
      '--bg-glow-1': mood.aurora[0],
      '--bg-glow-2': mood.aurora[1],
      '--bg-glow-3': mood.aurora[0],
      '--bg-aurora-1': mood.aurora[0],
      '--bg-aurora-2': mood.aurora[1],
      '--bg-sun-x': sunX,
      '--bg-sun-y': sunY,
      '--bg-sun-core': mood.moon
        ? 'radial-gradient(circle at 40% 40%, #fff, #e1f5fe 55%, #90caf9 100%)'
        : 'radial-gradient(circle at 35% 35%, #fff9c4, #ffeb3b 45%, #ff9800 100%)',
      '--bg-hill-back': mood.hills[0],
      '--bg-hill-mid': mood.hills[1],
      '--bg-hill-front': mood.hills[2],
      '--bg-ground-1': mood.ground[0],
      '--bg-ground-2': mood.ground[1],
      '--ui-accent': mood.accent,
      '--ui-accent-soft': `${mood.accent}26`,
      '--ui-accent-text': mood.accent,
      '--ui-panel-bg': mood.moon ? 'rgba(10, 15, 40, 0.72)' : 'rgba(15, 20, 55, 0.62)',
      '--ui-panel-border': `${mood.accent}44`,
      '--ui-radius': uiVariant === 'bold' ? '8px' : uiVariant === 'arcade' ? '20px' : '14px',
      '--ui-header-bg': `${mood.accent}18`,
      '--cloud-speed-1': `${randInt(28, 52)}s`,
      '--cloud-speed-2': `${randInt(34, 58)}s`,
    },
  }
}

export function themeStyle(theme: PlayTheme): Record<string, string> {
  return theme.cssVars as Record<string, string>
}
