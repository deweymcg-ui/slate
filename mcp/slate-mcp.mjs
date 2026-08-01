#!/usr/bin/env node
// Slate MCP bridge — zero-dependency stdio MCP server that forwards tool calls
// to a running Slate app via its localhost control server.
//
// Connect (Claude Code):  claude mcp add slate -- node /absolute/path/to/slate-mcp.mjs
// The Slate app must be running; every tool errors clearly otherwise.

import { readFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
import { createInterface } from 'readline'

function descriptorPath() {
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA || join(homedir(), 'AppData', 'Roaming')
      : join(homedir(), '.config')
  return join(base, 'slate', 'control.json')
}

function readDescriptor() {
  try {
    const d = JSON.parse(readFileSync(descriptorPath(), 'utf8'))
    if (d && d.port && d.token) return d
  } catch {
    /* not running */
  }
  return null
}

async function invoke(tool, args) {
  const desc = readDescriptor()
  if (!desc) throw new Error("Slate isn't running — launch the app first.")
  const res = await fetch(`http://127.0.0.1:${desc.port}/invoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${desc.token}` },
    body: JSON.stringify({ tool, args })
  })
  const body = await res.json()
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`)
  return body.result
}

const TOOLS = [
  { name: 'list_projects', description: 'List Slate projects with scene and shot counts.', inputSchema: { type: 'object', properties: {} } },
  { name: 'get_project', description: 'Get a full Slate project document.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } },
  { name: 'create_project', description: 'Create a new Slate project.', inputSchema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] } },
  { name: 'list_shots', description: 'List all scenes and shots in a project.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } },
  { name: 'get_shot_prompt', description: 'Get one shot prompt with its spec and beat sheet.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, shotId: { type: 'string' } }, required: ['projectId', 'shotId'] } },
  { name: 'set_shot_prompt', description: 'Replace a shot prompt (previous version is kept in history).', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, shotId: { type: 'string' }, prompt: { type: 'string' } }, required: ['projectId', 'shotId', 'prompt'] } },
  { name: 'add_scene', description: 'Add a scene to a project.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' }, name: { type: 'string' }, synopsis: { type: 'string' } }, required: ['projectId'] } },
  { name: 'list_characters', description: 'List character sheets in a project.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } },
  { name: 'list_locations', description: 'List location sheets in a project.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } },
  { name: 'list_lookbook', description: 'List Lookbook style profiles in a project.', inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] } }
]

function reply(id, result) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, result }) + '\n')
}

function replyError(id, message) {
  process.stdout.write(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32000, message } }) + '\n')
}

const rl = createInterface({ input: process.stdin })
rl.on('line', async (line) => {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  const { id, method, params } = msg
  try {
    if (method === 'initialize') {
      reply(id, {
        protocolVersion: params?.protocolVersion || '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: { name: 'slate', version: '0.1.0' }
      })
    } else if (method === 'tools/list') {
      reply(id, { tools: TOOLS })
    } else if (method === 'tools/call') {
      const result = await invoke(params.name, params.arguments || {})
      reply(id, { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] })
    } else if (id !== undefined) {
      reply(id, {})
    }
  } catch (e) {
    if (id !== undefined) replyError(id, e instanceof Error ? e.message : String(e))
  }
})
