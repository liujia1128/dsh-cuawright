/**
 * Host half of the CUAWright bundle for DeepSeek Harness.
 *
 * Registers every directory under `skills/` that contains a `SKILL.md` on the
 * Harness skill registry, so the browser and desktop workflows reach the agent
 * catalog exactly like a user-authored skill does — with no filesystem root,
 * no absolute path, and no restart.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const inject = ['skills']

const PACKAGE_ROOT = dirname(fileURLToPath(import.meta.url))
const SKILLS_ROOT = join(PACKAGE_ROOT, 'skills')
const CHECKOUT_MARKER = 'pyproject.toml'

/**
 * The CUAWright checkout this bundle was installed from, when one can be found.
 * Order: `CUAWRIGHT_ROOT`, the parent directory of the installed plugin (the
 * in-checkout `dsh-plugin/` layout), then a `CUAWright/` checkout beside the
 * plugin directory (this repository cloned next to the upstream checkout).
 */
function detectCheckout() {
  const candidates = [
    process.env.CUAWRIGHT_ROOT,
    join(PACKAGE_ROOT, '..'),
    join(PACKAGE_ROOT, '..', 'CUAWright'),
  ]
  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, CHECKOUT_MARKER))) return candidate
  }
  return null
}

/**
 * Root of the 通用自动化项目框架 checkout the generated Robot Framework suites
 * target. Resolution order: the row's `rfFrameworkRoot` config, then the
 * `RF_FRAMEWORK_ROOT` environment variable. There is no auto-detection: the
 * framework lives wherever the user keeps it, and a wrong guess would make the
 * agent write suites into an unrelated tree.
 */
function detectFrameworkRoot(config) {
  const candidates = [config?.rfFrameworkRoot, process.env.RF_FRAMEWORK_ROOT]
  for (const candidate of candidates) {
    if (candidate && existsSync(join(candidate, '04技术组件'))) return candidate
  }
  return null
}

/** Minimal `---` frontmatter reader: flat `key: value` pairs and a body. */
function parseSkillFile(text) {
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---[ \t]*\r?\n?([\s\S]*)$/.exec(text)
  if (!match) return { data: {}, body: text }
  const data = {}
  for (const line of match[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const separator = line.indexOf(':')
    if (separator === -1) continue
    const key = line.slice(0, separator).trim()
    let value = line.slice(separator + 1).trim()
    if (value.length > 1 && (value[0] === '"' || value[0] === "'") && value.at(-1) === value[0]) {
      value = value.slice(1, -1)
    }
    if (key && value) data[key] = value
  }
  return { data, body: match[2] }
}

function renderBody(body, tokens) {
  // Every fallback stays inside backticks in the skill text, so it reads as a
  // value the agent must resolve rather than as a runnable path.
  let rendered = body
  for (const [token, value] of Object.entries(tokens)) {
    rendered = rendered.replaceAll(token, value)
  }
  return rendered
}

export function apply(ctx, config = {}) {
  if (!existsSync(SKILLS_ROOT)) return
  const tokens = {
    '{{CUAWRIGHT_ROOT}}': detectCheckout() ?? '<CUAWright checkout>',
    '{{RF_FRAMEWORK_ROOT}}': detectFrameworkRoot(config) ?? '<通用自动化项目框架根目录>',
  }

  for (const entry of readdirSync(SKILLS_ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const dir = join(SKILLS_ROOT, entry.name)
    const file = join(dir, 'SKILL.md')
    if (!existsSync(file)) continue

    let parsed
    try {
      parsed = parseSkillFile(readFileSync(file, 'utf8'))
    } catch (error) {
      console.warn(`[cuawright] cannot read ${file}: ${error}`)
      continue
    }
    const { data, body } = parsed
    if (!data.name || !data.description) {
      console.warn(`[cuawright] skipping ${file}: name and description are required`)
      continue
    }

    ctx.effect(() =>
      ctx.skills.register({
        name: data.name,
        description: data.description,
        whenToUse: data.whenToUse,
        source: 'custom',
        provider: 'cuawright',
        path: file,
        resourceBase: { kind: 'directory', path: dir },
        content: renderBody(body, tokens),
      }),
    )
  }
}
