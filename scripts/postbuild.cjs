const fs = require('node:fs')
const path = require('node:path')

const docsDir = path.join(process.cwd(), 'docs')

if (!fs.existsSync(docsDir)) {
  console.warn('postbuild: docs/ not found; skipping')
  process.exit(0)
}

const noJekyllPath = path.join(docsDir, '.nojekyll')
fs.writeFileSync(noJekyllPath, '')

// GitHub Pages doesn't support server-side rewrites for SPAs.
// Copy index.html -> 404.html so deep links still load the app.
const indexHtmlPath = path.join(docsDir, 'index.html')
const notFoundHtmlPath = path.join(docsDir, '404.html')

if (fs.existsSync(indexHtmlPath)) {
  fs.copyFileSync(indexHtmlPath, notFoundHtmlPath)
} else {
  console.warn('postbuild: docs/index.html not found; skipping 404.html')
}
