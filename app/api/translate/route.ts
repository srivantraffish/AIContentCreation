import { NextResponse } from "next/server";
import { fetchToBuffer, pollResult, toBase64 } from "@/lib/lib/bfl";
import { extractAndTranslateAdText, type TranslationMapping } from "@/lib/lib/openai-translate";

export const runtime = "nodejs";

function getPngSize(buffer: Buffer) {
  if (buffer.length < 24) return null;
  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) return null;

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function isWebp(buffer: Buffer) {
  if (buffer.length < 12) return false;
  return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
}

function getJpegSize(buffer: Buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const blockLength = buffer.readUInt16BE(offset + 2);

    if (blockLength < 2) return null;

    const isStartOfFrame =
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf;

    if (isStartOfFrame) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }

    offset += 2 + blockLength;
  }

  return null;
}

function detectImageSize(buffer: Buffer) {
  return getPngSize(buffer) || getJpegSize(buffer);
}

function detectImageMimeType(buffer: Buffer, fallback?: string | null) {
  if (getPngSize(buffer)) return "image/png";
  if (getJpegSize(buffer)) return "image/jpeg";
  if (isWebp(buffer)) return "image/webp";
  if (fallback && fallback.startsWith("image/")) return fallback;
  return "image/png";
}

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

function buildPrompt(mappings: TranslationMapping[]) {
  const orderedMappings = mappings
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((mapping, index) => ({
      order: Number.isInteger(mapping.order) && mapping.order > 0 ? mapping.order : index + 1,
      source_text: mapping.source_text,
      translated_text: mapping.translated_text,
    }));

  if (!mappings.length) {
    return "No readable text was detected in the source image. Maintain all aspects of the original image exactly as-is.";
  }

  const translationJson = JSON.stringify(orderedMappings, null, 2);

  return `Edit this advertisement image.

translation_mapping:
${translationJson}

Rules:
- Replace only the mapped source_text entries with the exact translated_text values.
- Render translated_text exactly as written.
- Preserve font style, font weight, font size, color, spacing, alignment, line breaks, and text placement as closely as possible.
- Preserve all non-text content, including product, logo, branding, background, colors, lighting, shadows, textures, and composition.
- Do not add, remove, paraphrase, rewrite, or modify unmapped text.
- Use the order field as replacement priority when multiple mapped text elements are present.`;
}

export async function POST(req: Request) {
  const apiKey = process.env.BFL_TRANSLATE_API_KEY || process.env.BFL_API_KEY;
  const baseUrl = process.env.BFL_TRANSLATE_BASE_URL || process.env.BFL_BASE_URL || "https://api.bfl.ai";
  const modelPath = process.env.BFL_TRANSLATE_MODEL_PATH || "/v1/flux-2-flex";
  const rawGuidance = Number(process.env.BFL_TRANSLATE_GUIDANCE);
  const rawSteps = Number(process.env.BFL_TRANSLATE_STEPS);
  const guidance = Number.isFinite(rawGuidance) ? rawGuidance : 4.5;
  const steps = Number.isFinite(rawSteps) ? rawSteps : 40;

  if (!apiKey) return NextResponse.json({ error: "Missing BFL_API_KEY" }, { status: 500 });
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  const form = await req.formData();

  const languagesRaw = (form.get("languages") as string) || "";

  const baseFile = form.get("base") as File | null;
  const baseUrlInput = (form.get("base_url") as string | null) || "";

  if (!baseFile && !baseUrlInput) {
    return NextResponse.json({ error: "Base image is required" }, { status: 400 });
  }

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
  const imageSize = detectImageSize(baseBuf);
  const imageMimeType = detectImageMimeType(baseBuf, baseFile?.type);
  const width = imageSize?.width || 1024;
  const height = imageSize?.height || 1024;

  const results = await Promise.all(
    languages.map(async (language) => {
      let mappings: TranslationMapping[] = [];
      const payload: any = {
        input_image: inputImage,
        width,
        height,
        guidance,
        steps,
        output_format: "png",
        safety_tolerance: 2,
      };

      try {
        const translation = await extractAndTranslateAdText(inputImage, language, imageMimeType);
        mappings = translation.mappings;
        payload.prompt = buildPrompt(mappings);

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
          return { language: translation.language, mappings, error: `BFL create failed: ${createResp.status} ${txt}` };
        }

        const created = await createResp.json();
        const pollingUrl = created?.polling_url;

        if (!pollingUrl) return { language: translation.language, mappings, error: "No polling_url returned by BFL" };

        const sampleUrl = await pollResult(pollingUrl, apiKey);
        return { language: translation.language, mappings, sampleUrl };
      } catch (e: any) {
        return { language, mappings, error: e?.message || "Unexpected error" };
      }
    })
  );

  return NextResponse.json({ results }, { status: 200 });
}
