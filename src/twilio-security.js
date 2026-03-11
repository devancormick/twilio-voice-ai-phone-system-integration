import crypto from "node:crypto";

function toBase64Digest(value) {
  return crypto.createHmac("sha1", value.token).update(value.payload).digest("base64");
}

export function isTwilioRequestValid({ authToken, signature, url, formParams }) {
  if (!authToken) {
    return false;
  }

  const sortedPairs = Object.entries(formParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}${value}`)
    .join("");
  const expected = toBase64Digest({
    token: authToken,
    payload: `${url}${sortedPairs}`
  });

  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(signature || "");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
