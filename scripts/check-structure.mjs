import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const root = process.cwd()
const src = path.join(root, 'frontend', 'src')
const failures = []

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

function lines(file) {
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).length
}

for (const file of walk(src)) {
  const rel = path.relative(root, file).replaceAll(path.sep, '/')
  const text = fs.readFileSync(file, 'utf8')
  const base = path.basename(file)

  if (base === 'page.tsx' && lines(file) > 150) failures.push(`${rel}: page exceeds 150 lines`)
  if (file.endsWith('.tsx') && base !== 'page.tsx' && lines(file) > 250) failures.push(`${rel}: component exceeds 250 lines`)
  if (file.endsWith('.css') && lines(file) > 250) failures.push(`${rel}: CSS exceeds 250 lines`)
  if (file.includes('/api/') && file.endsWith('.py') && lines(file) > 200) failures.push(`${rel}: router exceeds 200 lines`)
  if (/\bany\b/.test(text) && /(:\s*any\b|as\s+any\b|<any>|Record<[^>]+,\s*any>)/.test(text)) failures.push(`${rel}: explicit any type`)
  if (/(from\s+['"]\.\.\/\.\.\/|import\s+['"]\.\.\/\.\.\/)/.test(text)) failures.push(`${rel}: use @/ alias instead of ../../ imports`)
  if (text.includes("localStorage.getItem('havan_student_key')") || text.includes('localStorage.getItem("havan_student_key")')) failures.push(`${rel}: legacy client-key identity access`)
}

const packageJson = path.join(root, 'frontend', 'package.json')
if (!fs.existsSync(packageJson)) failures.push('frontend/package.json is missing')

if (failures.length) {
  console.error('Havan structure check failed:')
  failures.forEach(item => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Havan structure check passed.')


const buildManifest = path.join(root, 'frontend', '.next', 'app-build-manifest.json')
if (fs.existsSync(buildManifest)) {
  const manifest = JSON.parse(fs.readFileSync(buildManifest, 'utf8'))
  const pages = manifest.pages ?? {}
  const limit = 150 * 1024
  for (const [route, files] of Object.entries(pages)) {
    const jsFiles = Array.isArray(files) ? files.filter(file => String(file).endsWith('.js')) : []
    const bytes = jsFiles.reduce((total, file) => {
      const full = path.join(root, 'frontend', '.next', String(file))
      return total + (fs.existsSync(full) ? zlib.gzipSync(fs.readFileSync(full)).length : 0)
    }, 0)
    if (bytes > limit) failures.push(`${route}: first-load JS exceeds 150 KB gzipped (${Math.round(bytes / 1024)} KB)`)
  }
} else {
  console.log('Bundle budget check skipped: frontend/.next/app-build-manifest.json is not present.')
}
