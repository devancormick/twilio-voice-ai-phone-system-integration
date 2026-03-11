const SYSTEM_PROMPT = `You are a phone-routing assistant for a boutique property management company.
Return strict JSON only.
Choose one route from: ai_response, transfer_emergency, transfer_property.
Summarize the caller request and provide a short reply for the caller.
If the caller mentions urgent maintenance, flooding, water leaks, no heat, no air conditioning in dangerous conditions, fire, gas smell, lockout, or similar emergencies, choose transfer_emergency.
If the caller wants to speak with property management, leasing, owner services, contracts, or a team member about management matters, choose transfer_property.
Otherwise choose ai_response.`;

function extractTextContent(data) {
  if (!Array.isArray(data.content)) {
    return "";
  }

  return data.content
    .filter((item) => item.type === "text")
    .map((item) => item.text)
    .join("\n")
    .trim();
}

export async function classifyCallerIntent({ apiKey, model, speechText, isOpen, businessName, fetchImpl = fetch }) {
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: JSON.stringify({
                businessName,
                businessHoursStatus: isOpen ? "open" : "after_hours",
                callerRequest: speechText
              })
            }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(`Anthropic request failed with status ${response.status}`);
  }

  const data = await response.json();
  const text = extractTextContent(data);
  const parsed = JSON.parse(text);

  return {
    route: parsed.route || "ai_response",
    reply: parsed.reply || "I can help with that.",
    summary: parsed.summary || speechText
  };
}
