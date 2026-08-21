import { describe, expect, it } from 'vitest'

import {
  ensureReadableOnLight,
  hexToRgb,
  mixRgb,
  readableTextColorOn,
  relativeLuminance,
} from '../src/utils/color.ts'

describe('hexToRgb', () => {
  it('解析 6 位与 3 位十六进制', () => {
    expect(hexToRgb('#33A474')).toEqual({ r: 0x33, g: 0xa4, b: 0x74 })
    expect(hexToRgb('FFF')).toEqual({ r: 255, g: 255, b: 255 })
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 })
  })
})

describe('relativeLuminance（WCAG）', () => {
  it('纯黑为 0，纯白约 1', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 6)
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 6)
  })

  it('绿色通道对亮度贡献最大', () => {
    const green = relativeLuminance({ r: 0, g: 255, b: 0 })
    const blue = relativeLuminance({ r: 0, g: 0, b: 255 })
    expect(green).toBeGreaterThan(blue)
  })
})

describe('mixRgb', () => {
  const black = { r: 0, g: 0, b: 0 }
  const white = { r: 255, g: 255, b: 255 }

  it('权重 0/1 取两端，0.5 各半', () => {
    expect(mixRgb(black, white, 0)).toEqual(black)
    expect(mixRgb(black, white, 1)).toEqual(white)
    expect(mixRgb(black, white, 0.5)).toEqual({ r: 128, g: 128, b: 128 })
  })

  it('越界权重被夹取', () => {
    expect(mixRgb(black, white, 2)).toEqual(white)
    expect(mixRgb(black, white, -1)).toEqual(black)
  })
})

describe('readableTextColorOn', () => {
  it('浅色背景返回深色文字，深色背景返回白色', () => {
    expect(readableTextColorOn('#FFFFFF')).not.toBe('#ffffff')
    expect(readableTextColorOn('#F5E6E8')).not.toBe('#ffffff')
    expect(readableTextColorOn('#1A1A2E')).toBe('#ffffff')
    expect(readableTextColorOn('#33A474')).toBe('#ffffff')
  })
})

describe('ensureReadableOnLight', () => {
  it('深色原样返回', () => {
    expect(ensureReadableOnLight('#202020')).toBe('#202020')
  })

  it('浅色被混合到可读亮度以下', () => {
    const mixed = ensureReadableOnLight('#F5E6E8')
    expect(mixed).not.toBe('#F5E6E8')
    const rgb = mixed.match(/\d+/g)!.map(Number)
    expect(relativeLuminance({ r: rgb[0], g: rgb[1], b: rgb[2] })).toBeLessThanOrEqual(0.3)
  })
})
