import { NextResponse } from "next/server";

export const runtime = "nodejs";

function toBase64(buffer: Buffer) {
  return buffer.toString("base64");
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
  const refFile = form.get("reference") as File | null;
  const logoFile = form.get("logo") as File | null;

  if (!baseFile) return NextResponse.json({ error: "Base image is required" }, { status: 400 });
  if (!prompt.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  const baseBuf = Buffer.from(await baseFile.arrayBuffer());

  const payload: any = {
    prompt,
    input_image: toBase64(baseBuf),
    width,
    height,
    output_format: "png",
    safety_tolerance: 2,
  };

  if (refFile) {
    const refBuf = Buffer.from(await refFile.arrayBuffer());
    payload.input_image_2 = toBase64(refBuf);
  }

  if (logoFile) {
    const logoBuf = Buffer.from(await logoFile.arrayBuffer());
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
