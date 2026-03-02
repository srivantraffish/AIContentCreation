// src/lib/sprinklr-auth.ts

const DEFAULT_ENV = "prod3";

// KV key where we store the rotating refresh token
const KV_REFRESH_TOKEN_KEY = "sprinklr:refresh_token";

async function getKvClient() {
  try {
    const mod = await import("@vercel/kv");
    return mod.kv;
  } catch {
    return null;
  }
}

function getTokenEndpoint() {
  const env = process.env.SPRINKLR_ENV || DEFAULT_ENV;
  return `https://api3.sprinklr.com/${env}/oauth/token`;
}

async function getStoredRefreshToken(): Promise<string> {
  // Prefer KV (latest rotated token)
  const kvClient = await getKvClient();
  if (kvClient) {
    const kvToken = await kvClient.get<string>(KV_REFRESH_TOKEN_KEY);
    if (kvToken && kvToken.trim()) return kvToken.trim();
  }

  // No env fallback on purpose: token rotation should be fully runtime-managed.
  return "";
}

async function setStoredRefreshToken(token: string) {
  const t = token.trim();
  if (!t) return;
  const kvClient = await getKvClient();
  if (!kvClient) return;
  await kvClient.set(KV_REFRESH_TOKEN_KEY, t);
}

export async function getSprinklrBearerToken(): Promise<string> {
  // If you ever want to bypass OAuth completely:
  const staticToken = process.env.SPRINKLR_BEARER_TOKEN;
  if (staticToken?.trim()) return staticToken.trim();

  const clientId =
    process.env.SPRINKLR_OAUTH_CLIENT_ID || process.env.SPRINKLR_API_KEY;
  const clientSecret =
    process.env.SPRINKLR_OAUTH_CLIENT_SECRET || process.env.SPRINKLR_API_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing Sprinklr OAuth config. Set SPRINKLR_OAUTH_CLIENT_ID + SPRINKLR_OAUTH_CLIENT_SECRET (or SPRINKLR_API_KEY + SPRINKLR_API_SECRET)."
    );
  }

  const refreshToken = await getStoredRefreshToken();

  // IMPORTANT: Sprinklr token endpoint expects x-www-form-urlencoded
  const body = new URLSearchParams({
    grant_type: refreshToken ? "refresh_token" : "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  if (refreshToken) {
    body.set("refresh_token", refreshToken);
  }

  const response = await fetch(getTokenEndpoint(), {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
  });

  const text = await response.text();

  if (!response.ok) {
    // If KV token became stale/invalid, retry once with client_credentials
    // so runtime can self-heal without redeploying env vars.
    if (refreshToken) {
      const fallbackBody = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
      });

      const fallbackResponse = await fetch(getTokenEndpoint(), {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: fallbackBody,
        cache: "no-store",
      });

      const fallbackText = await fallbackResponse.text();
      if (fallbackResponse.ok) {
        const fallbackData = JSON.parse(fallbackText);
        const fallbackAccessToken = String(fallbackData?.access_token || "").trim();
        const fallbackRefreshToken = String(fallbackData?.refresh_token || "").trim();

        if (!fallbackAccessToken) {
          throw new Error(
            `Sprinklr fallback token fetch did not return access_token. Body: ${fallbackText}`
          );
        }

        if (fallbackRefreshToken) {
          await setStoredRefreshToken(fallbackRefreshToken);
        }

        return fallbackAccessToken;
      }
    }

    // Show raw response body so you can see exactly what Sprinklr returns
    throw new Error(`Sprinklr token fetch failed: ${response.status}. ${text}`);
  }

  const data = JSON.parse(text);
  const accessToken = String(data?.access_token || "").trim();
  const nextRefreshToken = String(data?.refresh_token || "").trim();

  if (!accessToken) {
    throw new Error(`Sprinklr token fetch did not return access_token. Body: ${text}`);
  }

  // If Sprinklr rotates refresh tokens, persist the new one
  if (nextRefreshToken && nextRefreshToken !== refreshToken) {
    await setStoredRefreshToken(nextRefreshToken);
  }

  return accessToken;
}
