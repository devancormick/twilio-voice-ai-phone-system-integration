const REQUIRED_ENV_VARS = [
  "BASE_URL",
  "OPENROUTER_API_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_VOICE_ID",
  "EMERGENCY_TRANSFER_NUMBER",
  "PROPERTY_TRANSFER_NUMBER"
];

function readEnv(name, fallback = "") {
  return process.env[name]?.trim() || fallback;
}

function readBool(name, fallback = false) {
  const value = readEnv(name, fallback ? "true" : "false").toLowerCase();
  return value === "true";
}

export function getConfig() {
  return {
    nodeEnv: readEnv("NODE_ENV", "development"),
    port: Number.parseInt(readEnv("PORT", "3000"), 10),
    baseUrl: readEnv("BASE_URL"),
    openRouterApiKey: readEnv("OPENROUTER_API_KEY"),
    openRouterModel: readEnv("OPENROUTER_MODEL", "openrouter/auto"),
    openRouterTimeoutMs: Number.parseInt(readEnv("OPENROUTER_TIMEOUT_MS", "15000"), 10),
    elevenLabsApiKey: readEnv("ELEVENLABS_API_KEY"),
    elevenLabsVoiceId: readEnv("ELEVENLABS_VOICE_ID"),
    elevenLabsModelId: readEnv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
    elevenLabsTimeoutMs: Number.parseInt(readEnv("ELEVENLABS_TIMEOUT_MS", "20000"), 10),
    audioCacheTtlMs: Number.parseInt(readEnv("AUDIO_CACHE_TTL_MS", "3600000"), 10),
    businessTimezone: readEnv("BUSINESS_TIMEZONE", "America/New_York"),
    businessHoursStart: readEnv("BUSINESS_HOURS_START", "09:00"),
    businessHoursEnd: readEnv("BUSINESS_HOURS_END", "16:00"),
    emergencyTransferNumber: readEnv("EMERGENCY_TRANSFER_NUMBER"),
    propertyTransferNumber: readEnv("PROPERTY_TRANSFER_NUMBER"),
    businessName: readEnv("BUSINESS_NAME", "Property Management"),
    twilioAuthToken: readEnv("TWILIO_AUTH_TOKEN"),
    requireTwilioSignature: readBool("REQUIRE_TWILIO_SIGNATURE", false),
    adminApiKey: readEnv("ADMIN_API_KEY"),
    maxRequestBodyBytes: Number.parseInt(readEnv("MAX_REQUEST_BODY_BYTES", "32768"), 10),
    maxRecentCalls: Number.parseInt(readEnv("MAX_RECENT_CALLS", "100"), 10)
  };
}

export function validateConfig(config) {
  const missing = REQUIRED_ENV_VARS.filter((name) => !readEnv(name));
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  if (config.requireTwilioSignature && !config.twilioAuthToken) {
    throw new Error("TWILIO_AUTH_TOKEN is required when REQUIRE_TWILIO_SIGNATURE=true");
  }
}
