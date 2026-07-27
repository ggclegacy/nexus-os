const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function base64UrlEncode(bytes: Uint8Array) {
  return bytesToBase64(bytes)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return base64ToBytes(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
}

function encryptionKeyBytes() {
  const configured = process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY;
  if (!configured) {
    throw new Error(
      "Credential encryption is not configured. Set NEXUS_CREDENTIAL_ENCRYPTION_KEY.",
    );
  }
  const bytes = base64ToBytes(configured);
  if (bytes.byteLength !== 32) {
    throw new Error(
      "NEXUS_CREDENTIAL_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }
  return bytes;
}

export function googleCalendarConfiguration() {
  const required = [
    ["GOOGLE_CALENDAR_CLIENT_ID", process.env.GOOGLE_CALENDAR_CLIENT_ID],
    [
      "GOOGLE_CALENDAR_CLIENT_SECRET",
      process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    ],
    ["NEXUS_OAUTH_STATE_SECRET", process.env.NEXUS_OAUTH_STATE_SECRET],
    [
      "NEXUS_CREDENTIAL_ENCRYPTION_KEY",
      process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY,
    ],
  ] as const;
  const missing = required.filter(([, value]) => !value).map(([name]) => name);
  const invalid: string[] = [];
  if (
    process.env.NEXUS_OAUTH_STATE_SECRET &&
    process.env.NEXUS_OAUTH_STATE_SECRET.length < 32
  ) {
    invalid.push(
      "NEXUS_OAUTH_STATE_SECRET must contain at least 32 characters",
    );
  }
  if (process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY) {
    try {
      if (
        base64ToBytes(process.env.NEXUS_CREDENTIAL_ENCRYPTION_KEY)
          .byteLength !== 32
      ) {
        invalid.push(
          "NEXUS_CREDENTIAL_ENCRYPTION_KEY must decode to exactly 32 bytes",
        );
      }
    } catch {
      invalid.push(
        "NEXUS_CREDENTIAL_ENCRYPTION_KEY must be valid base64 for exactly 32 bytes",
      );
    }
  }
  const errors = [
    ...(missing.length
      ? [`Missing server configuration: ${missing.join(", ")}`]
      : []),
    ...invalid,
  ];
  return {
    configured: errors.length === 0,
    reasonUnavailable: errors.length ? `${errors.join(". ")}.` : null,
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET ?? "",
  };
}

export async function encryptSecret(value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes(),
    "AES-GCM",
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoder.encode(value),
    ),
  );
  return `v1.${base64UrlEncode(iv)}.${base64UrlEncode(ciphertext)}`;
}

export async function decryptSecret(value: string) {
  const [version, ivValue, ciphertextValue] = value.split(".");
  if (version !== "v1" || !ivValue || !ciphertextValue) {
    throw new Error("Stored credential format is invalid.");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes(),
    "AES-GCM",
    false,
    ["decrypt"],
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlDecode(ivValue) },
    key,
    base64UrlDecode(ciphertextValue),
  );
  return decoder.decode(plaintext);
}

export async function createOAuthState(input: {
  nonce: string;
  returnTo: string;
  expiresAt: number;
}) {
  const secret = process.env.NEXUS_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("OAuth state signing is not configured.");
  const payload = base64UrlEncode(encoder.encode(JSON.stringify(input)));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(payload)),
  );
  return `${payload}.${base64UrlEncode(signature)}`;
}

export async function verifyOAuthState(value: string) {
  const secret = process.env.NEXUS_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("OAuth state signing is not configured.");
  const [payload, signature] = value.split(".");
  if (!payload || !signature) throw new Error("OAuth state is invalid.");
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    encoder.encode(payload),
  );
  if (!valid) throw new Error("OAuth state could not be verified.");
  const decoded = JSON.parse(decoder.decode(base64UrlDecode(payload))) as {
    nonce: string;
    returnTo: string;
    expiresAt: number;
  };
  if (
    !decoded.nonce ||
    !decoded.returnTo.startsWith("/") ||
    decoded.returnTo.startsWith("//") ||
    decoded.expiresAt < Date.now()
  ) {
    throw new Error("OAuth state has expired or is invalid.");
  }
  return decoded;
}
