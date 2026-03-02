const DEFAULT_ENV = "prod3";
const TOKEN_REFRESH_BUFFER_MS = 60_000;
//
type CachedToken = {
  value: string;
  expiresAt: number;
};

let cachedToken: CachedToken | null = null;

function getTokenEndpoint() {
  const env = process.env.SPRINKLR_ENV || DEFAULT_ENV;
  return `https://api3.sprinklr.com/${env}/oauth/token`;
}

function getCachedToken() {
  if (!cachedToken) return null;
  if (Date.now() >= cachedToken.expiresAt) {
    cachedToken = null;
    return null;
  }
  return cachedToken.value;
}

export async function getSprinklrBearerToken() {
  const staticToken = process.env.SPRINKLR_BEARER_TOKEN;
  if (staticToken) return staticToken;

  const validCachedToken = getCachedToken();
  if (validCachedToken) return validCachedToken;

  const clientId = process.env.SPRINKLR_API_KEY;
  const clientSecret = process.env.SPRINKLR_API_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Sprinklr auth config. Set SPRINKLR_BEARER_TOKEN or (SPRINKLR_API_KEY + SPRINKLR_API_SECRET).");
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

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
  const expiresInSeconds = Number(data?.expires_in || 3600);

  if (!accessToken) {
    throw new Error("Sprinklr token fetch did not return access_token");
  }

  const expiresAt = Date.now() + Math.max(0, expiresInSeconds * 1000 - TOKEN_REFRESH_BUFFER_MS);
  cachedToken = { value: accessToken, expiresAt };

  return accessToken;
}