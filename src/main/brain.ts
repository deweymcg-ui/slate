// Brain — runs the user's own local agent CLIs (Claude Code, Codex) in print mode.
// No API keys are stored or used; billing rides on the user's existing subscriptions.

import { execFile, spawn, ChildProcess } from 'child_process'
import { existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'
import type { BrainRequest, BrainResult, BrainStatus, BrainTier } from '../shared/types'

// Electron apps launched from Finder/Dock inherit a minimal PATH that misses
// Homebrew and user bins — resolve the CLIs explicitly and augment PATH.
const CLI_DIRS = [
  '/opt/homebrew/bin',
  '/usr/local/bin',
  join(homedir(), '.local', 'bin'),
  join(homedir(), 'bin'),
  join(homedir(), '.npm-global', 'bin'),
  '/usr/bin'
]

function resolveCli(name: string): string {
  for (const dir of CLI_DIRS) {
    const p = join(dir, name)
    if (existsSync(p)) return p
  }
  return name // hope PATH has it
}

function brainEnv(): NodeJS.ProcessEnv {
  const extra = CLI_DIRS.join(':')
  return { ...process.env, PATH: `${process.env.PATH ?? ''}:${extra}` }
}

const CLAUDE_TIER_MODEL: Record<BrainTier, string | null> = {
  fast: 'haiku',
  standard: 'sonnet',
  top: null // user's configured default model — their best available
}

const running = new Map<string, ChildProcess>()

function which(cmd: string, args: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    execFile(resolveCli(cmd), args, { timeout: 15000, env: brainEnv() }, (err, stdout) => {
      if (err) resolve(null)
      else resolve(stdout.trim().split('\n')[0] || 'available')
    })
  })
}

export async function brainStatus(): Promise<BrainStatus> {
  const [claudeV, codexV] = await Promise.all([
    which('claude', ['--version']),
    which('codex', ['--version'])
  ])
  return {
    claude: { available: claudeV !== null, version: claudeV },
    codex: { available: codexV !== null, version: codexV }
  }
}

/** Extract the first balanced JSON object or array from text. */
export function extractJson(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/g, '').trim()
  const starts: Array<[string, string]> = [
    ['{', '}'],
    ['[', ']']
  ]
  for (const [open, close] of starts) {
    const i = cleaned.indexOf(open)
    if (i === -1) continue
    let depth = 0
    let inStr = false
    let esc = false
    for (let j = i; j < cleaned.length; j++) {
      const ch = cleaned[j]
      if (esc) {
        esc = false
        continue
      }
      if (ch === '\\') {
        esc = true
        continue
      }
      if (ch === '"') inStr = !inStr
      if (inStr) continue
      if (ch === open) depth++
      else if (ch === close) {
        depth--
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(i, j + 1))
          } catch {
            break
          }
        }
      }
    }
  }
  throw new Error('No valid JSON found in response')
}

interface CliCall {
  cmd: string
  args: string[]
  input?: string
}

function buildClaudeCall(req: BrainRequest): CliCall {
  const args = ['-p', '--output-format', 'json']
  const model = CLAUDE_TIER_MODEL[req.tier]
  if (model) args.push('--model', model)
  if (req.images && req.images.length > 0) {
    // Pre-approve Read so the model can open reference frames without a permission prompt.
    args.push('--allowedTools', 'Read')
  }
  args.push('--append-system-prompt', req.system)
  let prompt = req.prompt
  if (req.images && req.images.length > 0) {
    prompt +=
      '\n\nReference media frames to view (use the Read tool on each before answering):\n' +
      req.images.map((p) => `- ${p}`).join('\n')
  }
  return { cmd: 'claude', args, input: prompt }
}

function buildCodexCall(req: BrainRequest): CliCall {
  // codex exec runs a one-shot non-interactive task and prints the final message.
  const args = ['exec', '--skip-git-repo-check', '-']
  let prompt = `${req.system}\n\n---\n\n${req.prompt}`
  if (req.images && req.images.length > 0) {
    for (const img of req.images) args.push('-i', img)
  }
  return { cmd: 'codex', args, input: prompt }
}

function parseClaudeOutput(raw: string): string {
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.is_error) {
      const msg: string = typeof parsed.result === 'string' ? parsed.result : 'Claude Code returned an error.'
      if (/authenticat|oauth|401|logged? ?in|revoked/i.test(msg)) {
        throw new Error(
          `Claude Code's sign-in has expired or been revoked. Open Terminal, run: claude auth login  — approve in the browser, then retry. (${msg})`
        )
      }
      throw new Error(msg)
    }
    if (typeof parsed?.result === 'string') return parsed.result
  } catch (e) {
    if (e instanceof Error && e.message.includes('claude auth login')) throw e
    if (e instanceof Error && !(e instanceof SyntaxError)) throw e
    /* fall through — some versions emit plain text on error */
  }
  return raw.trim()
}

export async function brainRun(
  req: BrainRequest,
  backend: 'claude' | 'codex'
): Promise<BrainResult> {
  const started = Date.now()
  const call = backend === 'claude' ? buildClaudeCall(req) : buildCodexCall(req)

  const runOnce = (extraNudge?: string): Promise<string> =>
    new Promise((resolve, reject) => {
      const child = spawn(resolveCli(call.cmd), call.args, {
        env: brainEnv(),
        stdio: ['pipe', 'pipe', 'pipe']
      })
      running.set(req.id, child)
      let out = ''
      let errOut = ''
      child.stdout.on('data', (d) => (out += d))
      child.stderr.on('data', (d) => (errOut += d))
      child.on('error', (e) => {
        running.delete(req.id)
        reject(new Error(`Could not launch ${call.cmd}: ${e.message}`))
      })
      child.on('close', (code) => {
        running.delete(req.id)
        if (code !== 0 && !out.trim()) {
          reject(new Error(errOut.trim() || `${call.cmd} exited with code ${code}`))
        } else {
          try {
            resolve(backend === 'claude' ? parseClaudeOutput(out) : out.trim())
          } catch (e) {
            reject(e instanceof Error ? e : new Error(String(e)))
          }
        }
      })
      const input = extraNudge ? `${call.input}\n\n${extraNudge}` : call.input
      child.stdin.write(input ?? '')
      child.stdin.end()
    })

  try {
    let text = await runOnce()
    let json: unknown
    if (req.expectJson) {
      try {
        json = extractJson(text)
      } catch {
        // One retry with an explicit nudge — models occasionally wrap JSON in prose.
        text = await runOnce('IMPORTANT: Respond with ONLY the requested JSON. No prose, no code fences.')
        json = extractJson(text)
      }
    }
    return { id: req.id, ok: true, text, json, elapsedMs: Date.now() - started }
  } catch (e) {
    return {
      id: req.id,
      ok: false,
      text: '',
      error: e instanceof Error ? e.message : String(e),
      elapsedMs: Date.now() - started
    }
  }
}

export function brainCancel(id: string): void {
  const child = running.get(id)
  if (child) {
    child.kill('SIGTERM')
    running.delete(id)
  }
}
