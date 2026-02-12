/**
 * ShortVideoWorker API Contract Types
 * 
 * These types define the contract between ShortVideoWorker and ShortVideoMaker.
 * Used for the synchronous /api/short-video/render endpoint.
 */

export interface WorkerScene {
  /** Spoken text for this scene */
  text: string;
  /** Duration in milliseconds */
  duration: number;
  /** Search terms derived from narration */
  searchTerms: string[];
}

export interface WorkerAsset {
  /** Query used for Pexels/etc. */
  searchTerms: string;
  /** Pre-selected stock video url (may be null) */
  videoUrl: string | null;
}

export interface WorkerConfig {
  /** Video resolution (e.g. "1080x1920") */
  resolution: string;
  /** Tone: STOIC | EPIC | PLAYFUL | NEUTRAL */
  tone: 'STOIC' | 'EPIC' | 'PLAYFUL' | 'NEUTRAL' | string;
  /** Platform: TIKTOK | INSTAGRAM | X */
  platform: 'TIKTOK' | 'INSTAGRAM' | 'X' | string;
  /** URL to mp3 audio produced by worker */
  ttsUrl: string;
  /** Pre-selected stock assets */
  assets: WorkerAsset[];
}

export interface WorkerNarrative {
  summaryId?: string;
  stylePackId?: string;
  [key: string]: unknown;
}

/** Request body from ShortVideoWorker */
export interface ShortVideoRenderRequest {
  scenes: WorkerScene[];
  config: WorkerConfig;
  narrative?: WorkerNarrative;
}

/** Response when RESPONSE_MODE=url */
export interface ShortVideoUrlResponse {
  videoUrl: string;
}

/** Error response */
export interface ErrorResponse {
  error: string;
  details?: string;
}

// =============================================================================
// Remotion Composition Types (for ShortVerticalVideo)
// =============================================================================

/**
 * Scene visual plan - the input for each scene in the Remotion composition
 */
export interface SceneVisualPlan {
  id: string;
  startFrame: number;
  durationInFrames: number;
  text: string;
  assetUrl?: string; // optional background clip URL
  searchTerms: string[];
}

/**
 * Theme colors for styling
 */
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background?: string;
  textOnBackground?: string;
}

/**
 * Style configuration for the composition
 */
export interface RenderStyle {
  tone: string; // 'STOIC' | 'EPIC' | 'PLAYFUL' | 'NEUTRAL' | etc.
  platform: string; // 'TIKTOK' | 'INSTAGRAM' | 'X' | etc.
  captionStyle: 'highlight' | 'default' | string;
  themeColors: ThemeColors;
}

/**
 * Audio configuration
 */
export interface RenderAudio {
  ttsAudioUrl: string;
}

/**
 * Meta information
 */
export interface RenderMeta {
  summaryId?: string;
  stylePackId?: string;
}

/**
 * Complete render plan - the main input prop for ShortVerticalVideo composition
 */
export interface RenderPlan {
  width: number; // typically 1080
  height: number; // typically 1920
  fps: number; // e.g. 30
  scenes: SceneVisualPlan[];
  audio: RenderAudio;
  style: RenderStyle;
  meta?: RenderMeta;
}
