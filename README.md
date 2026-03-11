# Twilio Voice AI Phone System Integration

Small-business Twilio Programmable Voice integration for an OpenRouter-powered property management phone assistant with production-safe Twilio voice prompts and optional ElevenLabs playback.

## Features

- Inbound Twilio voice webhook for the main business line
- OpenRouter-based caller intent classification
- Twilio `<Say>` playback by default for reliability
- Optional ElevenLabs-generated spoken prompts and responses
- Live transfer routing for emergency maintenance calls
- Live transfer routing for property management inquiries
- Monday through Friday, 9:00 AM to 4:00 PM business-hours handling
- After-hours messaging and escalation path
- Twilio signature validation for production webhooks
- Recent-call logging through an admin-protected endpoint
- Audio caching and upstream timeout protection
- Graceful shutdown and structured JSON logging
- Minimal Node.js runtime with no external package dependencies

## Configuration

Copy `.env.example` into `.env` and provide the real values:

- `BASE_URL`: base URL the app uses to build Twilio callback and audio URLs. Use `http://localhost:3000` for local testing here and a public HTTPS URL when wiring Twilio.
- `OPENROUTER_API_KEY`: API key for OpenRouter
- `OPENROUTER_MODEL`: model used for routing and reply generation
- `OPENROUTER_TIMEOUT_MS`: timeout for OpenRouter calls
- `ELEVENLABS_API_KEY`: API key for ElevenLabs
- `ELEVENLABS_VOICE_ID`: ElevenLabs voice id for phone playback
- `ELEVENLABS_MODEL_ID`: ElevenLabs speech model id
- `ELEVENLABS_TIMEOUT_MS`: timeout for ElevenLabs speech generation
- `AUDIO_CACHE_TTL_MS`: in-memory ElevenLabs audio cache lifetime
- `USE_ELEVENLABS_PLAYBACK`: set `true` only when you want TwiML to use ElevenLabs audio URLs instead of Twilio `<Say>`
- `EMERGENCY_TRANSFER_NUMBER`: destination for emergency maintenance
- `PROPERTY_TRANSFER_NUMBER`: destination for property management inquiries
- `BUSINESS_TIMEZONE`: timezone used to evaluate business hours
- `BUSINESS_HOURS_START` and `BUSINESS_HOURS_END`: default `09:00` and `16:00`
- `TWILIO_AUTH_TOKEN`: required when Twilio signature validation is enabled
- `REQUIRE_TWILIO_SIGNATURE`: set `true` in production
- `ADMIN_API_KEY`: required to view recent call logs
- `MAX_REQUEST_BODY_BYTES`: request size guardrail for webhook bodies
- `MAX_RECENT_CALLS`: size of the in-memory recent-call log

## Endpoints

- `GET /health`
- `GET /api/calls`
- `GET /voice/audio`
- `POST /voice/incoming`
- `POST /voice/respond`
- `POST /voice/status`

## Twilio setup

Point the Twilio voice webhook for the business phone number at:

`POST https://twilio-voice-ai-phone-system-integration.onrender.com/voice/incoming`

For local testing only:

`POST http://localhost:3000/voice/incoming`

Recommended Twilio production configuration:

- Voice webhook: `POST /voice/incoming`
- Status callback: `POST /voice/status`
- Request validation: keep `REQUIRE_TWILIO_SIGNATURE=true`
- Transfer numbers: configure real destination numbers in Render environment variables

Recommended Render environment values:

- `BASE_URL=https://twilio-voice-ai-phone-system-integration.onrender.com`
- `NODE_ENV=production`
- `REQUIRE_TWILIO_SIGNATURE=true`
- `TWILIO_AUTH_TOKEN=<your Twilio auth token>`
- `ADMIN_API_KEY=<strong random secret>`

The app responds with TwiML. It gathers speech from the caller, sends the transcript to OpenRouter for routing, then either:

- responds directly with an AI-generated answer
- transfers to the emergency maintenance number
- transfers to the property management number

By default, spoken prompts and replies use Twilio `<Say>` for reliability. If `USE_ELEVENLABS_PLAYBACK=true`, the app serves generated audio through `/voice/audio` and Twilio plays it with `<Play>`.

## Operations

- `GET /health` returns deployment-safe health metadata.
- `GET /api/calls` returns recent in-memory call records when `x-admin-api-key` matches `ADMIN_API_KEY`.
- JSON logs include request ids and masked phone numbers for easier debugging in Render logs.
- The service validates Twilio signatures when enabled and rejects unsigned or invalid webhook requests.

## Local run

```bash
cp .env.example .env
node --env-file=.env src/server.js
```

## Testing

```bash
npm test
```

```bash
npm run test:live
```
