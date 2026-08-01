// Shared data model for Slate — used by main, preload, and renderer.

export type SectionId = 'subject' | 'composition' | 'lighting' | 'camera' | 'style' | 'mood'

export const SECTION_ORDER: SectionId[] = ['subject', 'composition', 'lighting', 'camera', 'style', 'mood']

export const SECTION_LABELS: Record<SectionId, string> = {
  subject: 'Subject',
  composition: 'Composition',
  lighting: 'Lighting',
  camera: 'Camera',
  style: 'Style',
  mood: 'Mood'
}

export interface ShotSpec {
  durationSec: number | null
  fps: number | null
  aspectRatio: string | null
  lens: string | null
  movement: string | null
  size: string | null
  angle: string | null
}

export interface BeatDirection {
  from: number
  to: number
  text: string
}

export interface PromptVersion {
  id: string
  savedAt: string
  label: string
  prompt: string
}

export interface Take {
  id: string
  loggedAt: string
  model: string
  prompt: string
  rating: 'circled' | 'good' | 'no-good'
  notes: string
}

export interface Variant {
  id: string
  label: string
  prompt: string
}

export interface Shot {
  id: string
  name: string
  intent: string
  spec: ShotSpec
  prompt: string
  lockedLines: number[]
  mutedLines: number[]
  beatSheet: BeatDirection[] | null
  targetModel: string | null
  maxChars: number | null
  variants: Variant[]
  history: PromptVersion[]
  takes: Take[]
  createdAt: string
  updatedAt: string
}

export interface Scene {
  id: string
  name: string
  synopsis: string
  shots: Shot[]
}

export type ScenarioTab = 'cinematic' | 'interview' | 'fashion' | 'film-scene' | 'portrait' | 'street'

export interface CharacterSheet {
  id: string
  name: string
  age: string
  gender: string
  ethnicity: string
  faceFeatures: string
  hair: string
  clothing: string
  expression: string
  eyeDirection: string
  mood: string
  environment: string
  keyLightSide: string
  lightingMood: string
  scenario: ScenarioTab
  notes: string
}

export type ArtDeptKind = 'prop' | 'wardrobe' | 'vehicle'

export interface ArtDeptSheet {
  id: string
  kind: ArtDeptKind
  name: string
  description: string
  materials: string
  condition: string
  era: string
  distinctive: string
  notes: string
}

export interface LocationSheet {
  id: string
  name: string
  interiorExterior: 'interior' | 'exterior' | 'both'
  description: string
  timeOfDay: string
  weather: string
  architecture: string
  textures: string
  practicalLights: string
  notes: string
}

export interface StyleProfile {
  id: string
  source: string
  kind: 'cinematographer' | 'director' | 'film' | 'series' | 'custom'
  tone: string
  palette: string
  lighting: string
  lensLanguage: string
  movement: string
  blocking: string
  editorial: string
  notes: string
}

export interface ElementSheet {
  lensing: string
  lighting: string
  palette: string
  composition: string
  movement: string
  texture: string
  mood: string
  notes: string
}

export interface Reference {
  id: string
  path: string
  kind: 'image' | 'video'
  label: string
  frames: string[]
  elements: ElementSheet | null
  addedAt: string
}

export interface CustomSetup {
  id: string
  label: string
  snippet: string
  section: SectionId
  tags: string[]
  favorite: boolean
}

export interface ProjectDefaults {
  aspectRatio: string
  fps: number
  durationSec: number
  targetModel: string
  brain: 'claude' | 'codex'
}

export interface Project {
  id: string
  name: string
  logline: string
  world: string
  defaults: ProjectDefaults
  scenes: Scene[]
  characters: CharacterSheet[]
  artDept: ArtDeptSheet[]
  locations: LocationSheet[]
  lookbook: StyleProfile[]
  references: Reference[]
  mySetups: CustomSetup[]
  createdAt: string
  updatedAt: string
}

export interface ProjectMeta {
  id: string
  name: string
  logline: string
  path: string
  updatedAt: string
  sceneCount: number
  shotCount: number
}

// ---- Brain ----

export type BrainTier = 'fast' | 'standard' | 'top'

export interface BrainRequest {
  id: string
  task: string
  system: string
  prompt: string
  images?: string[]
  tier: BrainTier
  expectJson?: boolean
}

export interface BrainResult {
  id: string
  ok: boolean
  text: string
  json?: unknown
  error?: string
  elapsedMs: number
}

export interface BrainStatus {
  claude: { available: boolean; version: string | null }
  codex: { available: boolean; version: string | null }
}

// ---- IPC surface ----

export interface SlateApi {
  listProjects(): Promise<ProjectMeta[]>
  createProject(name: string): Promise<Project>
  openProject(id: string): Promise<Project | null>
  saveProject(project: Project): Promise<void>
  deleteProject(id: string): Promise<void>
  brainStatus(): Promise<BrainStatus>
  brainRun(req: BrainRequest): Promise<BrainResult>
  brainCancel(id: string): Promise<void>
  pickMedia(): Promise<string[]>
  ingestMedia(projectId: string, path: string): Promise<{ kind: 'image' | 'video'; frames: string[] }>
  copyText(text: string): Promise<void>
  revealProject(id: string): Promise<void>
  onProjectsChanged(cb: () => void): () => void
}
