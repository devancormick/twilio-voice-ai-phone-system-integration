import { sendJson } from "./http.js";

export function buildAudioUrl(baseUrl, text) {
  const encoded = Buffer.from(text, "utf8").toString("base64url");
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalized}/voice/audio?text=${encoded}`;
}

export async function streamSpeech({ config, text, response, fetchImpl = fetch }) {
  if (!text) {
    sendJson(response, 400, { error: "Missing text" });
    return;
  }

  const apiResponse = await fetchImpl(
    `https://api.elevenlabs.io/v1/text-to-speech/${config.elevenLabsVoiceId}/stream`,
    {
      method: "POST",
      headers: {
        "xi-api-key": config.elevenLabsApiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg"
      },
      body: JSON.stringify({
        text,
        model_id: config.elevenLabsModelId,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.8
        }
      })
    }
  );

  if (!apiResponse.ok || !apiResponse.body) {
    throw new Error(`ElevenLabs request failed with status ${apiResponse.status}`);
  }

  response.writeHead(apiResponse.status, {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-store"
  });

  for await (const chunk of apiResponse.body) {
    response.write(chunk);
  }

  response.end();
}
