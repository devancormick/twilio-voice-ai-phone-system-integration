import { isBusinessHours } from "./business-hours.js";
import { streamSpeech, buildAudioUrl } from "./elevenlabs.js";
import { parseFormBody, readRequestBody, sendJson, sendXml } from "./http.js";
import { classifyCallerIntent } from "./openrouter.js";
import { buildVoiceResponse, dial, gather, hangup, pause, play, redirect, say } from "./twiml.js";

function normalizeBaseUrl(baseUrl) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function buildAbsoluteUrl(baseUrl, path) {
  return `${normalizeBaseUrl(baseUrl)}${path}`;
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

function buildIncomingTwiml(config, isOpen) {
  return buildVoiceResponse([
    gather(
      {
        input: "speech",
        action: buildAbsoluteUrl(config.baseUrl, "/voice/respond"),
        method: "POST",
        speechTimeout: "auto",
        timeout: 3,
        language: "en-US",
        actionOnEmptyResult: "true",
        hints: "leasing, maintenance, emergency, property management, availability, application"
      },
      play(buildAudioUrl(config.baseUrl, welcomeMessage(config, isOpen)))
    ),
    pause(1),
    redirect(buildAbsoluteUrl(config.baseUrl, "/voice/incoming"), "POST")
  ]);
}

function buildTransferTwiml(message, transferNumber, config) {
  return buildVoiceResponse([
    play(buildAudioUrl(config.baseUrl, message)),
    dial(transferNumber, { timeout: 25 }),
    play(
      buildAudioUrl(
        config.baseUrl,
        "I’m sorry, the transfer did not connect. Please leave a voicemail or call back shortly."
      )
    ),
    hangup()
  ]);
}

function buildAiReplyTwiml(reply, config, isOpen) {
  const closing = isOpen
    ? "If you need anything else, please call again."
    : "If this becomes urgent, please call back and say emergency maintenance.";

  return buildVoiceResponse([
    play(buildAudioUrl(config.baseUrl, reply)),
    pause(1),
    play(buildAudioUrl(config.baseUrl, closing)),
    hangup()
  ]);
}

export function buildApp({
  config,
  clock = () => new Date(),
  classifyIntent = classifyCallerIntent,
  streamSpeechImpl = streamSpeech
}) {
  async function handleHealth(response) {
    sendJson(response, 200, { ok: true });
  }

  async function handleIncoming(response) {
    const open = isBusinessHours(clock(), config);
    sendXml(response, 200, buildIncomingTwiml(config, open));
  }

  async function handleAudio(request, response) {
    const url = new URL(request.url, "http://localhost");
    const encodedText = url.searchParams.get("text");
    const text = encodedText ? Buffer.from(encodedText, "base64url").toString("utf8") : "";

    try {
      await streamSpeechImpl({ config, text, response });
    } catch (error) {
      console.error("Audio generation error", error);
      sendJson(response, 502, { error: "Audio generation failed" });
    }
  }

  async function handleRespond(request, response) {
    const body = await readRequestBody(request);
    const form = parseFormBody(body);
    const speechText = form.SpeechResult?.trim();
    const open = isBusinessHours(clock(), config);

    if (!speechText) {
      sendXml(
        response,
        200,
        buildVoiceResponse([
          gather(
            {
              input: "speech",
              action: buildAbsoluteUrl(config.baseUrl, "/voice/respond"),
              method: "POST",
              speechTimeout: "auto",
              timeout: 3,
              language: "en-US",
              actionOnEmptyResult: "true"
            },
            play(buildAudioUrl(config.baseUrl, fallbackMessage()))
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
        businessName: config.businessName
      });

      if (result.route === "transfer_emergency") {
        sendXml(
          response,
          200,
          buildTransferTwiml(
            "Please hold while I transfer you to our emergency maintenance line.",
            config.emergencyTransferNumber,
            config
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
            config
          )
        );
        return;
      }

      sendXml(response, 200, buildAiReplyTwiml(result.reply, config, open));
    } catch (error) {
      console.error("Voice response error", error);
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
    const url = new URL(request.url, "http://localhost");

    if (request.method === "GET" && url.pathname === "/health") {
      await handleHealth(response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/voice/incoming") {
      await handleIncoming(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/voice/audio") {
      await handleAudio(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/voice/respond") {
      await handleRespond(request, response);
      return;
    }

    sendJson(response, 404, { error: "Not found" });
  }

  return { handle };
}
