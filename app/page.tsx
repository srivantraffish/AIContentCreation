"use client";
import { useEffect, useMemo, useState } from "react";

const INDUSTRIES = [
  "Beauty / Skincare",
  "Tech",
  "Food & Beverage",
  "Fitness",
  "Luxury",
  "Fashion",
  "Custom",
] as const;

const DEFAULT_INDUSTRY_VISUAL_STYLE =
  "Professional commercial studio environment, clean modern aesthetic, soft controlled lighting, realistic shadows and reflections, minimal but intentional background styling, premium advertising photography, subtle depth, balanced composition, distraction-free environment.";

const INDUSTRY_VISUAL_STYLE: Record<(typeof INDUSTRIES)[number], string> = {
  "Beauty / Skincare":
    "Soft diffused lighting, smooth gradients, elegant minimal styling, clean surfaces, refined textures, subtle glow, premium lifestyle environment.",
  Tech: "Minimal modern setting, clean surfaces, cool tones, subtle reflections, futuristic lighting accents, sleek environment.",
  "Food & Beverage":
    "Appetizing lighting, rich textures, shallow depth of field, warm tones, freshness cues, natural ingredients styling.",
  Fitness: "Dynamic lighting, high contrast, energetic framing, bold shadows, action-oriented atmosphere.",
  Luxury:
    "Dramatic lighting, deep shadows, rich materials like marble or metal, cinematic elegance, dark premium environment.",
  Fashion:
    "Editorial lighting, confident composition, modern aesthetic, premium studio or lifestyle setting.",
  Custom: DEFAULT_INDUSTRY_VISUAL_STYLE,
};

const MARKETING_OBJECTIVES = [
  "Launch",
  "Discount/Offer",
  "Premium Positioning",
  "Lifestyle Branding",
  "Awareness",
  "Custom objective…",
] as const;

const LAYOUT_MODES = ["1:1", "4:5", "9:16", "16:9", "1.91:1"] as const;

const DEFAULT_TONE = "premium, clean, contemporary";

const OBJECTIVE_TRANSLATIONS: Record<string, string> = {
  Launch: "Launch → dramatic lighting consistent with reference lighting logic.",
  "Discount/Offer": "Discount/Offer → contrast adjustments while preserving original layout structure.",
  "Premium Positioning": "Premium positioning → refined lighting without altering composition.",
  "Lifestyle Branding": "Lifestyle branding → contextual realism while maintaining structural alignment.",
  Awareness: "Awareness → emotional tone layered onto the same visual framework.",
};

function buildPrompt(params: {
  marketingObjective: string;
  industry: (typeof INDUSTRIES)[number];
  brandDescription?: string;
  tone?: string;
  layoutMode: (typeof LAYOUT_MODES)[number];
  brandPrimaryHex?: string;
  brandAccentHex?: string;
}) {
  const brandDescription =
    params.brandDescription?.trim() ||
    `modern, credible brand in the ${params.industry} space`;

  const tone = params.tone?.trim() || DEFAULT_TONE;
  const primaryHex = params.brandPrimaryHex?.trim() || "";
  const accentHex = params.brandAccentHex?.trim() || "";

  const objectiveTranslation =
    OBJECTIVE_TRANSLATIONS[params.marketingObjective] ||
    `Apply objective-driven visual translation aligned with "${params.marketingObjective}".`;

  // (kept for future use if you want to inject this line somewhere)
  void objectiveTranslation;

  const industryVisualStyle =
    INDUSTRY_VISUAL_STYLE[params.industry] || DEFAULT_INDUSTRY_VISUAL_STYLE;

  return `Use the provided reference image as the PRIMARY structural blueprint.

The generated image must closely replicate the reference image's:

- Camera angle
- Perspective
- Framing
- Subject placement
- Spatial proportions
- Depth of field
- Lighting direction
- Shadow behavior
- Background structure
- Overall composition geometry

Maintain near-identical compositional ratios and layout balance.

Recreate the same scene structure shown in the reference image, replacing only the subject.

Do not alter the core layout logic.

--------------------------------------------------

Now replace the original subject with the EXACT product from the provided product image.

The product must remain unchanged:
- Preserve original shape, proportions, materials, label design, and structure.
- Do not redesign, stylize, reinterpret, enhance, or duplicate the product.
- Only one primary product unless naturally part of packaging.

The product must occupy the same compositional role, scale, and visual emphasis as the subject in the reference image.

--------------------------------------------------

Marketing Objective: {{MARKETING_OBJECTIVE}}

Visually communicate this objective through lighting intensity, atmosphere, and styling — WITHOUT altering the structural composition derived from the reference image.

--------------------------------------------------

Industry: {{INDUSTRY}}

Brand Description (optional): {{BRAND_DESCRIPTION}}

Tone (optional): {{TONE_OR_DEFAULT_PREMIUM}}

--------------------------------------------------

Industry Visual Direction:
${industryVisualStyle}

Ensure styling, materials, and environment details reflect the industry while respecting the reference composition.

Do not allow industry styling to override layout structure.

--------------------------------------------------

Layout Format:
{{LAYOUT_MODE}} (e.g., 1:1, 4:5, 16:9)

Maintain safe margins for digital advertising placement.

--------------------------------------------------

Logo Integration:

Integrate the provided logo naturally within the structural constraints of the reference layout.

Logo must align with scene lighting, surface geometry, and perspective.
Avoid floating or pasted appearance.

--------------------------------------------------

Color & Finish:

If provided, use brand colors subtly:
Primary: {{BRAND_PRIMARY_HEX}}
Accent: {{BRAND_ACCENT_HEX}}

Match the reference image's:
- Color temperature
- Contrast profile
- Exposure balance
- Highlight rolloff
- Shadow density

Professional commercial color grading aligned with {{TONE_OR_DEFAULT_PREMIUM}}.

--------------------------------------------------

Final Output Requirements:

Ultra-realistic
High resolution
Structurally aligned with reference image
Accurate product representation
Premium commercial photography quality
Clean composition
Natural shadows and reflections
Suitable for paid digital advertising`;
}

export default function Page() {
  const [industry, setIndustry] = useState<(typeof INDUSTRIES)[number]>(
    INDUSTRIES[0]
  );
  const [marketingObjectivePreset, setMarketingObjectivePreset] = useState<
    string
  >(MARKETING_OBJECTIVES[0]);
  const [marketingObjectiveCustom, setMarketingObjectiveCustom] =
    useState<string>("");
  const [brandDescription, setBrandDescription] = useState<string>("");
  const [tone, setTone] = useState<string>(DEFAULT_TONE);
  const [layoutMode, setLayoutMode] = useState<(typeof LAYOUT_MODES)[number]>(
    LAYOUT_MODES[0]
  );
  const [brandPrimaryHex, setBrandPrimaryHex] = useState<string>("#000000");
  const [brandAccentHex, setBrandAccentHex] = useState<string>("#ffffff");
  const [promptEdited, setPromptEdited] = useState(false);

  const [baseMode, setBaseMode] = useState<"upload" | "search">("upload");
  const [base, setBase] = useState<File | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [referenceMode, setReferenceMode] = useState<"upload" | "search">(
    "upload"
  );
  const [reference, setReference] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [logoMode, setLogoMode] = useState<"upload" | "search">("upload");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // NEW: optional custom industry name shown only when "Custom" is selected
  const [industryCustom, setIndustryCustom] = useState<string>("");

  const effectiveMarketingObjective = useMemo(() => {
    if (marketingObjectivePreset === "Custom objective…") {
      return marketingObjectiveCustom.trim() || "Custom objective";
    }
    return marketingObjectivePreset;
  }, [marketingObjectiveCustom, marketingObjectivePreset]);

  const generatedPrompt = useMemo(
    () =>
      buildPrompt({
        marketingObjective: effectiveMarketingObjective,
        industry,
        brandDescription:
          industry === "Custom" && industryCustom.trim()
            ? `${brandDescription}`.trim() ||
              `modern, credible brand in the ${industryCustom.trim()} space`
            : brandDescription,
        tone,
        layoutMode,
        brandPrimaryHex,
        brandAccentHex,
      }),
    [
      brandAccentHex,
      brandDescription,
      brandPrimaryHex,
      effectiveMarketingObjective,
      industry,
      industryCustom,
      layoutMode,
      tone,
    ]
  );

  const [prompt, setPrompt] = useState(generatedPrompt);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);

  const [loading, setLoading] = useState(false);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [baseKeyword, setBaseKeyword] = useState("logo.png");
  const [baseSearching, setBaseSearching] = useState(false);
  const [baseResults, setBaseResults] = useState<
    Array<{ id: string; name: string; mediaUrl: string; previewUrl?: string }>
  >([]);
  const [referenceKeyword, setReferenceKeyword] = useState("logo.png");
  const [referenceSearching, setReferenceSearching] = useState(false);
  const [referenceResults, setReferenceResults] = useState<
    Array<{ id: string; name: string; mediaUrl: string; previewUrl?: string }>
  >([]);
  const [logoKeyword, setLogoKeyword] = useState("logo.png");
  const [logoSearching, setLogoSearching] = useState(false);
  const [logoResults, setLogoResults] = useState<
    Array<{ id: string; name: string; mediaUrl: string; previewUrl?: string }>
  >([]);

  useEffect(() => {
    if (!promptEdited) setPrompt(generatedPrompt);
  }, [generatedPrompt, promptEdited]);

  async function runSearch(
    kind: "base" | "reference" | "logo",
    keyword: string,
    setSearching: (v: boolean) => void,
    setResults: (
      v: Array<{ id: string; name: string; mediaUrl: string; previewUrl?: string }>
    ) => void,
    setSelectedUrl: (v: string | null) => void
  ) {
    setError(null);
    setResults([]);
    setSelectedUrl(null);
    if (!keyword.trim()) return setError(`Enter a keyword to search for ${kind}.`);

    setSearching(true);
    try {
      const r = await fetch("/api/sprinklr-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      const data = await r.json();
      if (!r.ok) setError(data?.error || "Search failed");
      else setResults(data?.assets || []);
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setSearching(false);
    }
  }

  async function generate() {
    setError(null);
    setSampleUrl(null);
    setUploadResult(null);
    setUploadError(null);

    if (baseMode === "upload") {
      if (!base) return setError("Please upload a base product image.");
    } else {
      if (!baseUrl) return setError("Please select a base image from search.");
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("prompt", prompt);
      fd.append("width", String(width));
      fd.append("height", String(height));
      if (baseMode === "upload") fd.append("base", base as File);
      else fd.append("base_url", baseUrl as string);
      if (referenceMode === "upload" && reference) fd.append("reference", reference);
      if (referenceMode === "search" && referenceUrl) fd.append("reference_url", referenceUrl);
      if (logoMode === "upload" && logo) fd.append("logo", logo);
      if (logoMode === "search" && logoUrl) fd.append("logo_url", logoUrl);

      const r = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await r.json();

      if (!r.ok) setError(data?.error || "Generation failed");
      else {
        setSampleUrl(data.sampleUrl);
        if (data?.sampleUrl) {
          setUploading(true);
          try {
            const up = await fetch("/api/image-upload", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ imageUrl: data.sampleUrl, name: "Generated Image", description: "Generated by BFL" }),
            });
            const upData = await up.json();
            if (!up.ok) setUploadError(upData?.error || "Upload failed");
            else setUploadResult(upData);
          } catch (e: any) {
            setUploadError(e?.message || "Unexpected upload error");
          } finally {
            setUploading(false);
          }
        }
      }
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  async function uploadToSprinklr() {
    if (!sampleUrl) return;
    setUploadError(null);
    setUploadResult(null);
    setUploading(true);
    try {
      const up = await fetch("/api/image-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          imageUrl: sampleUrl,
          name: "Generated Image",
          description: "Generated by BFL",
        }),
      });
      const upData = await up.json();
      if (!up.ok) setUploadError(upData?.error || "Upload failed");
      else setUploadResult(upData);
    } catch (e: any) {
      setUploadError(e?.message || "Unexpected upload error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <main
      style={{
        maxWidth: 920,
        margin: "40px auto",
        padding: 16,
        fontFamily: "system-ui",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>BFL Image Generator</h1>
      <div style={{ color: "#555", marginBottom: 16 }}>
        Upload a base product image or search Sprinklr, plus optional reference and
        logo. Paste your prompt and generate.
      </div>

      {uploading && (
        <div style={{ marginBottom: 10, color: "#444" }}>
          Uploading generated image to Sprinklr...
        </div>
      )}
      {uploadError && (
        <div style={{ marginBottom: 10, color: "#b00020" }}>{uploadError}</div>
      )}
      {uploadResult && (
        <div style={{ marginBottom: 10, color: "#0a7a2a" }}>
          Uploaded to Sprinklr. Content ID:{" "}
          {String(uploadResult?.uploadedContentId || "")}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
        <div style={{ fontWeight: 700 }}>Base image source</div>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="base-mode"
            checked={baseMode === "upload"}
            onChange={() => {
              setBaseMode("upload");
              setBaseUrl(null);
            }}
          />
          Upload
        </label>
        <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input
            type="radio"
            name="base-mode"
            checked={baseMode === "search"}
            onChange={() => {
              setBaseMode("search");
              setBase(null);
            }}
          />
          Search Sprinklr
        </label>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <div>
          <div style={{ fontWeight: 700 }}>Base product image *</div>
          {baseMode === "upload" ? (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setBase(e.target.files?.[0] || null)}
            />
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="text"
                placeholder="keyword e.g. logo.png"
                value={baseKeyword}
                onChange={(e) => setBaseKeyword(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => runSearch("base", baseKeyword, setBaseSearching, setBaseResults, setBaseUrl)}
                disabled={baseSearching}
                style={{ padding: "6px 10px" }}
              >
                {baseSearching ? "Searching..." : "Search"}
              </button>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>Style reference (optional)</div>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="reference-mode"
                checked={referenceMode === "upload"}
                onChange={() => {
                  setReferenceMode("upload");
                  setReferenceUrl(null);
                }}
              />
              Upload
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="reference-mode"
                checked={referenceMode === "search"}
                onChange={() => {
                  setReferenceMode("search");
                  setReference(null);
                }}
              />
              Search
            </label>
          </div>

          {referenceMode === "upload" ? (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setReference(e.target.files?.[0] || null)}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                type="text"
                placeholder="keyword e.g. logo.png"
                value={referenceKeyword}
                onChange={(e) => setReferenceKeyword(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                onClick={() =>
                  runSearch("reference", referenceKeyword, setReferenceSearching, setReferenceResults, setReferenceUrl)
                }
                disabled={referenceSearching}
                style={{ padding: "6px 10px" }}
              >
                {referenceSearching ? "Searching..." : "Search"}
              </button>
            </div>
          )}
        </div>

        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div style={{ fontWeight: 700 }}>Logo (optional)</div>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="logo-mode"
                checked={logoMode === "upload"}
                onChange={() => {
                  setLogoMode("upload");
                  setLogoUrl(null);
                }}
              />
              Upload
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="radio"
                name="logo-mode"
                checked={logoMode === "search"}
                onChange={() => {
                  setLogoMode("search");
                  setLogo(null);
                }}
              />
              Search
            </label>
          </div>

          {logoMode === "upload" ? (
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setLogo(e.target.files?.[0] || null)}
            />
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <input
                type="text"
                placeholder="keyword e.g. logo.png"
                value={logoKeyword}
                onChange={(e) => setLogoKeyword(e.target.value)}
                style={{ flex: 1 }}
              />
              <button
                onClick={() => runSearch("logo", logoKeyword, setLogoSearching, setLogoResults, setLogoUrl)}
                disabled={logoSearching}
                style={{ padding: "6px 10px" }}
              >
                {logoSearching ? "Searching..." : "Search"}
              </button>
            </div>
          )}
        </div>
      </div>

      {baseMode === "search" && baseResults.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Search results</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
            {baseResults.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setBaseUrl(asset.mediaUrl)}
                style={{
                  border: baseUrl === asset.mediaUrl ? "2px solid #111" : "1px solid #ddd",
                  padding: 6,
                  cursor: "pointer",
                  background: "white",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.previewUrl || asset.mediaUrl}
                  alt={asset.name}
                  style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                />
                <div style={{ fontSize: 12, marginTop: 6, color: "#333" }}>{asset.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {baseMode === "search" && baseUrl && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Selected base image</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={baseUrl} alt="Selected base" style={{ width: "100%", border: "1px solid #ddd" }} />
        </div>
      )}

      {referenceMode === "search" && referenceResults.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Reference search results</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
            {referenceResults.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setReferenceUrl(asset.mediaUrl)}
                style={{
                  border: referenceUrl === asset.mediaUrl ? "2px solid #111" : "1px solid #ddd",
                  padding: 6,
                  cursor: "pointer",
                  background: "white",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.previewUrl || asset.mediaUrl}
                  alt={asset.name}
                  style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                />
                <div style={{ fontSize: 12, marginTop: 6, color: "#333" }}>{asset.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {referenceMode === "search" && referenceUrl && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Selected reference image</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={referenceUrl}
            alt="Selected reference"
            style={{ width: "100%", border: "1px solid #ddd" }}
          />
        </div>
      )}

      {logoMode === "search" && logoResults.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Logo search results</div>
          <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(4, 1fr)" }}>
            {logoResults.map((asset) => (
              <button
                key={asset.id}
                onClick={() => setLogoUrl(asset.mediaUrl)}
                style={{
                  border: logoUrl === asset.mediaUrl ? "2px solid #111" : "1px solid #ddd",
                  padding: 6,
                  cursor: "pointer",
                  background: "white",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.previewUrl || asset.mediaUrl}
                  alt={asset.name}
                  style={{ width: "100%", height: 120, objectFit: "cover", display: "block" }}
                />
                <div style={{ fontSize: 12, marginTop: 6, color: "#333" }}>{asset.name}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {logoMode === "search" && logoUrl && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>Selected logo image</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} alt="Selected logo" style={{ width: "100%", border: "1px solid #ddd" }} />
        </div>
      )}

      <div style={{ marginTop: 16, padding: 12, border: "1px solid #e5e5e5", borderRadius: 8 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Prompt builder</div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          <label style={{ display: "grid", gap: 6 }}>
            Industry
            <select value={industry} onChange={(e) => setIndustry(e.target.value as any)}>
              {INDUSTRIES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          {industry === "Custom" && (
            <label style={{ display: "grid", gap: 6 }}>
              Custom industry name
              <input
                type="text"
                placeholder="e.g., Electronics, Home Decor, Automotive..."
                value={industryCustom}
                onChange={(e) => setIndustryCustom(e.target.value)}
              />
            </label>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            Marketing objective
            <select
              value={marketingObjectivePreset}
              onChange={(e) => setMarketingObjectivePreset(e.target.value)}
            >
              {MARKETING_OBJECTIVES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          {marketingObjectivePreset === "Custom objective…" && (
            <label style={{ display: "grid", gap: 6 }}>
              Custom objective
              <input
                type="text"
                placeholder="Enter your objective"
                value={marketingObjectiveCustom}
                onChange={(e) => setMarketingObjectiveCustom(e.target.value)}
              />
            </label>
          )}

          <label style={{ display: "grid", gap: 6 }}>
            Brand description (optional)
            <input
              type="text"
              placeholder={`modern, credible brand in the ${
                industry === "Custom" && industryCustom.trim()
                  ? industryCustom.trim()
                  : industry
              } space`}
              value={brandDescription}
              onChange={(e) => setBrandDescription(e.target.value)}
            />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Tone (optional)
            <input type="text" value={tone} onChange={(e) => setTone(e.target.value)} />
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Layout mode
            <select value={layoutMode} onChange={(e) => setLayoutMode(e.target.value as any)}>
              {LAYOUT_MODES.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Brand primary color
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={brandPrimaryHex}
                onChange={(e) => setBrandPrimaryHex(e.target.value)}
              />
              <input
                type="text"
                value={brandPrimaryHex}
                onChange={(e) => setBrandPrimaryHex(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </label>

          <label style={{ display: "grid", gap: 6 }}>
            Brand accent color
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                type="color"
                value={brandAccentHex}
                onChange={(e) => setBrandAccentHex(e.target.value)}
              />
              <input
                type="text"
                value={brandAccentHex}
                onChange={(e) => setBrandAccentHex(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
          </label>
        </div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Industry visual style</div>
          <div style={{ color: "#444" }}>{INDUSTRY_VISUAL_STYLE[industry]}</div>
        </div>

        <div style={{ marginTop: 12, display: "flex", gap: 12, alignItems: "center" }}>
          <button
            onClick={() => {
              setPrompt(generatedPrompt);
              setPromptEdited(false);
            }}
            style={{ padding: "6px 10px", cursor: "pointer" }}
          >
            Regenerate prompt
          </button>
          {promptEdited && (
            <div style={{ color: "#555" }}>
              Prompt is in manual edit mode and will not auto-update.
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 12, alignItems: "center" }}>
        <label>
          Width{" "}
          <input
            type="number"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            style={{ width: 110 }}
          />
        </label>

        <label>
          Height{" "}
          <input
            type="number"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            style={{ width: 110 }}
          />
        </label>

        <button
          onClick={generate}
          disabled={loading}
          style={{ marginLeft: "auto", padding: "10px 16px", fontWeight: 800, cursor: "pointer" }}
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </div>

      <div style={{ marginTop: 12 }}>
        <div style={{ fontWeight: 800, marginBottom: 6 }}>Prompt</div>
        <textarea
          value={prompt}
          onChange={(e) => {
            setPrompt(e.target.value);
            setPromptEdited(true);
          }}
          rows={12}
          style={{ width: "100%", padding: 10 }}
        />
      </div>

      {error && (
        <div style={{ marginTop: 12, padding: 12, background: "#ffecec", color: "#8a1f1f" }}>
          {error}
        </div>
      )}

      {sampleUrl && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>Result</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
            <a href={sampleUrl} target="_blank" rel="noreferrer">
              Open full image
            </a>
            <button onClick={generate} disabled={loading} style={{ padding: "6px 10px", cursor: "pointer" }}>
              Regenerate
            </button>
            <button
              onClick={uploadToSprinklr}
              disabled={uploading}
              style={{ padding: "6px 10px", cursor: "pointer" }}
            >
              {uploading ? "Uploading..." : "Upload to Sprinklr"}
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sampleUrl} alt="Generated result" style={{ width: "100%", border: "1px solid #ddd" }} />
        </div>
      )}
    </main>
  );
}
