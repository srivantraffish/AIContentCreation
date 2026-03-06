import { NextResponse } from "next/server";
import { fetchToBuffer, pollResult, toBase64 } from "@/lib/lib/bfl";

export const runtime = "nodejs";

function normalizeLanguages(input: string[]): string[] {
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const lang of input) {
    const trimmed = lang.trim().replace(/\s+/g, " ");
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(trimmed);
  }
  return deduped;
}

function buildPrompt(template: string, language: string) {
  if (template.includes("{{TARGET_LANGUAGE}}")) {
    return template.split("{{TARGET_LANGUAGE}}").join(language);
  }
  return `${template.trim()}\n\nTranslate to ${language}.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.BFL_TRANSLATE_API_KEY || process.env.BFL_API_KEY;
  const baseUrl = process.env.BFL_TRANSLATE_BASE_URL || process.env.BFL_BASE_URL || "https://api.us2.bfl.ai";
  const modelPath = process.env.BFL_TRANSLATE_MODEL_PATH || process.env.BFL_MODEL_PATH || "/v1/flux-2-pro";

  if (!apiKey) return NextResponse.json({ error: "Missing BFL_API_KEY" }, { status: 500 });

  const form = await req.formData();

  const promptTemplate = (form.get("prompt") as string) || "";
  const width = Number(form.get("width") || 1024);
  const height = Number(form.get("height") || 1024);
  const languagesRaw = (form.get("languages") as string) || "";

  const baseFile = form.get("base") as File | null;
  const baseUrlInput = (form.get("base_url") as string | null) || "";

  if (!baseFile && !baseUrlInput) {
    return NextResponse.json({ error: "Base image is required" }, { status: 400 });
  }
  if (!promptTemplate.trim()) return NextResponse.json({ error: "Prompt is required" }, { status: 400 });

  let parsedLanguages: string[] = [];
  try {
    const asJson = JSON.parse(languagesRaw);
    if (Array.isArray(asJson)) parsedLanguages = asJson.map(String);
  } catch {
    parsedLanguages = languagesRaw.split(",").map((value) => value.trim());
  }

  const languages = normalizeLanguages(parsedLanguages);
  if (!languages.length) return NextResponse.json({ error: "At least one language is required" }, { status: 400 });

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

  const inputImage = toBase64(baseBuf);

  const results = await Promise.all(
    languages.map(async (language) => {
      const payload: any = {
        prompt: buildPrompt(promptTemplate, language),
        input_image: inputImage,
        width,
        height,
        output_format: "png",
        safety_tolerance: 2,
      };

      try {
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
          return { language, error: `BFL create failed: ${createResp.status} ${txt}` };
        }

        const created = await createResp.json();
        const pollingUrl = created?.polling_url;

        if (!pollingUrl) return { language, error: "No polling_url returned by BFL" };

        const sampleUrl = await pollResult(pollingUrl, apiKey);
        return { language, sampleUrl };
      } catch (e: any) {
        return { language, error: e?.message || "Unexpected error" };
      }
    })
  );

  return NextResponse.json({ results }, { status: 200 });
}
