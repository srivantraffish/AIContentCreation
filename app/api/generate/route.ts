import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toBase64(buffer: Buffer) {
  return buffer.toString("base64");
}

async function fetchToBuffer(url: string) {
  const cleanedUrl = url.replace(/%22$/g, "");
  const imgResp = await fetch(cleanedUrl);
  if (!imgResp.ok) {
    const txt = await imgResp.text();
    throw new Error(`Failed to fetch image: ${imgResp.status} ${txt}`);
  }
  const arrayBuf = await imgResp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

async function pollResult(pollingUrl: string, apiKey: string, timeoutMs = 120_000) {
  const start = Date.now();

  while (true) {
    if (Date.now() - start > timeoutMs) throw new Error("Timed out waiting for BFL result");

    const r = await fetch(pollingUrl, {
      method: "GET",
      headers: { accept: "application/json", "x-key": apiKey },
      cache: "no-store",
    });

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`Polling failed: ${r.status} ${txt}`);
    }

    const data = await r.json();

    if (data?.status === "Ready" && data?.result?.sample) return data.result.sample as string;
    if (data?.status === "Task not found") throw new Error("Task not found (expired/wrong host). Re-run generation.");

    await new Promise((res) => setTimeout(res, 1200));
  }
}

export async function POST(req: Request) {
  const apiKey = process.env.BFL_API_KEY;
  const baseUrl = process.env.BFL_BASE_URL || "https://api.us2.bfl.ai";
  const modelPath = process.env.BFL_MODEL_PATH || "/v1/flux-2-pro";

  if (!apiKey) return NextResponse.json({ error: "Missing BFL_API_KEY" }, { status: 500 });

  const form = await req.formData();

  const prompt = (form.get("prompt") as string) || "";
  const width = Number(form.get("width") || 1024);
  const height = Number(form.get("height") || 1024);

  const baseFile = form.get("base") as File | null;
  const baseUrlInput = (form.get("base_url") as string | null) || "";
  const refFile = form.get("reference") as File | null;
  const refUrlInput = (form.get("reference_url") as string | null) || "";
  const logoFile = form.get("logo") as File | null;
  const logoUrlInput = (form.get("logo_url") as string | null) || "";

  if (!baseFile && !baseUrlInput) {
    return NextResponse.json({ error: "Base image is required" }, { status: 400 });
  }
  if (!prompt.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  let baseBuf: Buffer;
  if (baseFile) {
    baseBuf = Buffer.from(await baseFile.arrayBuffer());
  } else {
    try {
      baseBuf = await fetchToBuffer(baseUrlInput);
    } catch (e: any) {
      return NextResponse.json(
        { error: "Failed to fetch base image", details: e?.message || "Unknown error" },
        { status: 500 }
      );
    }
  }

  const payload: any = {
    prompt,
    input_image: toBase64(baseBuf),
    width,
    height,
    output_format: "png",
    safety_tolerance: 2,
  };

  let refBuf: Buffer | null = null;
  if (refFile) refBuf = Buffer.from(await refFile.arrayBuffer());
  else if (refUrlInput) {
    try {
      refBuf = await fetchToBuffer(refUrlInput);
    } catch (e: any) {
      return NextResponse.json(
        { error: "Failed to fetch reference image", details: e?.message || "Unknown error" },
        { status: 500 }
      );
    }
  }

  let logoBuf: Buffer | null = null;
  if (logoFile) logoBuf = Buffer.from(await logoFile.arrayBuffer());
  else if (logoUrlInput) {
    try {
      logoBuf = await fetchToBuffer(logoUrlInput);
    } catch (e: any) {
      return NextResponse.json(
        { error: "Failed to fetch logo image", details: e?.message || "Unknown error" },
        { status: 500 }
      );
    }
  }

  if (refBuf) payload.input_image_2 = toBase64(refBuf);
  if (logoBuf) {
    if (payload.input_image_2) payload.input_image_3 = toBase64(logoBuf);
    else payload.input_image_2 = toBase64(logoBuf);
  }

  const createResp = await fetch(`${baseUrl}${modelPath}`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-key": apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!createResp.ok) {
    const txt = await createResp.text();
    return NextResponse.json({ error: `BFL create failed: ${createResp.status}`, details: txt }, { status: 500 });
  }

  const created = await createResp.json();
  const pollingUrl = created?.polling_url;

  if (!pollingUrl) return NextResponse.json({ error: "No polling_url returned by BFL", created }, { status: 500 });

  const sampleUrl = await pollResult(pollingUrl, apiKey);
  return NextResponse.json({ sampleUrl, id: created?.id }, { status: 200 });
}
