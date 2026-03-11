import test from "node:test";
import assert from "node:assert/strict";

const LIVE_BASE_URL =
  process.env.LIVE_BASE_URL || "https://twilio-voice-ai-phone-system-integration.onrender.com";

async function getTextResponse(url, options) {
  const response = await fetch(url, options);
  const body = await response.text();
  return { response, body };
}

test("live health endpoint responds successfully", async () => {
  const { response, body } = await getTextResponse(`${LIVE_BASE_URL}/health`);

  assert.equal(response.status, 200);
  assert.match(body, /"ok":true/);
  assert.match(body, /twilio-voice-ai-phone-system-integration/);
});

test("live incoming webhook returns TwiML", async () => {
  const { response, body } = await getTextResponse(`${LIVE_BASE_URL}/voice/incoming`, {
    method: "POST"
  });

  assert.equal(response.status, 200);
  assert.match(body, /<Response>/);
  assert.match(body, /<Gather/);
});

test("live respond webhook returns TwiML", async () => {
  const { response, body } = await getTextResponse(`${LIVE_BASE_URL}/voice/respond`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "SpeechResult=I%20need%20to%20talk%20to%20property%20management"
  });

  assert.equal(response.status, 200);
  assert.match(body, /<Response>/);
  assert.match(body, /<Dial>|<Say>|<Play>/);
});
