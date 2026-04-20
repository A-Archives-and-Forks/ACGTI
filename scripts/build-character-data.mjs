#!/usr/bin/env node

/**
 * 构建脚本：从 src/content/characters/*.json 生成聚合产物
 *
 * 读取：
 *   src/content/characters/*.json（每角色一个文件）
 *
 * 生成：
 *   src/data/characters.json       — 角色元数据数组
 *   src/data/characterVisuals.json — 角色 visual 映射
 *   src/data/characterMessages.json — 角色结果文案 i18n 映射
 *
 * i18n/characters.ts 不再自动生成，保持手动维护。
 * 如需同步，运行 npm run validate:data 检查一致性。
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

const SOURCE_DIR = resolve(ROOT, 'src/content/characters')
const DATA_DIR = resolve(ROOT, 'src/data')

function main() {
  console.log('\n🔧 从角色源文件构建聚合产物\n')

  // 1. 读取所有角色文件
  const files = readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'))
  console.log(`  读取 ${files.length} 个角色源文件`)

  const characters = []
  const visuals = {}
  const characterMessages = {
    'zh-CN': {},
    'zh-TW': {},
    en: {},
    ja: {},
  }

  for (const file of files) {
    const raw = readFileSync(resolve(SOURCE_DIR, file), 'utf-8')
    const entry = JSON.parse(raw)

    const { meta, visual } = entry

    // 构建 characters.json 条目
    const charEntry = { ...meta }
    // 将 visual.image 写入 image 字段（兼容旧逻辑）
    if (visual?.image) {
      charEntry.image = visual.image
    }
    characters.push(charEntry)

    // 构建 characterVisuals.json 条目
    if (meta.id && visual) {
      visuals[meta.id] = {
        image: visual.image || '',
        thumb: visual.thumb || '',
        accent: visual.accent || '',
      }
    }

    if (meta.id) {
      characterMessages['zh-CN'][meta.id] = {
        title: meta.title || '',
        note: meta.note || '',
        tags: meta.tags || [],
      }

      for (const locale of ['zh-TW', 'en', 'ja']) {
        const localized = entry.i18n?.[locale]
        characterMessages[locale][meta.id] = {
          title: localized?.title || meta.title || '',
          note: localized?.note || meta.note || '',
          tags: localized?.tags || meta.tags || [],
        }
      }
    }
  }

  // 2. 按 id 排序保证稳定性
  characters.sort((a, b) => (a.id || '').localeCompare(b.id || ''))

  // 3. 写入 characters.json
  const charJson = JSON.stringify(characters, null, 2) + '\n'
  writeFileSync(resolve(DATA_DIR, 'characters.json'), charJson, 'utf-8')
  console.log(`  ✓ src/data/characters.json（${characters.length} 个角色）`)

  // 4. 写入 characterVisuals.json（按 key 排序）
  const sortedVisuals = {}
  for (const key of Object.keys(visuals).sort()) {
    sortedVisuals[key] = visuals[key]
  }
  const visualJson = JSON.stringify(sortedVisuals, null, 2) + '\n'
  writeFileSync(resolve(DATA_DIR, 'characterVisuals.json'), visualJson, 'utf-8')
  console.log(`  ✓ src/data/characterVisuals.json（${Object.keys(visuals).length} 个条目）`)

  // 5. 写入角色结果文案 i18n 映射
  const sortedCharacterMessages = {}
  for (const locale of ['zh-CN', 'zh-TW', 'en', 'ja']) {
    sortedCharacterMessages[locale] = {}
    for (const key of Object.keys(characterMessages[locale]).sort()) {
      sortedCharacterMessages[locale][key] = characterMessages[locale][key]
    }
  }
  const messageJson = JSON.stringify(sortedCharacterMessages, null, 2) + '\n'
  writeFileSync(resolve(DATA_DIR, 'characterMessages.json'), messageJson, 'utf-8')
  console.log(`  ✓ src/data/characterMessages.json（${characters.length} 个角色 × 4 语言）`)

  console.log('\n  构建完成。\n')
}

main()
