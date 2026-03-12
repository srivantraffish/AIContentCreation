import { promises as fs } from "fs";
import path from "path";

const DEFAULT_ENV = "prod3";
const ENV_LOCAL_PATH = path.join(process.cwd(), ".env.local");

function getTokenEndpoint() {
  const env = (process.env.SPRINKLR_ENV || DEFAULT_ENV).trim();
  return `https://api3.sprinklr.com/${env}/oauth/token`;
}

function parseDotEnv(content: string) {
  const entries: Record<string, string> = {};

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    const rawValue = trimmed.slice(eqIndex + 1).trim();

    // strip wrapping quotes
    entries[key] = rawValue.replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }

  return entries;
}

async function readEnvLocal() {
  try {
    const raw = await fs.readFile(ENV_LOCAL_PATH, "utf8");
    return { raw, values: parseDotEnv(raw) };
  } catch {
    return { raw: "", values: {} as Record<string, string> };
  }
}

function toEnvLine(key: string, value: string) {
  // Quote if spaces or special chars likely
  const needsQuotes = /[\s#]/.test(value);
  return `${key}=${needsQuotes ? JSON.stringify(value) : value}`;
}

async function setEnvLocalValue(key: string, value: string) {
  const { values } = await readEnvLocal();

  // Overwrite or add
  values[key] = value;

  // Rebuild entire file cleanly
  const newContent =
    Object.entries(values)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n";

  await fs.writeFile(ENV_LOCAL_PATH, newContent, "utf8");

  console.log(`Updated ${key} in .env.local`);
}

async function getRefreshToken() {
  // IMPORTANT:
  // process.env does NOT update after you write to .env.local (especially in dev server),
  // so always read from file first.
  const { values } = await readEnvLocal();
  return (values.SPRINKLR_REFRESH_TOKEN || "").trim();
}

function getClientCreds() {
  const clientId =
    process.env.SPRINKLR_OAUTH_CLIENT_ID?.trim() ||
    process.env.SPRINKLR_API_KEY?.trim() ||
    "";

  const clientSecret =
    process.env.SPRINKLR_OAUTH_CLIENT_SECRET?.trim() ||
    process.env.SPRINKLR_API_SECRET?.trim() ||
    "";

  return { clientId, clientSecret };
}

/**
 * Call Sprinklr token endpoint and (if returned) overwrite .env.local with the new refresh_token.
 * Returns: { accessToken, refreshToken? }
 */
export async function refreshSprinklrTokens() {
  // Allow a fully static token override (no oauth calls)
  const staticToken = process.env.SPRINKLR_BEARER_TOKEN?.trim();
  if (staticToken) {
    return { accessToken: staticToken, refreshToken: "" };
  }

  const { clientId, clientSecret } = getClientCreds();
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Sprinklr OAuth creds. Set SPRINKLR_OAUTH_CLIENT_ID/SPRINKLR_OAUTH_CLIENT_SECRET (or SPRINKLR_API_KEY/SPRINKLR_API_SECRET)."
    );
  }

  const refreshToken = await getRefreshToken();

  const body = new URLSearchParams({
    grant_type: refreshToken ? "refresh_token" : "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  if (refreshToken) body.set("refresh_token", refreshToken);

  const response = await fetch(getTokenEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Sprinklr token fetch failed: ${response.status}. ${details}`);
  }

  const data = await response.json();

  const accessToken = String(data?.access_token || "").trim();
  const nextRefreshToken = String(data?.refresh_token || "").trim();

  if (!accessToken) {
    throw new Error("Sprinklr token fetch did not return access_token");
  }

  // This is the key change: ALWAYS overwrite .env.local when refresh_token is returned
  if (nextRefreshToken) {
    await setEnvLocalValue("SPRINKLR_REFRESH_TOKEN", nextRefreshToken);
  }

  return { accessToken, refreshToken: nextRefreshToken };
}

/**
 * Convenience: return just the Bearer token string for API calls.
 * This will automatically refresh + overwrite .env.local if needed.
 */
export async function getSprinklrBearerToken() {
  const { accessToken } = await refreshSprinklrTokens();
  return accessToken;
}