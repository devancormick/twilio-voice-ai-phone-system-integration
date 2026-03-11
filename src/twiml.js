function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildVoiceResponse(verbs) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${verbs.join("")}</Response>`;
}

export function say(text, options = {}) {
  const attrs = [
    options.voice ? ` voice="${escapeXml(options.voice)}"` : "",
    options.language ? ` language="${escapeXml(options.language)}"` : ""
  ].join("");
  return `<Say${attrs}>${escapeXml(text)}</Say>`;
}

export function pause(length = 1) {
  return `<Pause length="${Number(length)}"/>`;
}

export function redirect(url, method = "POST") {
  return `<Redirect method="${escapeXml(method)}">${escapeXml(url)}</Redirect>`;
}

export function hangup() {
  return "<Hangup/>";
}

export function dial(number, options = {}) {
  const attrs = [
    options.callerId ? ` callerId="${escapeXml(options.callerId)}"` : "",
    options.timeout ? ` timeout="${Number(options.timeout)}"` : ""
  ].join("");
  return `<Dial${attrs}><Number>${escapeXml(number)}</Number></Dial>`;
}

export function play(url) {
  return `<Play>${escapeXml(url)}</Play>`;
}

export function gather(options = {}, body = "") {
  const attrs = [
    options.input ? ` input="${escapeXml(options.input)}"` : "",
    options.action ? ` action="${escapeXml(options.action)}"` : "",
    options.method ? ` method="${escapeXml(options.method)}"` : "",
    options.speechTimeout ? ` speechTimeout="${escapeXml(options.speechTimeout)}"` : "",
    options.timeout ? ` timeout="${Number(options.timeout)}"` : "",
    options.language ? ` language="${escapeXml(options.language)}"` : "",
    options.hints ? ` hints="${escapeXml(options.hints)}"` : "",
    options.actionOnEmptyResult ? ` actionOnEmptyResult="${escapeXml(options.actionOnEmptyResult)}"` : ""
  ].join("");
  return `<Gather${attrs}>${body}</Gather>`;
}
