import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { join } from "path"
import { homedir } from "os"

const MODELS_URL = "https://commandcode.ai/docs/reference/models"
const PRICING_URL = "https://commandcode.ai/docs/resources/pricing-limits"
const PROJECT_ROOT = join(import.meta.dir, "..")
const MODELS_JSON = join(PROJECT_ROOT, "models.json")
const GLOBAL_CONFIG = join(homedir(), ".config", "opencode", "opencode.jsonc")

interface CostData {
  input: number
  output: number
  cache_read?: number
  cache_write?: number
}

interface ModelEntry {
  id: string
  name: string
  tier: "premium" | "open-source"
  reasoning: boolean
  tool_call: boolean
  cost: CostData
  limit: { context: number; output: number }
}

const CONTEXT_WINDOWS: Record<string, { context: number; output: number }> = {
  "claude-opus-4-7": { context: 200000, output: 32000 },
  "claude-opus-4-6": { context: 200000, output: 32000 },
  "claude-sonnet-4-6": { context: 200000, output: 16000 },
  "claude-haiku-4-5": { context: 200000, output: 8192 },
  "gpt-5.5": { context: 256000, output: 128000 },
  "gpt-5.4": { context: 256000, output: 128000 },
  "gpt-5.3-codex": { context: 256000, output: 128000 },
  "gpt-5.4-mini": { context: 256000, output: 128000 },
  "google/gemini-3.5-flash": { context: 1000000, output: 65536 },
  "google/gemini-3.1-flash-lite": { context: 1000000, output: 65536 },
  "moonshotai/Kimi-K2.6": { context: 262144, output: 131072 },
  "moonshotai/Kimi-K2.5": { context: 262144, output: 131072 },
  "zai-org/GLM-5.1": { context: 200000, output: 131072 },
  "zai-org/GLM-5": { context: 200000, output: 131072 },
  "MiniMaxAI/MiniMax-M2.7": { context: 1000000, output: 131072 },
  "MiniMaxAI/MiniMax-M2.5": { context: 1000000, output: 131072 },
  "deepseek/deepseek-v4-pro": { context: 1000000, output: 384000 },
  "deepseek/deepseek-v4-flash": { context: 1000000, output: 384000 },
  "Qwen/Qwen3.6-Max-Preview": { context: 1000000, output: 131072 },
  "Qwen/Qwen3.6-Plus": { context: 1000000, output: 131072 },
  "Qwen/Qwen3.7-Max": { context: 1000000, output: 131072 },
  "stepfun/Step-3.5-Flash": { context: 1000000, output: 131072 },
}

const DEFAULT_LIMIT = { context: 200000, output: 65536 }

const NO_REASONING = new Set([
  "gpt-5.4-mini",
  "google/gemini-3.1-flash-lite",
])

const DEPRECATED = new Set(["Claude Sonnet 4.5"])

function parsePrice(raw: string): number | undefined {
  const cleaned = raw.replace(/[$,\s]/g, "")
  if (!cleaned || cleaned === "-") return undefined
  const n = parseFloat(cleaned)
  return isNaN(n) ? undefined : n
}

function extractCellPrice(cellHtml: string): number | undefined {
  const strongMatch = cellHtml.match(/<strong>\$?([0-9.]+)<\/strong>/)
  if (strongMatch) return parsePrice(strongMatch[1])
  const plainMatch = cellHtml.match(/>\$?([0-9.]+)</)
  if (plainMatch) return parsePrice(plainMatch[1])
  const bareMatch = cellHtml.match(/\$([0-9.]+)/)
  if (bareMatch) return parsePrice(bareMatch[1])
  return undefined
}

function extractCellText(cellHtml: string): string {
  return cellHtml
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim()
}

async function fetchModelsPage(): Promise<Map<string, string>> {
  const resp = await fetch(MODELS_URL)
  if (!resp.ok) throw new Error(`Models page returned ${resp.status}`)
  const html = await resp.text()

  const models = new Map<string, string>()
  const rowRegex = /<tr>([\s\S]*?)<\/tr>/g
  let match: RegExpExecArray | null

  while ((match = rowRegex.exec(html)) !== null) {
    const row = match[1]
    const codeMatch = row.match(/<code>([^<]+)<\/code>/)
    if (!codeMatch) continue
    const id = codeMatch[1]
    if (id === "taste-1") continue

    const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
    if (cells.length < 2) continue

    const name = extractCellText(cells[1][1])
    if (!name) continue

    models.set(id, name)
  }

  return models
}

async function fetchPricingPage(): Promise<{ premium: Map<string, CostData>; openSource: Map<string, CostData> }> {
  const resp = await fetch(PRICING_URL)
  if (!resp.ok) throw new Error(`Pricing page returned ${resp.status}`)
  const html = await resp.text()

  const premium = new Map<string, CostData>()
  const openSource = new Map<string, CostData>()

  const tables = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)]

  for (const tableMatch of tables) {
    const tableHtml = tableMatch[1]
    const headerMatch = tableHtml.match(/<thead[^>]*>([\s\S]*?)<\/thead>/)
    if (!headerMatch) continue
    const header = headerMatch[1]
    const hasInputOutput = header.includes("Input") && header.includes("Output")
    if (!hasInputOutput) continue

    const bodyMatch = tableHtml.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/)
    if (!bodyMatch) continue
    const body = bodyMatch[1]

    const rows = [...body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    for (const rowMatch of rows) {
      const row = rowMatch[1]
      const cells = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)]
      if (cells.length < 4) continue

      const name = extractCellText(cells[0][1])
      if (!name || DEPRECATED.has(name)) continue

      const input = extractCellPrice(cells[1][1])
      const output = extractCellPrice(cells[2][1])
      const cacheRead = extractCellPrice(cells[3][1])
      const cacheWrite = cells.length > 4 ? extractCellPrice(cells[4][1]) : undefined

      if (input === undefined || output === undefined) continue

      const cost: CostData = { input, output }
      if (cacheRead !== undefined) cost.cache_read = cacheRead
      if (cacheWrite !== undefined) cost.cache_write = cacheWrite

      const isPremium = premium.size < 20 && !openSource.has(name)
      if (name.includes("DeepSeek") || name.includes("Kimi") || name.includes("GLM") ||
          name.includes("MiniMax") || name.includes("Qwen") || name.includes("Step")) {
        openSource.set(name, cost)
      } else {
        premium.set(name, cost)
      }
    }
  }

  return { premium, openSource }
}

function toConfigKey(id: string): string {
  const slashIdx = id.indexOf("/")
  const short = slashIdx >= 0 ? id.slice(slashIdx + 1) : id
  return short.toLowerCase()
}

function buildModelEntries(
  models: Map<string, string>,
  premiumPricing: Map<string, CostData>,
  openSourcePricing: Map<string, CostData>,
): ModelEntry[] {
  const entries: ModelEntry[] = []

  for (const [id, name] of models) {
    let cost = premiumPricing.get(name) ?? openSourcePricing.get(name)
    if (!cost) {
      console.warn(`  Skipping ${id} (${name}): no pricing found`)
      continue
    }

    const isOSS = openSourcePricing.has(name)
    const limit = CONTEXT_WINDOWS[id] ?? DEFAULT_LIMIT

    entries.push({
      id,
      name,
      tier: isOSS ? "open-source" : "premium",
      reasoning: !NO_REASONING.has(id),
      tool_call: true,
      cost,
      limit,
    })
  }

  return entries
}

function generateOpencodeModels(entries: ModelEntry[]): Record<string, unknown> {
  const models: Record<string, unknown> = {}
  for (const entry of entries) {
    const key = toConfigKey(entry.id)
    const costObj: Record<string, number> = {
      input: entry.cost.input,
      output: entry.cost.output,
    }
    if (entry.cost.cache_read !== undefined) costObj.cache_read = entry.cost.cache_read
    if (entry.cost.cache_write !== undefined) costObj.cache_write = entry.cost.cache_write

    models[key] = {
      id: entry.id,
      name: entry.name,
      reasoning: entry.reasoning,
      tool_call: entry.tool_call,
      cost: costObj,
      limit: entry.limit,
    }
  }
  return models
}

function stripJsonc(input: string): string {
  let out = ""
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === '"') {
      const start = i
      i++
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\") i++
        i++
      }
      i++
      out += input.slice(start, i)
    } else if (ch === "/" && input[i + 1] === "/") {
      while (i < input.length && input[i] !== "\n") i++
    } else if (ch === "/" && input[i + 1] === "*") {
      i += 2
      while (i < input.length && !(input[i] === "*" && input[i + 1] === "/")) i++
      i += 2
    } else {
      out += ch
      i++
    }
  }
  return out.replace(/,\s*([}\]])/g, "$1")
}

function updateGlobalConfig(modelsObj: Record<string, unknown>) {
  if (!existsSync(GLOBAL_CONFIG)) {
    console.log(`  Global config not found at ${GLOBAL_CONFIG}, skipping`)
    return
  }

  const raw = readFileSync(GLOBAL_CONFIG, "utf-8")
  const jsonStr = stripJsonc(raw)

  let config: any
  try {
    config = JSON.parse(jsonStr)
  } catch {
    console.error("  Failed to parse global config as JSON after stripping comments")
    return
  }

  if (!config.provider) config.provider = {}
  if (!config.provider.commandcode) {
    config.provider.commandcode = {
      npm: `file://${PROJECT_ROOT}`,
      name: "Command Code",
      env: ["COMMANDCODE_API_KEY"],
    }
  }
  config.provider.commandcode.models = modelsObj

  const output = JSON.stringify(config, null, 2) + "\n"
  writeFileSync(GLOBAL_CONFIG, output, "utf-8")
  console.log(`  Updated ${GLOBAL_CONFIG}`)
}

async function main() {
  const args = process.argv.slice(2)
  const shouldUpdateGlobal = args.includes("--update-global")

  console.log("Fetching models page...")
  const models = await fetchModelsPage()
  console.log(`  Found ${models.size} models`)

  console.log("Fetching pricing page...")
  const { premium, openSource } = await fetchPricingPage()
  console.log(`  Found ${premium.size} premium + ${openSource.size} open-source pricing entries`)

  console.log("Building model entries...")
  const entries = buildModelEntries(models, premium, openSource)
  console.log(`  Generated ${entries.length} model entries`)

  entries.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier === "premium" ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  console.log(`Writing ${MODELS_JSON}...`)
  writeFileSync(MODELS_JSON, JSON.stringify(entries, null, 2) + "\n", "utf-8")

  const modelsObj = generateOpencodeModels(entries)

  if (shouldUpdateGlobal) {
    console.log("Updating global config...")
    updateGlobalConfig(modelsObj)
  }

  console.log("\nModel list:")
  for (const entry of entries) {
    const cost = `$${entry.cost.input}/$${entry.cost.output}`
    console.log(`  ${entry.tier.padEnd(12)} ${entry.id.padEnd(35)} ${entry.name.padEnd(25)} ${cost}`)
  }

  if (!shouldUpdateGlobal) {
    console.log(`\nRun with --update-global to update ${GLOBAL_CONFIG}`)
  }

  console.log("\nDone.")
}

main().catch((err) => {
  console.error("Sync failed:", err)
  process.exit(1)
})
