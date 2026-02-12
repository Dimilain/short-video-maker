# ShortVideoMaker Worker Integration Guide

This document describes the synchronous `/api/short-video/render` endpoint that integrates with the ShortVideoWorker service.

## Overview

The ShortVideoMaker service now exposes a production-ready HTTP API endpoint for the ShortVideoWorker Cloud Run service to call for synchronous video rendering.

## API Contract

### Endpoint

```
POST /api/short-video/render
Content-Type: application/json
```

### Request Body

```typescript
{
  scenes: Array<{
    text: string;           // spoken text for this scene
    duration: number;       // milliseconds
    searchTerms: string[]; // search terms for stock footage
  }>;
  config: {
    resolution: string;    // e.g. "1080x1920"
    tone: 'STOIC' | 'EPIC' | 'PLAYFUL' | 'NEUTRAL';
    platform: 'TIKTOK' | 'INSTAGRAM' | 'X';
    ttsUrl: string;        // URL to pre-generated MP3 audio
    assets: Array<{
      searchTerms: string;
      videoUrl: string | null;
    }>;
  };
  narrative?: {
    summaryId?: string;
    stylePackId?: string;
  };
}
```

### Response (Binary Mode - default)

```
HTTP/1.1 200 OK
Content-Type: video/mp4
X-Correlation-ID: <id>

<binary MP4 data>
```

### Response (URL Mode)

```
HTTP/1.1 200 OK
Content-Type: application/json
X-Correlation-ID: <id>

{
  "videoUrl": "https://storage.example.com/videos/xxx.mp4"
}
```

### Error Response

```
HTTP/1.1 500 Bad Request
Content-Type: application/json

{
  "error": "Error message",
  "correlationId": "<id>"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RESPONSE_MODE` | `binary` | Response mode: `binary` (MP4) or `url` (JSON with URL) |
| `AUDIO_DOWNLOAD_TIMEOUT_MS` | 15000 | Timeout for TTS audio downloads |
| `ASSET_DOWNLOAD_TIMEOUT_MS` | 15000 | Timeout for stock video downloads |
| `VIDEO_STORAGE_BUCKET_URL` | - | Base URL for video uploads (URL mode only) |
| `LOG_LEVEL` | `info` | Logging level: `debug`, `info`, `warn`, `error` |
| `PORT` | 3123 | HTTP server port |

## Configuration Examples

### Binary Mode (default)

```
RESPONSE_MODE=binary
AUDIO_DOWNLOAD_TIMEOUT_MS=15000
ASSET_DOWNLOAD_TIMEOUT_MS=15000
```

### URL Mode with Supabase Storage

```
RESPONSE_MODE=url
VIDEO_STORAGE_BUCKET_URL=https://your-project.supabase.co/storage/v1/object/public/videos
```

## Key Features

1. **Input Validation**: Validates request structure, scene text/duration, and config
2. **TTS Audio Download**: Downloads audio from provided URL with timeout
3. **Asset Resolution**: Downloads stock videos or falls back to generated backgrounds
4. **UTF-8/Emoji Sanitization**: Removes problematic Unicode for FFmpeg
5. **Structured Logging**: JSON logs with correlation IDs for debugging
6. **Error Handling**: Graceful fallbacks and clear error messages

## Deployment

### Cloud Run

```bash
gcloud run deploy short-video-maker \
  --image gcr.io/PROJECT/short-video-maker:v1 \
  --region us-central1 \
  --memory 4Gi \
  --cpu 2 \
  --min-instances 1 \
  --set-env-vars RESPONSE_MODE=binary,LOG_LEVEL=info
```

### Docker

```bash
docker build -t short-video-maker .
docker run -p 3123:3123 \
  -e RESPONSE_MODE=binary \
  -e PEXELS_API_KEY=xxx \
  short-video-maker
```

## Monitoring

### Health Check

```
GET /health
```

Returns:
```json
{
  "status": "ok"
}
```

### Logs

Logs are structured JSON suitable for Google Cloud Logging:

```json
{
  "timestamp": "2026-02-10T22:00:00.000Z",
  "level": "info",
  "correlationId": "render-123456-abc",
  "message": "Worker render request received",
  "sceneCount": 5,
  "resolution": "1080x1920"
}
```

## Integration with ShortVideoWorker

The ShortVideoWorker calls this endpoint during the rendering stage:

```typescript
const response = await fetch(`${SHORT_VIDEO_MAKER_URL}/api/short-video`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    scenes: script.scenes,
    config: { resolution, tone, platform, ttsUrl, assets },
    narrative: { summaryId, stylePackId }
  })
});

if (response.ok) {
  const videoBuffer = Buffer.from(await response.arrayBuffer());
  // Upload to storage...
}
```

## Error Handling

- **400 Bad Request**: Invalid request body or missing required fields
- **500 Internal Server Error**: Rendering failed (check correlation ID in logs)
- **Timeout errors**: Asset download timeouts (increase timeout env vars)
- **FFmpeg errors**: Check logs for specific FFmpeg error messages

## Performance Notes

- Rendering time depends on video length and complexity
- Default timeout for rendering: 3 minutes (180000ms)
- For longer videos, consider:
  - Increasing memory allocation
  - Using URL mode for async processing
  - Scaling CPU/memory based on load
