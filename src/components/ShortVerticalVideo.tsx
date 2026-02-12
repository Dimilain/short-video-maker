/**
 * ShortVerticalVideo - Production Remotion Composition for LogOS Pipeline
 * 
 * A deterministic, vertical short video composition that:
 * - Receives RenderPlan as inputProps from Node renderer
 * - Supports multiple scenes with captions and background videos
 * - Applies tone-based styling (STOIC, EPIC, PLAYFUL, NEUTRAL)
 * - Optimized for vertical platforms (TikTok, Instagram, X)
 */

import React from "react";
import {
  Composition,
  Sequence,
  useVideoConfig,
  useCurrentFrame,
  interpolate,
  Audio,
  Video,
  AbsoluteFill,
  staticFile,
} from "remotion";
import type { RenderPlan, SceneVisualPlan } from "../types/video-worker";

// =============================================================================
// Types (mirroring the worker contract)
// =============================================================================

export type { RenderPlan, SceneVisualPlan };

// =============================================================================
// Theme Resolution Helper
// =============================================================================

interface ResolvedTheme {
  background: string;
  captionBackground: string;
  captionText: string;
  overlayColor: string;
  accentColor: string;
}

function resolveTheme(tone: string, themeColors: RenderPlan["style"]["themeColors"]): ResolvedTheme {
  const base = themeColors;
  const upperTone = tone.toUpperCase();

  switch (upperTone) {
    case "STOIC":
      return {
        background: base.background ?? "#0a0a0f",
        captionBackground: "rgba(20, 20, 30, 0.85)",
        captionText: base.textOnBackground ?? "#e5e5e5",
        overlayColor: "rgba(0, 0, 0, 0.4)",
        accentColor: base.accent ?? "#6366f1",
      };
    case "EPIC":
      return {
        background: base.background ?? "#050510",
        captionBackground: "rgba(30, 10, 20, 0.9)",
        captionText: base.textOnBackground ?? "#fef3c7",
        overlayColor: "rgba(0, 0, 0, 0.5)",
        accentColor: base.accent ?? "#f59e0b",
      };
    case "PLAYFUL":
      return {
        background: base.background ?? "#0f172a",
        captionBackground: "rgba(30, 41, 59, 0.85)",
        captionText: base.textOnBackground ?? "#ffffff",
        overlayColor: "rgba(0, 0, 0, 0.25)",
        accentColor: base.accent ?? "#22d3ee",
      };
    default: // NEUTRAL
      return {
        background: base.background ?? "#0a0a0a",
        captionBackground: "rgba(0, 0, 0, 0.7)",
        captionText: base.textOnBackground ?? "#ffffff",
        overlayColor: "rgba(0, 0, 0, 0.35)",
        accentColor: base.accent ?? "#3b82f6",
      };
  }
}

// =============================================================================
// Animation Helpers
// =============================================================================

function useSceneAnimation(scene: SceneVisualPlan, fps: number) {
  const frame = useCurrentFrame();
  const sceneFrame = frame - scene.startFrame;
  const durationFrames = scene.durationInFrames;

  // Enter animation (first 15% of scene)
  const enterDuration = Math.max(5, Math.floor(durationFrames * 0.15));
  const enterProgress = Math.min(1, sceneFrame / enterDuration);

  // Exit animation (last 15% of scene)
  const exitStart = durationFrames - enterDuration;
  const exitProgress = Math.max(0, (sceneFrame - exitStart) / enterDuration);

  // Opacity: 0 → 1 → 1 → 0
  const opacity = interpolate(
    sceneFrame,
    [0, enterDuration, exitStart, durationFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  // Subtle vertical slide for caption
  const captionOffset = interpolate(enterProgress, [0, 1], [15, 0]);

  return {
    opacity,
    captionOffset,
    sceneFrame,
    enterProgress,
    exitProgress,
    isActive: sceneFrame >= 0 && sceneFrame < durationFrames,
  };
}

// =============================================================================
// CaptionBox Component
// =============================================================================

interface CaptionBoxProps {
  text: string;
  scene: SceneVisualPlan;
  style: RenderPlan["style"];
  theme: ResolvedTheme;
}

const CaptionBox: React.FC<CaptionBoxProps> = ({ text, style, theme, scene }) => {
  const { width, height, fps } = useVideoConfig();
  const { opacity, captionOffset } = useSceneAnimation(scene, fps);

  // Safe margins based on platform
  const horizontalPadding = width * 0.08;
  const maxWidth = width - horizontalPadding * 2;

  // Position: slightly below center for better readability
  const bottomZone = style.platform === "TIKTOK" ? height * 0.18 : height * 0.14;
  const captionY = height - bottomZone;

  // Tone-based font sizing
  const fontSize = style.tone.toUpperCase() === "EPIC" ? 48 : 42;
  const lineHeight = 1.25;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: captionY,
        transform: `translateX(-50%) translateY(${captionOffset}px)`,
        width: maxWidth,
        padding: "24px 28px",
        borderRadius: "28px",
        backgroundColor: theme.captionBackground,
        color: theme.captionText,
        fontSize,
        fontWeight: 600,
        lineHeight,
        textAlign: "center",
        opacity,
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
      }}
    >
      {text}
    </div>
  );
};

// =============================================================================
// BackgroundLayer Component
// =============================================================================

interface BackgroundLayerProps {
  scene: SceneVisualPlan;
  theme: ResolvedTheme;
}

const BackgroundLayer: React.FC<BackgroundLayerProps> = ({ scene, theme }) => {
  const { width, height } = useVideoConfig();
  const { opacity, isActive } = useSceneAnimation(scene, 30);

  if (!isActive && opacity < 0.01) {
    return null;
  }

  return (
    <AbsoluteFill>
      {/* Main background video or gradient */}
      {scene.assetUrl ? (
        <Video
          src={scene.assetUrl}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity,
          }}
          startFrom={0}
          endAt={Math.ceil(scene.durationInFrames * 0.1)} // Sample start
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            background: `linear-gradient(180deg, ${theme.background} 0%, #000 100%)`,
            opacity,
          }}
        />
      )}

      {/* Dark overlay for caption readability */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(
            to top,
            ${theme.overlayColor} 0%,
            transparent 30%,
            transparent 70%,
            ${theme.overlayColor} 100%
          )`,
          opacity,
        }}
      />

      {/* Accent vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at center, transparent 0%, ${theme.background} 100%)`,
          opacity: 0.3,
        }}
      />
    </AbsoluteFill>
  );
};

// =============================================================================
// SceneLayer Component
// =============================================================================

interface SceneLayerProps {
  scene: SceneVisualPlan;
  renderPlan: RenderPlan;
}

const SceneLayer: React.FC<SceneLayerProps> = ({ scene, renderPlan }) => {
  const theme = resolveTheme(renderPlan.style.tone, renderPlan.style.themeColors);

  return (
    <Sequence from={scene.startFrame} durationInFrames={scene.durationInFrames}>
      <BackgroundLayer scene={scene} theme={theme} />
      <CaptionBox
        text={scene.text}
        scene={scene}
        style={renderPlan.style}
        theme={theme}
      />
    </Sequence>
  );
};

// =============================================================================
// Global Overlay Layer (film grain, safe zones)
// =============================================================================

interface GlobalOverlayProps {
  style: RenderPlan["style"];
}

const GlobalOverlay: React.FC<GlobalOverlayProps> = ({ style }) => {
  const { width, height } = useVideoConfig();
  const frame = useCurrentFrame();

  // Subtle film grain effect (deterministic based on frame)
  const grain = Math.sin(frame * 0.5) * 0.015 + 0.985;

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {/* Platform UI safe zones indicator (subtle) */}
      <div
        style={{
          position: "absolute",
          bottom: height * 0.12,
          left: 0,
          right: 0,
          height: height * 0.02,
          background: "linear-gradient(to top, rgba(255,255,255,0.02) 0%, transparent 100%)",
        }}
      />

      {/* Very subtle vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(circle at center, transparent 50%, rgba(0,0,0,0.3) 100%)",
        }}
      />

      {/* Subtle grain overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.04,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='${grain}' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
    </AbsoluteFill>
  );
};

// =============================================================================
// Main Composition Component
// =============================================================================

export const ShortVerticalVideo: React.FC<{ renderPlan: RenderPlan }> = ({
  renderPlan,
}) => {
  const { width, height, fps } = renderPlan;
  const { audio, style, scenes } = renderPlan;

  // Calculate total duration
  const totalDurationInFrames = scenes.reduce(
    (max, s) => Math.max(max, s.startFrame + s.durationInFrames),
    0
  );

  // Resolve theme once
  const theme = resolveTheme(style.tone, style.themeColors);

  return (
    <AbsoluteFill style={{ backgroundColor: theme.background }}>
      {/* Global background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `linear-gradient(180deg, ${theme.background} 0%, #000 100%)`,
        }}
      />

      {/* Scene layers */}
      {scenes.map((scene) => (
        <SceneLayer key={scene.id} scene={scene} renderPlan={renderPlan} />
      ))}

      {/* Global overlay (grain, vignette, safe zones) */}
      <GlobalOverlay style={style} />

      {/* TTS Audio track */}
      {audio.ttsAudioUrl && (
        <Audio src={audio.ttsAudioUrl} startFrom={0} />
      )}
    </AbsoluteFill>
  );
};

// =============================================================================
// Composition Registration
// =============================================================================

// Mock render plan for Remotion Studio preview
const mockRenderPlan: RenderPlan = {
  width: 1080,
  height: 1920,
  fps: 30,
  scenes: [
    {
      id: "scene-1",
      startFrame: 0,
      durationInFrames: 90,
      text: "Welcome to LogOS",
      searchTerms: ["abstract", "technology"],
    },
    {
      id: "scene-2",
      startFrame: 90,
      durationInFrames: 90,
      text: "Creating amazing videos",
      searchTerms: ["creative", "video"],
    },
  ],
  audio: {
    ttsAudioUrl: staticFile("sample-audio.mp3"),
  },
  style: {
    tone: "NEUTRAL",
    platform: "TIKTOK",
    captionStyle: "default",
    themeColors: {
      primary: "#3b82f6",
      secondary: "#6366f1",
      accent: "#22d3ee",
      background: "#0f172a",
      textOnBackground: "#ffffff",
    },
  },
  meta: {
    summaryId: "demo",
    stylePackId: "default",
  },
};

// =============================================================================
// Export Composition Registration
// =============================================================================

export const registerShortVerticalVideo = () => (
  <Composition
    id="ShortVerticalVideo"
    component={ShortVerticalVideo}
    width={1080}
    height={1920}
    fps={30}
    durationInFrames={180} // 6 seconds default
    defaultProps={{ renderPlan: mockRenderPlan }}
  />
);
