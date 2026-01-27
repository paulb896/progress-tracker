import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import url from 'node:url'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

const BDD_SPEC_PATH = path.join(repoRoot, 'e2e', 'bdd.spec.ts')
const PLAYWRIGHT_GIF_CONFIG = path.join(repoRoot, 'playwright.gifs.config.ts')
const GIF_PUBLIC_DIR = path.join(repoRoot, 'public', 'scenario-gifs')
const MANIFEST_PATH = path.join(repoRoot, 'src', 'scenarios', 'scenarioGifs.ts')
const GIF_TEST_RESULTS_DIR = path.join(repoRoot, 'test-results-gifs')

// Skip the first moments of the recording (WebGL warm-up, env map compilation, etc.)
// so the resulting GIF starts at a clean, stable point.
const GIF_START_TRIM_SECONDS = 0.0

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'inherit',
    shell: false,
    ...options,
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

const tryRun = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: 'ignore',
    shell: false,
    ...options,
  })
  return result.status === 0
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const slugify = (title) => {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true })
}

const rmDir = (dir) => {
  if (!fs.existsSync(dir)) return
  fs.rmSync(dir, { recursive: true, force: true })
}

const findFiles = (dir, predicate) => {
  const out = []
  if (!fs.existsSync(dir)) return out
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const abs = path.join(dir, entry.name)
    if (entry.isDirectory()) out.push(...findFiles(abs, predicate))
    else if (predicate(abs)) out.push(abs)
  }
  return out
}

const extractScenarioTitles = (tsContents) => {
  const titles = []
  const re = /test\(\s*'Scenario:([^']+)'\s*,/g
  let m
  while ((m = re.exec(tsContents))) {
    titles.push(m[1].trim())
  }
  return titles
}

const toWhitespaceTolerantRegex = (value) => {
  const parts = value.trim().split(/\s+/)
  return parts.map(escapeRegex).join('\\s+')
}

const writeManifest = (items) => {
  const lines = []
  lines.push("export type ScenarioGif = { title: string; fileName: string }")
  lines.push('')
  lines.push('export const SCENARIO_GIFS: ScenarioGif[] = [')
  for (const item of items) {
    lines.push(`  { title: ${JSON.stringify(item.title)}, fileName: ${JSON.stringify(item.fileName)} },`)
  }
  lines.push(']')
  lines.push('')
  lines.push(
    "export const resolveScenarioGifUrl = (fileName: string) => import.meta.env.BASE_URL + 'scenario-gifs/' + fileName"
  )
  lines.push('')

  ensureDir(path.dirname(MANIFEST_PATH))
  fs.writeFileSync(MANIFEST_PATH, lines.join('\n') + '\n', 'utf8')
}

const main = async () => {
  const spec = fs.readFileSync(BDD_SPEC_PATH, 'utf8')
  const scenarioTitles = extractScenarioTitles(spec)

  if (!scenarioTitles.length) {
    console.error(`No scenarios found in ${BDD_SPEC_PATH}`)
    process.exit(1)
  }

  const ffmpegOk = tryRun('ffmpeg', ['-version'])
  if (!ffmpegOk) {
    console.warn('ffmpeg not found on PATH. Will still generate the manifest, but cannot create GIFs.')
    console.warn('Install ffmpeg and re-run: npm run generate:scenario-gifs')
  }

  ensureDir(GIF_PUBLIC_DIR)

  const used = new Map()
  const items = scenarioTitles.map((title, index) => {
    const base = slugify(title) || `scenario-${index + 1}`
    const count = used.get(base) ?? 0
    used.set(base, count + 1)
    const slug = count ? `${base}-${count + 1}` : base
    return { title, slug, fileName: `${slug}.gif` }
  })

  writeManifest(items)

  if (!ffmpegOk) return

  // Generate each GIF by running just that scenario with video enabled, then converting the recorded video.
  for (const item of items) {
    console.log(`\n=== Generating GIF for: Scenario: ${item.title} ===`) // eslint-disable-line no-console

    rmDir(GIF_TEST_RESULTS_DIR)

    // Playwright greps against the full title including describe() blocks.
    // So we match the scenario string anywhere in the full title.
    const grep = `Scenario:\\s*${toWhitespaceTolerantRegex(item.title)}`

    run(
      'npx',
      [
      'playwright',
      'test',
      '--config',
      PLAYWRIGHT_GIF_CONFIG,
      '--project',
      'chromium',
      '--grep',
      grep,
      ],
      {
        env: {
          ...process.env,
          PROGRESS_TRACKER_SCENARIO_GIF: '1',
        },
      }
    )

    const videos = findFiles(GIF_TEST_RESULTS_DIR, (p) => p.endsWith('.webm') || p.endsWith('.mp4'))
    if (!videos.length) {
      console.warn(`No video found for scenario: ${item.title}`)
      continue
    }

    videos.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    const inputVideo = videos[0]

    const outGif = path.join(GIF_PUBLIC_DIR, item.fileName)
    const palette = path.join(GIF_TEST_RESULTS_DIR, `${item.slug}-palette.png`)

    // Two-pass palette gen/use for better quality + smaller size.
    run('ffmpeg', [
      '-y',
      '-ss',
      String(GIF_START_TRIM_SECONDS),
      '-i',
      inputVideo,
      '-update',
      '1',
      '-vf',
      'fps=12,scale=720:-1:flags=lanczos,palettegen=stats_mode=diff',
      palette,
    ])

    run('ffmpeg', [
      '-y',
      '-ss',
      String(GIF_START_TRIM_SECONDS),
      '-i',
      inputVideo,
      '-i',
      palette,
      '-lavfi',
      'fps=12,scale=720:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3',
      outGif,
    ])

    console.log(`Wrote ${path.relative(repoRoot, outGif)}`) // eslint-disable-line no-console
  }

  rmDir(GIF_TEST_RESULTS_DIR)
}

await main()
