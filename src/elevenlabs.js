import { sendJson } from "./http.js";

export function buildAudioUrl(baseUrl, text) {
  const encoded = Buffer.from(text, "utf8").toString("base64url");
  const normalized = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${normalized}/voice/audio?text=${encoded}`;
}

export function createAudioCache(ttlMs = 3600000) {
  const cache = new Map();

  return {
    get(key) {
      const entry = cache.get(key);
      if (!entry || entry.expiresAt < Date.now()) {
        cache.delete(key);
        return null;
      }
      return entry.value;
    },
    set(key, value) {
      cache.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
      });
    }
  };
}

export async function streamSpeech({ config, text, response, fetchImpl = fetch, audioCache }) {
  if (!text) {
    sendJson(response, 400, { error: "Missing text" });
    return;
  }

  const cacheKey = `${config.elevenLabsVoiceId}:${config.elevenLabsModelId}:${text}`;
  const cached = audioCache?.get(cacheKey);
  if (cached) {
    response.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=300",
      "Content-Length": cached.length
    });
    response.end(cached);
    return;
  }

  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), config.elevenLabsTimeoutMs);
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
      }),
      signal: abortController.signal
    }
  ).finally(() => {
    clearTimeout(timeoutId);
  });

  if (!apiResponse.ok || !apiResponse.body) {
    throw new Error(`ElevenLabs request failed with status ${apiResponse.status}`);
  }

  const chunks = [];
  for await (const chunk of apiResponse.body) {
    chunks.push(Buffer.from(chunk));
  }
  const audioBuffer = Buffer.concat(chunks);
  if (audioCache) {
    audioCache.set(cacheKey, audioBuffer);
  }

  response.writeHead(apiResponse.status, {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "public, max-age=300",
    "Content-Length": audioBuffer.length
  });
  response.end(audioBuffer);
}
