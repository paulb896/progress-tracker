#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const IMAGE_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.gif', '.bmp', '.avif'])

const usage = () => {
  console.log(`\nOptimize images for web (max ~600px) using ImageMagick.\n\nUsage:\n  node scripts/optimize-images.cjs <inputDir> <outputDir> [--max 600] [--format webp] [--quality 82]\n\nOptions:\n  --max <n>       Max width/height in pixels (default: 600)\n  --format <fmt>  Output format: webp|jpg|png (default: webp)\n  --quality <n>   Encoder quality (default: 82)\n  --dry-run       Print what would be done without writing files\n\nExamples:\n  node scripts/optimize-images.cjs public/exercises public/exercises-optimized\n  node scripts/optimize-images.cjs assets/raw assets/web --max 600 --quality 80\n`)
}

const parseArgs = (argv) => {
  const positional = []
  const flags = {}

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      flags.help = true
    } else if (a === '--dry-run') {
      flags.dryRun = true
    } else if (a === '--max') {
      flags.max = argv[++i]
    } else if (a === '--format') {
      flags.format = argv[++i]
    } else if (a === '--quality') {
      flags.quality = argv[++i]
    } else if (a.startsWith('--')) {
      console.error(`Unknown option: ${a}`)
      flags.help = true
    } else {
      positional.push(a)
    }
  }

  return { positional, flags }
}

const statSafe = (p) => {
  try {
    return fs.statSync(p)
  } catch {
    return null
  }
}

const ensureDir = (dir) => {
  fs.mkdirSync(dir, { recursive: true })
}

const walkFiles = (rootDir) => {
  const out = []

  /** @type {Array<string>} */
  const stack = [rootDir]
  while (stack.length) {
    const current = stack.pop()
    if (!current) {
      continue
    }

    const st = statSafe(current)
    if (!st) {
      continue
    }

    if (st.isDirectory()) {
      for (const entry of fs.readdirSync(current)) {
        stack.push(path.join(current, entry))
      }
      continue
    }

    if (!st.isFile()) {
      continue
    }
    out.push(current)
  }

  return out
}

const findMagickCmd = () => {
  // Prefer `magick` (ImageMagick v7). Fallback to `convert` (older).
  const candidates = [
    { cmd: 'magick', args: ['-version'] },
    { cmd: 'convert', args: ['-version'] },
  ]

  for (const c of candidates) {
    const r = spawnSync(c.cmd, c.args, { encoding: 'utf8' })
    if (r.status === 0) {
      return c.cmd
    }
  }

  return null
}

const main = () => {
  const { positional, flags } = parseArgs(process.argv.slice(2))

  if (flags.help || positional.length < 2) {
    usage()
    if (flags.help) {
      process.exit(0)
    } else {
      process.exit(1)
    }
  }

  const inputDir = path.resolve(positional[0])
  const outputDir = path.resolve(positional[1])

  const max = Number(flags.max ?? 600)
  const format = String(flags.format ?? 'webp').toLowerCase()
  const quality = Number(flags.quality ?? 82)
  const dryRun = !!flags.dryRun

  if (!Number.isFinite(max) || max <= 0) {
    console.error(`Invalid --max: ${flags.max}`)
    process.exit(1)
  }

  if (!Number.isFinite(quality) || quality <= 0 || quality > 100) {
    console.error(`Invalid --quality: ${flags.quality}`)
    process.exit(1)
  }

  if (!['webp', 'jpg', 'png'].includes(format)) {
    console.error(`Invalid --format: ${format} (expected webp|jpg|png)`)
    process.exit(1)
  }

  const inStat = statSafe(inputDir)
  if (!inStat || !inStat.isDirectory()) {
    console.error(`Input directory not found: ${inputDir}`)
    process.exit(1)
  }

  const magick = findMagickCmd()
  if (!magick) {
    console.error('ImageMagick not found. Install it and ensure `magick` (or `convert`) is on PATH.')
    console.error('On Ubuntu/Debian: sudo apt-get install imagemagick')
    process.exit(1)
  }

  const files = walkFiles(inputDir)
  const imageFiles = files.filter((f) => IMAGE_EXTS.has(path.extname(f).toLowerCase()))

  if (!imageFiles.length) {
    console.log('No images found.')
    return
  }

  let okCount = 0
  let skipCount = 0
  let failCount = 0

  for (const absIn of imageFiles) {
    const rel = path.relative(inputDir, absIn)
    const relDir = path.dirname(rel)
    const base = path.basename(rel, path.extname(rel))
    const outDir = path.join(outputDir, relDir)
    const absOut = path.join(outDir, `${base}.${format}`)

    const outStat = statSafe(absOut)
    const inStat2 = statSafe(absIn)
    if (outStat && inStat2 && outStat.mtimeMs >= inStat2.mtimeMs) {
      skipCount++
      continue
    }

    if (!dryRun) {
      ensureDir(outDir)
    }

    const resizeArg = `${max}x${max}>`

    const args = magick === 'magick'
      ? [
          absIn,
          '-auto-orient',
          '-strip',
          '-resize',
          resizeArg,
          '-quality',
          String(quality),
          absOut,
        ]
      : [
          absIn,
          '-auto-orient',
          '-strip',
          '-resize',
          resizeArg,
          '-quality',
          String(quality),
          absOut,
        ]

    if (dryRun) {
      console.log(`[dry-run] ${magick} ${args.map((s) => JSON.stringify(s)).join(' ')}`)
      okCount++
      continue
    }

    const r = spawnSync(magick, args, { stdio: 'inherit' })
    if (r.status === 0) {
      okCount++
    } else {
      failCount++
    }
  }

  console.log(`\nOptimized: ${okCount}, skipped: ${skipCount}, failed: ${failCount}`)
  if (failCount > 0) {
    process.exit(1)
  }
}

main()
