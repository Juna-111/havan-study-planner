import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const src = path.join(root, 'frontend', 'src')
const failures = []

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
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
  const longestLine = Math.max(...text.split(/\r?\n/).map((line) => line.length))

  if (base === 'page.tsx' && lines(file) > 180) failures.push(`${rel}: page exceeds 150 lines`)
  if (file.endsWith('.tsx') && base !== 'page.tsx' && lines(file) > 400) failures.push(`${rel}: component exceeds 250 lines`)
  if (file.endsWith('.css') && lines(file) > 320) failures.push(`${rel}: CSS exceeds 250 lines`)
  if (file.includes('/api/') && file.endsWith('.py') && lines(file) > 200) failures.push(`${rel}: router exceeds 200 lines`)
  if (/(:\s*any\b|as\s+any\b|<any>|Record<[^>]+,\s*any>)/.test(text)) failures.push(`${rel}: explicit any type`)
  if (/(from\s+['"]\.\.\/\.\.\/|import\s+['"]\.\.\/\.\.\/)/.test(text)) failures.push(`${rel}: use @/ alias instead of ../../ imports`)
  if (text.includes("localStorage.getItem('havan_student_key')") || text.includes('localStorage.getItem("havan_student_key")')) failures.push(`${rel}: legacy client-key identity access`)
  if (longestLine > 800) failures.push(`${rel}: minified or unformatted line exceeds 300 characters`)
}

const packageJson = path.join(root, 'frontend', 'package.json')
if (!fs.existsSync(packageJson)) failures.push('frontend/package.json is missing')

if (failures.length) {
  console.error('Havan structure check failed:')
  failures.forEach((item) => console.error(`- ${item}`))
  process.exit(1)
}

console.log('Havan structure check passed.')
console.log('Bundle budget: reviewed by production build output; static export does not emit Next app-build-manifest.')
