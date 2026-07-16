// Generate the QGroundControl .params files from src/dexi-3.json.
//
// src/dexi-3.json is the source of truth for DEXI flight-controller parameters.
// The .params files in dexi-3/ are GENERATED — never edit them by hand. They are
// a lossy view (name/value/type only); the notes, categories and apply semantics
// live in the JSON and are what the web configurator reads.
//
//   node tools/gen-params.mjs          # regenerate
//   node tools/gen-params.mjs --check  # fail if the committed files are stale
//
// QGC .params format (tab-separated):
//   <MAV sys id> <component id> <PARAM_NAME> <VALUE> <MAV_PARAM_TYPE>
// MAV_PARAM_TYPE: 6 = INT32, 9 = REAL32.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const doc = JSON.parse(readFileSync(resolve(root, 'src/dexi-3.json'), 'utf8'))

const check = process.argv.includes('--check')
const outDir = resolve(root, doc.vehicle)
const TYPE = { int: 6, float: 9 }

/** A profile's params: every block it references, in order, later wins on a repeat. */
export function profileParams(doc, profile) {
  const byName = new Map()
  for (const blockName of profile.blocks) {
    const block = doc.blocks[blockName]
    if (!block) throw new Error(`profile ${profile.key} references unknown block "${blockName}"`)
    for (const p of block.params) byName.set(p.name, p)
  }
  return Array.from(byName.values())
}

/** Format a value the way QGC expects for its declared type. */
function fmt(op) {
  if (op.kind === 'int') return String(Math.round(op.value))
  // REAL32 — keep it human-readable, avoid trailing-zero noise.
  return Number.isInteger(op.value) ? op.value.toFixed(1) : String(op.value)
}

function paramsFile(profile) {
  const ops = profileParams(doc, profile)
  const lines = []
  lines.push('# QGroundControl / PX4 onboard parameters')
  lines.push('#')
  lines.push('# GENERATED from src/dexi-3.json by tools/gen-params.mjs — do not edit.')
  lines.push('#')
  lines.push(`# Profile: ${profile.name}  (key: ${profile.key})`)
  lines.push(`# ${profile.description}`)
  lines.push('#')
  if (profile.airframeIds?.length)
    lines.push(`# Valid airframes (SYS_AUTOSTART): ${profile.airframeIds.join(', ')}`)
  lines.push(
    profile.selfContained
      ? '# COMPLETE per-kit setup — comms + flight tune + navigation in ONE file. Load just this.'
      : profile.additive
        ? '# ADDITIVE overlay — sets ONLY the params below, layers on top of your current config.'
        : '# Overlay — these are the params the DEXI configurator writes for this profile.',
  )
  lines.push('# Load in QGC: Vehicle Setup > Parameters > Tools > Load from file.')
  lines.push('# After loading, the FC reboots / power-cycle to let the EKF reinitialize.')
  lines.push('#')
  lines.push('#')
  lines.push('# MAV\tCOMP\tPARAM\tVALUE\tTYPE')
  for (const op of ops) {
    lines.push(`1\t1\t${op.name}\t${fmt(op)}\t${TYPE[op.kind]}`)
  }
  return lines.join('\n') + '\n'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(outDir, { recursive: true })
  let stale = []
  for (const p of doc.profiles) {
    const ops = profileParams(doc, p)
    if (ops.length === 0) {
      console.log(`skip  ${p.key} (no params yet: ${p.comingSoon ? 'coming soon' : 'empty'})`)
      continue
    }
    const path = resolve(outDir, `${p.key}.params`)
    const next = paramsFile(p)
    if (check) {
      const cur = existsSync(path) ? readFileSync(path, 'utf8') : ''
      if (cur !== next) stale.push(`${doc.vehicle}/${p.key}.params`)
    } else {
      writeFileSync(path, next)
      console.log(`write ${doc.vehicle}/${p.key}.params  (${ops.length} params)`)
    }
  }
  if (check) {
    if (stale.length) {
      console.error('\nSTALE — these do not match src/dexi-3.json:')
      for (const f of stale) console.error(`  ${f}`)
      console.error('\nRun: node tools/gen-params.mjs')
      process.exit(1)
    }
    console.log('✅ all .params match src/dexi-3.json')
  }
}
