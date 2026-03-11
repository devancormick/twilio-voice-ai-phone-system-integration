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

export function getConfig() {
  return {
    port: Number.parseInt(readEnv("PORT", "3000"), 10),
    baseUrl: readEnv("BASE_URL"),
    openRouterApiKey: readEnv("OPENROUTER_API_KEY"),
    openRouterModel: readEnv("OPENROUTER_MODEL", "anthropic/claude-3.5-sonnet"),
    elevenLabsApiKey: readEnv("ELEVENLABS_API_KEY"),
    elevenLabsVoiceId: readEnv("ELEVENLABS_VOICE_ID"),
    elevenLabsModelId: readEnv("ELEVENLABS_MODEL_ID", "eleven_multilingual_v2"),
    businessTimezone: readEnv("BUSINESS_TIMEZONE", "America/New_York"),
    businessHoursStart: readEnv("BUSINESS_HOURS_START", "09:00"),
    businessHoursEnd: readEnv("BUSINESS_HOURS_END", "16:00"),
    emergencyTransferNumber: readEnv("EMERGENCY_TRANSFER_NUMBER"),
    propertyTransferNumber: readEnv("PROPERTY_TRANSFER_NUMBER"),
    businessName: readEnv("BUSINESS_NAME", "Property Management")
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
}
