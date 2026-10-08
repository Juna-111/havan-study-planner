import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')
const TEMPLATE_PATH = resolve(REPO_ROOT, 'vercel.template.json')
const OUTPUT_PATH = resolve(REPO_ROOT, 'vercel.json')
const DEFAULT_API_URL = 'https://havan-study-planner.onrender.com'

export default function prepareVercel(apiUrlOverride) {
  const apiUrl = apiUrlOverride ?? process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL
  const templateRaw = readFileSync(TEMPLATE_PATH, 'utf-8')
  const populated = templateRaw.replaceAll('__NEXT_PUBLIC_API_URL__', apiUrl)
  writeFileSync(OUTPUT_PATH, populated, 'utf-8')
  return { apiUrl, outputPath: OUTPUT_PATH, content: populated }
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])
if (isDirectRun) {
  const result = prepareVercel()
  console.log(`[prepare-vercel] Wrote ${result.outputPath}`)
  console.log(`[prepare-vercel] NEXT_PUBLIC_API_URL = ${result.apiUrl}`)
}
