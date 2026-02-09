/* eslint-disable @typescript-eslint/no-unused-vars */
// Global error handlers - must be at the very top before any other code
process.on("uncaughtException", (err: Error) => {
  console.error("[uncaughtException]", err);
  console.error("[uncaughtException] Stack:", err.stack);
  // Don't exit - let the server continue if possible
});

process.on("unhandledRejection", (reason: unknown) => {
  console.error("[unhandledRejection]", reason);
  if (reason instanceof Error) {
    console.error("[unhandledRejection] Stack:", reason.stack);
  }
  // Don't exit - let the server continue if possible
});

import path from "path";
import fs from "fs-extra";

import { Remotion } from "./short-creator/libraries/Remotion";
import { Whisper } from "./short-creator/libraries/Whisper";
import { FFMpeg } from "./short-creator/libraries/FFmpeg";
import { PexelsAPI } from "./short-creator/libraries/Pexels";
import { Config } from "./config";
import { ShortCreator } from "./short-creator/ShortCreator";
import { logger } from "./logger";
import { Server } from "./server/server";
import { MusicManager } from "./short-creator/music";

async function main() {
  const config = new Config();
  try {
    config.ensureConfig();
  } catch (err: unknown) {
    logger.error(err, "Error in config validation - API calls will fail until fixed");
    // Don't exit - server can still start for debugging
  }

  const musicManager = new MusicManager(config);
  try {
    logger.debug("checking music files");
    musicManager.ensureMusicFilesExist();
  } catch (error: unknown) {
    logger.error(error, "Missing music files - videos will not have background music");
    // Don't exit - server can still start
  }

  // Initialize Remotion
  let remotion: Remotion;
  try {
    logger.debug("initializing remotion");
    remotion = await Remotion.init(config);
    logger.info("Remotion initialized successfully");
  } catch (error: unknown) {
    logger.error(error, "Failed to initialize Remotion - video rendering will fail");
    remotion = null as unknown as Remotion;
  }

  // Initialize FFmpeg
  let ffmpeg: FFMpeg;
  try {
    logger.debug("initializing ffmpeg");
    ffmpeg = await FFMpeg.init();
    logger.info("FFmpeg initialized successfully");
  } catch (error: unknown) {
    logger.error(error, "Failed to initialize FFmpeg - audio/video processing will fail");
    ffmpeg = null as unknown as FFMpeg;
  }

  // Initialize Whisper
  let whisper: Whisper;
  try {
    logger.debug("initializing whisper");
    whisper = await Whisper.init(config);
    logger.info("Whisper initialized successfully");
  } catch (error: unknown) {
    logger.error(error, "Failed to initialize Whisper - caption generation will fail");
    whisper = null as unknown as Whisper;
  }

  const pexelsApi = new PexelsAPI(config.pexelsApiKey);

  logger.debug("initializing the short creator");
  const shortCreator = new ShortCreator(
    config,
    remotion,
    whisper,
    ffmpeg,
    pexelsApi,
    musicManager,
  );

  // Skip installation test when running in Docker - it's already baked into the image
  if (!config.runningInDocker) {
    // the project is running with npm - we need to check if the installation is correct
    if (fs.existsSync(config.installationSuccessfulPath)) {
      logger.info("the installation is successful - starting the server");
    } else {
      logger.info(
        "testing if the installation was successful - this may take a while...",
      );
      try {
        await ffmpeg.createMp3DataUri(Buffer.from([]));
        await pexelsApi.findVideo(["dog"], 2.4);
        const testVideoPath = path.join(config.tempDirPath, "test.mp4");
        await remotion.testRender(testVideoPath);
        fs.rmSync(testVideoPath, { force: true });
        fs.writeFileSync(config.installationSuccessfulPath, "ok", {
          encoding: "utf-8",
        });
        logger.info("the installation was successful - starting the server");
      } catch (error: unknown) {
        logger.fatal(
          error,
          "The environment is not set up correctly - please follow the instructions in the README.md file https://github.com/gyoridavid/short-video-maker",
        );
        // Still continue to server - allow debugging
        logger.warn("Starting server despite installation test failure for debugging");
      }
    }
  } else {
    logger.info("Running in Docker - skipping installation test");
  }

  logger.debug("initializing the server");
  const server = new Server(config, shortCreator);
  const app = server.start();

  logger.info("Server started successfully on port " + config.port);
  // todo add shutdown handler
}

main().catch((error: unknown) => {
  logger.error(error, "Error starting server");
});
