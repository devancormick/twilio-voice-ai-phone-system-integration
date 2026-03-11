export async function readRequestBody(request, maxBytes = 1024 * 32) {
  const chunks = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > maxBytes) {
      throw new Error(`Request body exceeded limit of ${maxBytes} bytes`);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function parseFormBody(body) {
  const params = new URLSearchParams(body);
  return Object.fromEntries(params.entries());
}

export function sendXml(response, statusCode, xml) {
  response.writeHead(statusCode, {
    "Content-Type": "text/xml; charset=utf-8",
    "Content-Length": Buffer.byteLength(xml)
  });
  response.end(xml);
}

export function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}

export function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "Content-Type": "text/plain; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  response.end(body);
}
