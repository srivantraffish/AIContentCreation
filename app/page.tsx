"use client";
import { useState } from "react";

const DEFAULT_PROMPT = `Create a high-end, photorealistic, production-ready commercial product image using the attached product image as the base.

Preserve the product’s exact shape, proportions, materials, and real-world color accuracy. Do not change the product design.

If a style reference image is provided: apply the reference style only (camera angle, framing, lighting softness, contrast, color grading, and background treatment). Do not copy branding or objects from the reference.

If a logo is provided: place the logo naturally on the product or its label/packaging where it physically makes sense. The logo must be sharp, undistorted, and interact realistically with the surface (printed/embossed/engraved as appropriate).

Do not add any extra graphics, text, symbols, patterns, props, or watermarks.
Do not distort the product or logo.
Avoid cartoon/illustration/CGI/mockup-style results.
No blur, no low resolution, no stylization.`;

export default function Page() {
  const [base, setBase] = useState<File | null>(null);
  const [reference, setReference] = useState<File | null>(null);
  const [logo, setLogo] = useState<File | null>(null);

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);

  const [loading, setLoading] = useState(false);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setError(null);
    setSampleUrl(null);

    if (!base) return setError("Please upload a base product image.");

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("prompt", prompt);
      fd.append("width", String(width));
      fd.append("height", String(height));
      fd.append("base", base);
      if (reference) fd.append("reference", reference);
      if (logo) fd.append("logo", logo);

      const r = await fetch("/api/generate", { method: "POST", body: fd });
      const data = await r.json();

      if (!r.ok) setError(data?.error || "Generation failed");
      else setSampleUrl(data.sampleUrl);
    } catch (e: any) {
      setError(e?.message || "Unexpected error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 920, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, marginBottom: 6 }}>BFL Image Generator</h1>
      <div style={{ color: "#555", marginBottom: 16 }}>
        Upload a base product image + optional reference + optional logo. Paste your prompt and generate.
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr 1fr" }}>
        <label>
          <div style={{ fontWeight: 700 }}>Base product image *</div>
          <input type="file" accept="image/*" onChange={(e) => setBase(e.target.files?.[0] || null)} />
        </label>

        <label>
          <div style={{ fontWeight: 700 }}>Style reference (optional)</div>
          <input type="file" accept="image/*" onChange={(e) => setReference(e.target.files?.[0] || null)} />
        </label>

        <label>
          <div style={{ fontWeight: 700 }}>Logo (optional)</div>
          <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} />
        </label>
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
          onChange={(e) => setPrompt(e.target.value)}
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
          <div style={{ marginBottom: 8 }}>
            <a href={sampleUrl} target="_blank" rel="noreferrer">
              Open full image
            </a>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sampleUrl} alt="Generated result" style={{ width: "100%", border: "1px solid #ddd" }} />
        </div>
      )}
    </main>
  );
}
