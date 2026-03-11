import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { createCallStore } from "../src/call-store.js";
import { isTwilioRequestValid } from "../src/twilio-security.js";
import { buildApp } from "../src/voice-app.js";

function createConfig() {
  return {
    nodeEnv: "test",
    baseUrl: "http://localhost:3000",
    openRouterApiKey: "test-key",
    openRouterModel: "openrouter-test",
    openRouterTimeoutMs: 15000,
    elevenLabsApiKey: "eleven-test-key",
    elevenLabsVoiceId: "voice-id",
    elevenLabsModelId: "eleven_multilingual_v2",
    elevenLabsTimeoutMs: 20000,
    audioCacheTtlMs: 3600000,
    businessTimezone: "America/New_York",
    businessHoursStart: "09:00",
    businessHoursEnd: "16:00",
    emergencyTransferNumber: "+15622659207",
    propertyTransferNumber: "+15622659207",
    businessName: "Lake Oconee Property Management",
    twilioAuthToken: "",
    requireTwilioSignature: false,
    adminApiKey: "admin-secret",
    maxRequestBodyBytes: 32768,
    maxRecentCalls: 100
  };
}

async function invoke(app, { method, path, body = "", headers: requestHeaders = {} }) {
  const request = Readable.from(body);
  request.method = method;
  request.url = path;
  request.headers = {
    "content-type": "application/x-www-form-urlencoded",
    "content-length": String(Buffer.byteLength(body)),
    ...requestHeaders
  };

  let responseBody = "";
  let statusCode = 200;
  let headers = {};

  const response = new Writable({
    write(chunk, _encoding, callback) {
      responseBody += chunk.toString();
      callback();
    }
  });

  response.writeHead = (code, outgoingHeaders) => {
    statusCode = code;
    headers = outgoingHeaders;
  };

  response.end = (chunk = "") => {
    responseBody += chunk ? chunk.toString() : "";
    response.emit("finish");
  };

  await new Promise((resolve, reject) => {
    response.once("finish", resolve);
    Promise.resolve(app.handle(request, response)).catch(reject);
  });

  return { statusCode, headers, body: responseBody };
}

test("incoming call prompts for speech", async () => {
  const app = buildApp({
    config: createConfig(),
    clock: () => new Date("2026-03-16T14:00:00Z"),
    classifyIntent: async () => ({ route: "ai_response", reply: "ignored" }),
    streamSpeechImpl: async () => {}
  });

  const result = await invoke(app, { method: "POST", path: "/voice/incoming" });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /<Gather/);
  assert.match(result.body, /<Play>http:\/\/localhost:3000\/voice\/audio\?text=/);
});

test("emergency calls transfer to emergency line", async () => {
  const config = createConfig();
  const app = buildApp({
    config,
    clock: () => new Date("2026-03-16T14:00:00Z"),
    classifyIntent: async () => ({
      route: "transfer_emergency",
      reply: "",
      summary: "Caller has a water leak"
    }),
    streamSpeechImpl: async () => {}
  });

  const result = await invoke(app, {
    method: "POST",
    path: "/voice/respond",
    body: "SpeechResult=There%20is%20water%20coming%20through%20the%20ceiling"
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /voice\/audio\?text=/);
  assert.match(result.body, new RegExp(`<Number>${config.emergencyTransferNumber.replace("+", "\\+")}</Number>`));
});

test("property inquiries transfer to property line", async () => {
  const config = createConfig();
  const app = buildApp({
    config,
    clock: () => new Date("2026-03-16T14:00:00Z"),
    classifyIntent: async () => ({
      route: "transfer_property",
      reply: "",
      summary: "Caller wants to speak to property management"
    }),
    streamSpeechImpl: async () => {}
  });

  const result = await invoke(app, {
    method: "POST",
    path: "/voice/respond",
    body: "SpeechResult=I%20need%20to%20talk%20to%20property%20management"
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /voice\/audio\?text=/);
  assert.match(result.body, new RegExp(`<Number>${config.propertyTransferNumber.replace("+", "\\+")}</Number>`));
});

test("general inquiries return ai response", async () => {
  const app = buildApp({
    config: createConfig(),
    clock: () => new Date("2026-03-16T23:00:00Z"),
    classifyIntent: async () => ({
      route: "ai_response",
      reply: "We currently have two lakefront homes available this month.",
      summary: "Availability question"
    }),
    streamSpeechImpl: async () => {}
  });

  const result = await invoke(app, {
    method: "POST",
    path: "/voice/respond",
    body: "SpeechResult=Do%20you%20have%20anything%20available%20this%20month"
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /<Play>http:\/\/localhost:3000\/voice\/audio\?text=/);
});

test("audio endpoint streams generated speech", async () => {
  let streamedText = "";
  const app = buildApp({
    config: createConfig(),
    clock: () => new Date("2026-03-16T23:00:00Z"),
    classifyIntent: async () => ({
      route: "ai_response",
      reply: "ignored",
      summary: "ignored"
    }),
    streamSpeechImpl: async ({ text, response }) => {
      streamedText = text;
      response.writeHead(200, { "Content-Type": "audio/mpeg" });
      response.end("fake-mp3");
    }
  });

  const encoded = Buffer.from("Hello from ElevenLabs", "utf8").toString("base64url");
  const result = await invoke(app, {
    method: "GET",
    path: `/voice/audio?text=${encoded}`
  });

  assert.equal(result.statusCode, 200);
  assert.equal(streamedText, "Hello from ElevenLabs");
  assert.equal(result.body, "fake-mp3");
});

test("audio endpoint uses cache on repeated request", async () => {
  let fetchCount = 0;
  const app = buildApp({
    config: createConfig(),
    streamSpeechImpl: async ({ response, audioCache, text }) => {
      const key = `voice-id:eleven_multilingual_v2:${text}`;
      const cached = audioCache.get(key);
      if (cached) {
        response.writeHead(200, { "Content-Type": "audio/mpeg" });
        response.end(cached);
        return;
      }
      fetchCount += 1;
      const payload = Buffer.from("cached-audio");
      audioCache.set(key, payload);
      response.writeHead(200, { "Content-Type": "audio/mpeg" });
      response.end(payload);
    },
    audioCache: {
      store: new Map(),
      get(key) {
        return this.store.get(key) || null;
      },
      set(key, value) {
        this.store.set(key, value);
      }
    }
  });

  const encoded = Buffer.from("Hello from cache", "utf8").toString("base64url");
  const first = await invoke(app, { method: "GET", path: `/voice/audio?text=${encoded}` });
  const second = await invoke(app, { method: "GET", path: `/voice/audio?text=${encoded}` });

  assert.equal(first.body, "cached-audio");
  assert.equal(second.body, "cached-audio");
  assert.equal(fetchCount, 1);
});

test("recent calls endpoint requires admin key", async () => {
  const app = buildApp({
    config: createConfig()
  });

  const result = await invoke(app, { method: "GET", path: "/api/calls" });

  assert.equal(result.statusCode, 401);
});

test("recent calls endpoint returns logged calls for admin", async () => {
  const callStore = createCallStore();
  const config = createConfig();
  const app = buildApp({
    config,
    callStore,
    classifyIntent: async () => ({
      route: "ai_response",
      reply: "We can help with that.",
      summary: "General inquiry"
    }),
    streamSpeechImpl: async () => {}
  });

  await invoke(app, {
    method: "POST",
    path: "/voice/respond",
    body: "CallSid=CA123&From=%2B15551234567&To=%2B15557654321&SpeechResult=General%20question"
  });

  const result = await invoke(app, {
    method: "GET",
    path: "/api/calls",
    headers: { "x-admin-api-key": config.adminApiKey }
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /CA123/);
  assert.match(result.body, /General inquiry/);
});

test("voice webhook rejects invalid twilio signature when enabled", async () => {
  const config = {
    ...createConfig(),
    requireTwilioSignature: true,
    twilioAuthToken: "twilio-test-token"
  };
  const app = buildApp({ config });

  const result = await invoke(app, {
    method: "POST",
    path: "/voice/respond",
    body: "CallSid=CA123&SpeechResult=Hello",
    headers: { "x-twilio-signature": "invalid" }
  });

  assert.equal(result.statusCode, 403);
});

test("voice webhook accepts valid twilio signature when enabled", async () => {
  const config = {
    ...createConfig(),
    requireTwilioSignature: true,
    twilioAuthToken: "twilio-test-token"
  };
  const body = "CallSid=CA123&SpeechResult=Hello";
  const formParams = {
    CallSid: "CA123",
    SpeechResult: "Hello"
  };
  const signature = (() => {
    const url = "http://localhost:3000/voice/respond";
    const entries = Object.entries(formParams)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}${value}`)
      .join("");
    return isTwilioRequestValid({
      authToken: config.twilioAuthToken,
      signature: "invalid",
      url,
      formParams
    })
      ? "unexpected"
      : undefined;
  })();
  const crypto = await import("node:crypto");
  const expectedSignature = crypto
    .createHmac("sha1", config.twilioAuthToken)
    .update("http://localhost:3000/voice/respondCallSidCA123SpeechResultHello")
    .digest("base64");
  assert.equal(signature, undefined);

  const app = buildApp({
    config,
    classifyIntent: async () => ({
      route: "ai_response",
      reply: "Hello there.",
      summary: "Greeting"
    }),
    streamSpeechImpl: async () => {}
  });

  const result = await invoke(app, {
    method: "POST",
    path: "/voice/respond",
    body,
    headers: { "x-twilio-signature": expectedSignature }
  });

  assert.equal(result.statusCode, 200);
  assert.match(result.body, /voice\/audio/);
});
