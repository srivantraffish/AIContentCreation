type TranslationMapping = {
  order: number;
  source_text: string;
  translated_text: string;
};

type TranslationResult = {
  language: string;
  mappings: TranslationMapping[];
};

const DEFAULT_MODEL = "gpt-4.1";

function buildPrompt(language: string) {
  return `You are an OCR-and-translation agent for advertisement localization.

Task:
Read the attached advertisement image, extract all visible user-facing text, and translate it into ${language}.

Requirements:
- Detect all visible readable ad text in the image.
- Return all text units for the image, not just the most prominent text.
- One response must include every extracted text segment for this language.
- Preserve the original meaning, tone, and marketing intent.
- Keep brand names, product names, trademarks, URLs, hashtags, coupon codes, phone numbers, email addresses, and legal identifiers unchanged unless the image clearly shows they should be translated.
- Keep numbers unchanged unless translation convention requires a script/localization change.
- If text appears across multiple lines, treat it as a single unit only when those lines clearly belong to one phrase or sentence. Otherwise return separate units.
- Do not summarize.
- Do not paraphrase.
- Do not omit small text if it is readable.
- Do not include any explanation outside the JSON.

Output format:
Return valid JSON only, with this exact schema:
{
  "language": "${language}",
  "mappings": [
    {
      "order": 1,
      "source_text": "string",
      "translated_text": "string"
    }
  ]
}

Rules for output:
- mappings must contain every readable visible text unit found in the image.
- Keep source_text exactly as seen in the image.
- Keep translated_text aligned to the same meaning as source_text.
- order must be a 1-based integer sequence.
- If the same source text appears multiple times, include separate entries only if translation could differ by context; otherwise one entry is acceptable.
- If no readable text is present, return:
  {
    "language": "${language}",
    "mappings": []
  }`;
}

function extractJson(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) return trimmed.slice(firstBrace, lastBrace + 1);

  throw new Error("OpenAI did not return JSON");
}

function normalizeMappingEntry(entry: unknown, index: number): TranslationMapping {
  if (!entry || typeof entry !== "object") {
    throw new Error(`OpenAI mapping at index ${index} is invalid`);
  }

  const record = entry as Record<string, unknown>;
  const sourceText = typeof record.source_text === "string" ? record.source_text.trim() : "";
  const translatedText = typeof record.translated_text === "string" ? record.translated_text.trim() : "";
  const rawOrder = typeof record.order === "number" ? record.order : index + 1;

  if (!sourceText) throw new Error(`OpenAI mapping at index ${index} is missing source_text`);
  if (!translatedText) throw new Error(`OpenAI mapping at index ${index} is missing translated_text`);
  if (!Number.isInteger(rawOrder) || rawOrder < 1) {
    throw new Error(`OpenAI mapping at index ${index} has an invalid order`);
  }

  return {
    order: rawOrder,
    source_text: sourceText,
    translated_text: translatedText,
  };
}

function normalizeMappings(input: unknown): TranslationMapping[] {
  if (Array.isArray(input)) {
    return input.map((entry, index) => normalizeMappingEntry(entry, index));
  }

  if (input && typeof input === "object") {
    return Object.entries(input as Record<string, unknown>).map(([sourceText, translatedText], index) => {
      const normalizedSource = sourceText.trim();
      if (!normalizedSource) throw new Error(`OpenAI object mapping at index ${index} has an empty source key`);
      if (typeof translatedText !== "string" || !translatedText.trim()) {
        throw new Error(`OpenAI object mapping for "${sourceText}" is invalid`);
      }

      return {
        order: index + 1,
        source_text: normalizedSource,
        translated_text: translatedText.trim(),
      };
    });
  }

  throw new Error("OpenAI response mappings must be an array or object");
}

function normalizeLanguage(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;

  const trimmed = value.trim();
  const lower = trimmed.toLowerCase();
  if (lower === fallback.toLowerCase()) return fallback;

  const aliases: Record<string, string> = {
    en: "English",
    es: "Spanish",
    fr: "French",
    de: "German",
    hi: "Hindi",
    pt: "Portuguese",
    ar: "Arabic",
    ja: "Japanese",
    ko: "Korean",
    zh: "Chinese (Simplified)",
    "zh-cn": "Chinese (Simplified)",
  };

  return aliases[lower] || trimmed;
}

export async function extractAndTranslateAdText(
  imageBase64: string,
  language: string,
  imageMimeType = "image/png"
): Promise<TranslationResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_TRANSLATE_MODEL || DEFAULT_MODEL;

  if (!apiKey) throw new Error("Missing OPENAI_API_KEY");

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "You are a precise OCR-and-translation engine that returns strict JSON only.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: buildPrompt(language) },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageMimeType};base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "translation_mappings",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["language", "mappings"],
            properties: {
              language: { type: "string" },
              mappings: {
                anyOf: [
                  {
                    type: "array",
                    items: {
                    type: "object",
                    additionalProperties: false,
                      required: ["order", "source_text", "translated_text"],
                      properties: {
                        order: { type: "integer", minimum: 1 },
                        source_text: { type: "string" },
                        translated_text: { type: "string" },
                      },
                    },
                  },
                  {
                    type: "object",
                    additionalProperties: {
                      type: "string",
                    },
                  },
                ],
              },
            },
          },
        },
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`OpenAI translation failed: ${resp.status} ${text}`);
  }

  const data = await resp.json();
  const content = data?.choices?.[0]?.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error("OpenAI response did not include JSON content");
  }

  const parsed = JSON.parse(extractJson(content)) as Record<string, unknown>;

  return {
    language: normalizeLanguage(parsed.language, language),
    mappings: normalizeMappings(parsed.mappings ?? []),
  };
}

export type { TranslationMapping, TranslationResult };
