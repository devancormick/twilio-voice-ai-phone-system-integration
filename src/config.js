const REQUIRED_ENV_VARS = [
  "BASE_URL",
  "ANTHROPIC_API_KEY",
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
    anthropicApiKey: readEnv("ANTHROPIC_API_KEY"),
    claudeModel: readEnv("CLAUDE_MODEL", "claude-3-5-sonnet-latest"),
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
