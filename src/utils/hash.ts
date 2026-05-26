import crypto from "crypto";

export function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function normalizeContent(input: string) {
  return input.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");
}

export function contentHash(input: string) {
  return sha256(normalizeContent(input));
}
