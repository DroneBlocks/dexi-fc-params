// Generate the QGroundControl .params files and the per-vehicle index.json
// from the vehicle sources in src/.
//
// Each src/<vehicle>.json is the source of truth for one flight controller
// configuration. The generated files (<vehicle>/*.params and
// <vehicle>/index.json) are GENERATED — never edit them by hand. They are a
// lossy view (name/value/type only); the notes, categories and apply semantics
// live in the JSON and are what the web configurator reads.
//
//   node tools/gen-params.mjs          # regenerate every vehicle
//   node tools/gen-params.mjs --check  # fail if the committed files are stale
//
// QGC .params format (tab-separated):
//   <MAV sys id> <component id> <PARAM_NAME> <VALUE> <MAV_PARAM_TYPE>
// MAV_PARAM_TYPE: 6 = INT32, 9 = REAL32.

import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const srcDir = resolve(root, 'src')

const check = process.argv.includes('--check')
const TYPE = { int: 6, float: 9 }

/** Every vehicle source in src/, sorted for stable output. */
export function loadVehicles() {
  return readdirSync(srcDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(srcDir, f), 'utf8')))
}

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

function paramsFile(doc, profile) {
  const ops = profileParams(doc, profile)
  const lines = []
  lines.push('# QGroundControl / PX4 onboard parameters')
  lines.push('#')
  lines.push(`# GENERATED from src/${doc.vehicle}.json by tools/gen-params.mjs — do not edit.`)
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

/** The machine-readable manifest. Generated so paramCount can never drift again. */
function indexFile(doc, emitted) {
  const profiles = emitted.map(({ profile, ops }) => ({
    key: profile.key,
    name: profile.name,
    file: `${profile.key}.params`,
    paramCount: ops.length,
    isDefault: !!profile.isDefault,
    selfContained: !!profile.selfContained,
    additive: !!profile.additive,
    comingSoon: !!profile.comingSoon,
    description: profile.description,
  }))
  return JSON.stringify({ profiles }, null, 2) + '\n'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const stale = []
  const compare = (path, next, label) => {
    if (check) {
      const cur = existsSync(path) ? readFileSync(path, 'utf8') : ''
      if (cur !== next) stale.push(label)
    } else {
      writeFileSync(path, next)
    }
  }

  for (const doc of loadVehicles()) {
    const outDir = resolve(root, doc.vehicle)
    if (!check) mkdirSync(outDir, { recursive: true })
    const emitted = []

    for (const p of doc.profiles) {
      const ops = profileParams(doc, p)
      if (ops.length === 0) {
        if (!check) console.log(`skip  ${p.key} (no params yet: ${p.comingSoon ? 'coming soon' : 'empty'})`)
        continue
      }
      emitted.push({ profile: p, ops })
      const label = `${doc.vehicle}/${p.key}.params`
      compare(resolve(outDir, `${p.key}.params`), paramsFile(doc, p), label)
      if (!check) console.log(`write ${label}  (${ops.length} params)`)
    }

    const idxLabel = `${doc.vehicle}/index.json`
    compare(resolve(outDir, 'index.json'), indexFile(doc, emitted), idxLabel)
    if (!check) console.log(`write ${idxLabel}  (${emitted.length} profiles)`)
  }

  if (check) {
    if (stale.length) {
      console.error('\nSTALE — these do not match their src/*.json:')
      for (const f of stale) console.error(`  ${f}`)
      console.error('\nRun: node tools/gen-params.mjs')
      process.exit(1)
    }
    console.log('✅ all generated files match src/*.json')
  }
}
