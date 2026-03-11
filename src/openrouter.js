const SYSTEM_PROMPT = `You are a phone-routing assistant for a boutique property management company.
Return strict JSON only.
Choose one route from: ai_response, transfer_emergency, transfer_property.
Summarize the caller request and provide a short reply for the caller.
If the caller mentions urgent maintenance, flooding, water leaks, no heat, no air conditioning in dangerous conditions, fire, gas smell, lockout, or similar emergencies, choose transfer_emergency.
If the caller wants to speak with property management, leasing, owner services, contracts, or a team member about management matters, choose transfer_property.
Otherwise choose ai_response.`;

function detectRuleBasedRoute(speechText) {
  const normalized = speechText.toLowerCase();
  const emergencyPatterns = [
    "emergency",
    "urgent maintenance",
    "water leak",
    "flood",
    "flooding",
    "gas smell",
    "fire",
    "lockout",
    "no heat",
    "no ac",
    "no air conditioning"
  ];
  const propertyPatterns = [
    "property management",
    "property manager",
    "management team",
    "leasing office",
    "leasing agent",
    "speak to someone",
    "talk to someone",
    "talk to property",
    "owner services"
  ];

  if (emergencyPatterns.some((pattern) => normalized.includes(pattern))) {
    return "transfer_emergency";
  }

  if (propertyPatterns.some((pattern) => normalized.includes(pattern))) {
    return "transfer_property";
  }

  return null;
}

export async function classifyCallerIntent({
  apiKey,
  model,
  speechText,
  isOpen,
  businessName,
  timeoutMs = 15000,
  fetchImpl = fetch
}) {
  const ruleBasedRoute = detectRuleBasedRoute(speechText);
  if (ruleBasedRoute) {
    return {
      route: ruleBasedRoute,
      reply: "I can help with that.",
      summary: speechText
    };
  }

  const requestedModels = model
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const payload = {
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          businessName,
          businessHoursStatus: isOpen ? "open" : "after_hours",
          callerRequest: speechText
        })
      }
    ]
  };

  if (requestedModels.length <= 1) {
    payload.model = requestedModels[0] || "openrouter/auto";
  } else {
    payload.models = requestedModels;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);
  const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://localhost",
      "X-Title": "twilio-voice-ai-phone-system-integration"
    },
    body: JSON.stringify(payload),
    signal: abortController.signal
  }).finally(() => {
    clearTimeout(timeoutId);
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenRouter request failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || "{}";
  const parsed = JSON.parse(text);

  return {
    route: parsed.route || "ai_response",
    reply: parsed.reply || "I can help with that.",
    summary: parsed.summary || speechText
  };
}
