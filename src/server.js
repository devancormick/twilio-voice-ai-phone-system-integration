import http from "node:http";
import { createCallStore } from "./call-store.js";
import { getConfig, validateConfig } from "./config.js";
import { createAudioCache } from "./elevenlabs.js";
import { createLogger } from "./logger.js";
import { buildApp } from "./voice-app.js";

const config = getConfig();
validateConfig(config);
const logger = createLogger("twilio-voice-ai");
const callStore = createCallStore(config.maxRecentCalls);
const audioCache = createAudioCache(config.audioCacheTtlMs);

const app = buildApp({ config, logger, callStore, audioCache });

const server = http.createServer(app.handle);

server.listen(config.port, () => {
  logger.info("server_started", {
    port: config.port,
    baseUrl: config.baseUrl,
    env: config.nodeEnv
  });
});

function shutdown(signal) {
  logger.info("server_shutdown_requested", { signal });
  server.close(() => {
    logger.info("server_shutdown_complete", { signal });
    process.exit(0);
  });

  setTimeout(() => {
    logger.error("server_shutdown_forced", { signal });
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
