# Twilio Voice AI Phone System Integration

Small-business Twilio Programmable Voice integration for a Claude-powered property management phone assistant.

## Features

- Inbound Twilio voice webhook for the main business line
- Claude-based caller intent classification
- Live transfer routing for emergency maintenance calls
- Live transfer routing for property management inquiries
- Monday through Friday, 9:00 AM to 4:00 PM business-hours handling
- After-hours messaging and escalation path
- Minimal Node.js runtime with no external package dependencies

## Configuration

Copy `.env.example` into `.env` and provide the real values:

- `BASE_URL`: public HTTPS base URL Twilio will call
- `ANTHROPIC_API_KEY`: API key for Claude
- `EMERGENCY_TRANSFER_NUMBER`: destination for emergency maintenance
- `PROPERTY_TRANSFER_NUMBER`: destination for property management inquiries
- `BUSINESS_TIMEZONE`: timezone used to evaluate business hours
- `BUSINESS_HOURS_START` and `BUSINESS_HOURS_END`: default `09:00` and `16:00`

## Endpoints

- `GET /health`
- `POST /voice/incoming`
- `POST /voice/respond`

## Twilio setup

Point the Twilio voice webhook for the business phone number at:

`POST https://your-domain.example/voice/incoming`

The app responds with TwiML. It gathers speech from the caller, sends the transcript to Claude for routing, then either:

- responds directly with an AI-generated answer
- transfers to the emergency maintenance number
- transfers to the property management number

## Local run

```bash
cp .env.example .env
node --env-file=.env src/server.js
```

## Testing

```bash
npm test
```
