// 颜色工具：结果页与分享海报共用，保证主题色派生逻辑只有一份实现

export interface RgbColor {
  r: number
  g: number
  b: number
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace('#', '')
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized

  return {
    r: parseInt(full.substring(0, 2), 16),
    g: parseInt(full.substring(2, 4), 16),
    b: parseInt(full.substring(4, 6), 16),
  }
}

export function mixRgb(base: RgbColor, target: RgbColor, weight: number): RgbColor {
  const ratio = Math.max(0, Math.min(1, weight))
  return {
    r: Math.round(base.r * (1 - ratio) + target.r * ratio),
    g: Math.round(base.g * (1 - ratio) + target.g * ratio),
    b: Math.round(base.b * (1 - ratio) + target.b * ratio),
  }
}

export function toRgbString(color: RgbColor, alpha?: number): string {
  if (alpha === undefined) {
    return `rgb(${color.r}, ${color.g}, ${color.b})`
  }

  return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`
}

/** WCAG 相对亮度（0 为全黑，1 为全白） */
export function relativeLuminance(color: RgbColor): number {
  const channel = (value: number) => {
    const scaled = value / 255
    return scaled <= 0.03928
      ? scaled / 12.92
      : ((scaled + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * channel(color.r) + 0.7152 * channel(color.g) + 0.0722 * channel(color.b)
}

const DARK_TEXT: RgbColor = { r: 47, g: 58, b: 69 }

/**
 * 在任意 accent 背景上选择可读文字色：
 * 深/中饱和度背景返回白色，浅色背景（如 #F5E6E8）返回深灰，避免白字不可见。
 */
export function readableTextColorOn(hex: string): string {
  return relativeLuminance(hexToRgb(hex)) > 0.45
    ? toRgbString(DARK_TEXT)
    : '#ffffff'
}

/**
 * 浅色 accent 用作浅色背景上的前景色时（海报标题、标签文字），
 * 往深色混合以保住对比度，同时尽量保留原有色相。
 */
export function ensureReadableOnLight(hex: string): string {
  const base = hexToRgb(hex)
  if (relativeLuminance(base) <= 0.3) {
    return hex
  }
  return toRgbString(mixRgb(base, DARK_TEXT, 0.52))
}
