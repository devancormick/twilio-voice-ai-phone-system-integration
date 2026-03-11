const SYSTEM_PROMPT = `You are a phone-routing assistant for a boutique property management company.
Return strict JSON only.
Choose one route from: ai_response, transfer_emergency, transfer_property.
Summarize the caller request and provide a short reply for the caller.
If the caller mentions urgent maintenance, flooding, water leaks, no heat, no air conditioning in dangerous conditions, fire, gas smell, lockout, or similar emergencies, choose transfer_emergency.
If the caller wants to speak with property management, leasing, owner services, contracts, or a team member about management matters, choose transfer_property.
Otherwise choose ai_response.`;

export async function classifyCallerIntent({
  apiKey,
  model,
  speechText,
  isOpen,
  businessName,
  fetchImpl = fetch
}) {
  const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://localhost",
      "X-Title": "twilio-voice-ai-phone-system-integration"
    },
    body: JSON.stringify({
      model,
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
    })
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed with status ${response.status}`);
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
