import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SPRINKLR_ENDPOINT = "https://api3.sprinklr.com/prod3/api/v1/sam/search";
const CLIENT_ID = "2001048";

function cleanUrl(url?: string) {
  if (!url) return null;
  return url.replace(/%22$/g, "");
}

export async function POST(req: Request) {
  const token = process.env.SPRINKLR_BEARER_TOKEN;
  const apiKey = process.env.SPRINKLR_API_KEY;

  if (!token || !apiKey) {
    return NextResponse.json({ error: "Missing Sprinklr credentials" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const keyword = String(body?.keyword || "").trim();

  if (!keyword) return NextResponse.json({ error: "Keyword is required" }, { status: 400 });

  const payload = {
    filters: { ASSET_TYPE: ["PHOTO"], CLIENTS: [CLIENT_ID] },
    sortList: [{ order: "DESC", key: "createdTime" }],
    keywordSearch: keyword,
    rangeCondition: { start: 0, fieldName: "createdTime", end: 2208988800000 },
    onlyAvailable: false,
    start: 0,
    rows: 50,
  };

  const r = await fetch(SPRINKLR_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Key: apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!r.ok) {
    const txt = await r.text();
    return NextResponse.json({ error: `Sprinklr search failed: ${r.status}`, details: txt }, { status: 500 });
  }

  const data = await r.json();
  const assets = Array.isArray(data?.socialMediaAssets) ? data.socialMediaAssets : [];

  const mapped = assets
    .map((asset: any) => {
      const mediaUrl = cleanUrl(asset?.digitalAsset?.mediaUrl);
      const previewUrl = cleanUrl(asset?.digitalAsset?.previewUrl);
      return {
        id: String(asset?.id || ""),
        name: String(asset?.name || ""),
        mediaUrl,
        previewUrl,
      };
    })
    .filter((a: any) => a.id && a.mediaUrl);

  return NextResponse.json({ assets: mapped }, { status: 200 });
}
