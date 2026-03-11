import { isBusinessHours } from "./business-hours.js";
import { streamSpeech, buildAudioUrl } from "./elevenlabs.js";
import { parseFormBody, readRequestBody, sendJson, sendText, sendXml } from "./http.js";
import { classifyCallerIntent } from "./openrouter.js";
import { buildVoiceResponse, dial, gather, hangup, pause, play, redirect, say } from "./twiml.js";
import { isTwilioRequestValid } from "./twilio-security.js";

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildAbsoluteUrl(baseUrl, path) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
}

function resolveBaseUrl(config, request) {
  const configured = config.baseUrl?.trim();
  if (configured && !configured.includes("localhost")) {
    return normalizeBaseUrl(configured);
  }

  const host = request.headers["x-forwarded-host"] || request.headers.host;
  const proto = request.headers["x-forwarded-proto"] || "http";
  if (host) {
    return `${proto}://${host}`;
  }

  return normalizeBaseUrl(config.baseUrl);
}

function welcomeMessage(config, isOpen) {
  if (isOpen) {
    return `Thank you for calling ${config.businessName}. Please briefly tell me how I can help you today.`;
  }

  return `Thank you for calling ${config.businessName}. Our office is currently closed, but I can still help and route urgent needs. Please briefly tell me the reason for your call.`;
}

function fallbackMessage() {
  return "I’m sorry, I didn’t catch that. Please briefly describe how I can help you.";
}

function speak(config, baseUrl, text) {
  if (config.useElevenLabsPlayback) {
    return play(buildAudioUrl(baseUrl, text));
  }
  return say(text);
}

function buildIncomingTwiml(config, baseUrl, isOpen) {
  return buildVoiceResponse([
    gather(
      {
        input: "speech",
        action: buildAbsoluteUrl(baseUrl, "/voice/respond"),
        method: "POST",
        speechTimeout: "auto",
        timeout: 3,
        language: "en-US",
        actionOnEmptyResult: "true",
        hints: "leasing, maintenance, emergency, property management, availability, application"
      },
      speak(config, baseUrl, welcomeMessage(config, isOpen))
    ),
    pause(1),
    redirect(buildAbsoluteUrl(baseUrl, "/voice/incoming"), "POST")
  ]);
}

function buildTransferTwiml(message, transferNumber, config, baseUrl) {
  return buildVoiceResponse([
    speak(config, baseUrl, message),
    dial(transferNumber, { timeout: 25 }),
    speak(config, baseUrl, "I’m sorry, the transfer did not connect. Please leave a voicemail or call back shortly."),
    hangup()
  ]);
}

function buildAiReplyTwiml(reply, config, baseUrl, isOpen) {
  const closing = isOpen
    ? "If you need anything else, please call again."
    : "If this becomes urgent, please call back and say emergency maintenance.";

  return buildVoiceResponse([
    speak(config, baseUrl, reply),
    pause(1),
    speak(config, baseUrl, closing),
    hangup()
  ]);
}

export function buildApp({
  config,
  clock = () => new Date(),
  classifyIntent = classifyCallerIntent,
  streamSpeechImpl = streamSpeech,
  logger = console,
  callStore = { upsert() {}, list() { return []; } },
  audioCache,
  requestIdFactory = () => Math.random().toString(36).slice(2, 10)
}) {
  function makeAbsoluteRequestUrl(request) {
    const baseUrl = resolveBaseUrl(config, request);
    return buildAbsoluteUrl(baseUrl, new URL(request.url, "http://localhost").pathname);
  }

  function isAdminAuthorized(request) {
    if (!config.adminApiKey) {
      return false;
    }
    return request.headers["x-admin-api-key"] === config.adminApiKey;
  }

  async function handleHealth(response) {
    sendJson(response, 200, {
      ok: true,
      service: "twilio-voice-ai-phone-system-integration",
      environment: config.nodeEnv
    });
  }

  async function handleRecentCalls(request, response) {
    if (!isAdminAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }

    sendJson(response, 200, { calls: callStore.list() });
  }

  async function handleStatusCallback(request, response, form) {
    callStore.upsert({
      callSid: form.CallSid,
      callStatus: form.CallStatus,
      direction: form.Direction,
      from: form.From,
      to: form.To,
      lastEvent: "status_callback"
    });
    sendText(response, 204, "");
  }

  async function validateTwilioRequest(request, response, form) {
    if (!config.requireTwilioSignature) {
      return true;
    }

    const signature = request.headers["x-twilio-signature"];
    const valid = isTwilioRequestValid({
      authToken: config.twilioAuthToken,
      signature,
      url: makeAbsoluteRequestUrl(request),
      formParams: form
    });

    if (!valid) {
      logger.warn("invalid_twilio_signature", { path: request.url });
      sendJson(response, 403, { error: "Invalid Twilio signature" });
      return false;
    }

    return true;
  }

  async function handleIncoming(request, response, form, requestId) {
    const open = isBusinessHours(clock(), config);
    const baseUrl = resolveBaseUrl(config, request);
    callStore.upsert({
      callSid: form.CallSid,
      from: form.From,
      to: form.To,
      direction: form.Direction,
      route: "incoming",
      isOpen: open,
      lastEvent: "incoming"
    });
    logger.info("voice_incoming", {
      requestId,
      callSid: form.CallSid,
      from: form.From,
      to: form.To,
      isOpen: open
    });
    sendXml(response, 200, buildIncomingTwiml(config, baseUrl, open));
  }

  async function handleAudio(request, response, requestId) {
    const url = new URL(request.url, "http://localhost");
    const encodedText = url.searchParams.get("text");
    const text = encodedText ? Buffer.from(encodedText, "base64url").toString("utf8") : "";

    try {
      await streamSpeechImpl({ config, text, response, audioCache });
    } catch (error) {
      logger.error("audio_generation_error", { requestId, error: error.message });
      sendJson(response, 502, { error: "Audio generation failed" });
    }
  }

  async function handleRespond(_request, response, form, requestId) {
    const speechText = form.SpeechResult?.trim();
    const open = isBusinessHours(clock(), config);
    const baseUrl = resolveBaseUrl(config, _request);

    if (!speechText) {
      callStore.upsert({
        callSid: form.CallSid,
        from: form.From,
        to: form.To,
        isOpen: open,
        lastEvent: "empty_speech"
      });
      sendXml(
        response,
        200,
        buildVoiceResponse([
          gather(
            {
              input: "speech",
              action: buildAbsoluteUrl(baseUrl, "/voice/respond"),
              method: "POST",
              speechTimeout: "auto",
              timeout: 3,
              language: "en-US",
              actionOnEmptyResult: "true"
            },
            speak(config, baseUrl, fallbackMessage())
          ),
          hangup()
        ])
      );
      return;
    }

    try {
      const result = await classifyIntent({
        apiKey: config.openRouterApiKey,
        model: config.openRouterModel,
        speechText,
        isOpen: open,
        businessName: config.businessName,
        timeoutMs: config.openRouterTimeoutMs
      });
      callStore.upsert({
        callSid: form.CallSid,
        from: form.From,
        to: form.To,
        transcript: speechText,
        summary: result.summary,
        route: result.route,
        isOpen: open,
        lastEvent: "responded"
      });
      logger.info("voice_classified", {
        requestId,
        callSid: form.CallSid,
        route: result.route,
        isOpen: open
      });

      if (result.route === "transfer_emergency") {
        sendXml(
          response,
          200,
          buildTransferTwiml(
            "Please hold while I transfer you to our emergency maintenance line.",
            config.emergencyTransferNumber,
            config,
            baseUrl
          )
        );
        return;
      }

      if (result.route === "transfer_property") {
        sendXml(
          response,
          200,
          buildTransferTwiml(
            "Please hold while I transfer you to our property management team.",
            config.propertyTransferNumber,
            config,
            baseUrl
          )
        );
        return;
      }

      sendXml(response, 200, buildAiReplyTwiml(result.reply, config, baseUrl, open));
    } catch (error) {
      logger.error("voice_response_error", {
        requestId,
        callSid: form.CallSid,
        error: error.message
      });
      sendXml(
        response,
        200,
        buildVoiceResponse([
          say(
            "I’m sorry, I’m having trouble reaching the assistant right now. Please call back in a few minutes."
          ),
          hangup()
        ])
      );
    }
  }

  async function handle(request, response) {
    const requestId = requestIdFactory();
    try {
      const url = new URL(request.url, "http://localhost");

      if (request.method === "GET" && url.pathname === "/health") {
        await handleHealth(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/calls") {
        await handleRecentCalls(request, response);
        return;
      }

      if (request.method === "POST" && url.pathname === "/voice/incoming") {
        const body = await readRequestBody(request, config.maxRequestBodyBytes);
        const form = parseFormBody(body);
        if (!(await validateTwilioRequest(request, response, form))) {
          return;
        }
        await handleIncoming(request, response, form, requestId);
        return;
      }

      if (request.method === "GET" && url.pathname === "/voice/audio") {
        await handleAudio(request, response, requestId);
        return;
      }

      if (request.method === "POST" && url.pathname === "/voice/respond") {
        const body = await readRequestBody(request, config.maxRequestBodyBytes);
        const form = parseFormBody(body);
        if (!(await validateTwilioRequest(request, response, form))) {
          return;
        }
        await handleRespond(request, response, form, requestId);
        return;
      }

      if (request.method === "POST" && url.pathname === "/voice/status") {
        const body = await readRequestBody(request, config.maxRequestBodyBytes);
        const form = parseFormBody(body);
        if (!(await validateTwilioRequest(request, response, form))) {
          return;
        }
        await handleStatusCallback(request, response, form);
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      logger.error("request_handling_error", {
        requestId,
        path: request.url,
        error: error.message
      });
      sendJson(response, 500, { error: "Internal server error", requestId });
    }
  }

  return { handle };
}
