import test from "node:test";
import assert from "node:assert/strict";
import { Readable, Writable } from "node:stream";
import { buildApp } from "../src/voice-app.js";

function createConfig() {
  return {
    baseUrl: "https://voice.example.com",
    openRouterApiKey: "test-key",
    openRouterModel: "openrouter-test",
    elevenLabsApiKey: "eleven-test-key",
    elevenLabsVoiceId: "voice-id",
    elevenLabsModelId: "eleven_multilingual_v2",
    businessTimezone: "America/New_York",
    businessHoursStart: "09:00",
    businessHoursEnd: "16:00",
    emergencyTransferNumber: "+15555550101",
    propertyTransferNumber: "+15555550102",
    businessName: "Lake Oconee Property Management"
  };
}

async function invoke(app, { method, path, body = "" }) {
  const request = Readable.from(body);
  request.method = method;
  request.url = path;
  request.headers = {
    "content-type": "application/x-www-form-urlencoded",
    "content-length": String(Buffer.byteLength(body))
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
  assert.match(result.body, /<Play>https:\/\/voice\.example\.com\/voice\/audio\?text=/);
});

test("emergency calls transfer to emergency line", async () => {
  const app = buildApp({
    config: createConfig(),
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
  assert.match(result.body, /<Number>\+15555550101<\/Number>/);
});

test("property inquiries transfer to property line", async () => {
  const app = buildApp({
    config: createConfig(),
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
  assert.match(result.body, /<Number>\+15555550102<\/Number>/);
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
  assert.match(result.body, /<Play>https:\/\/voice\.example\.com\/voice\/audio\?text=/);
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
