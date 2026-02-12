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
  const [baseMode, setBaseMode] = useState<"upload" | "search">("upload");
  const [base, setBase] = useState<File | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  const [referenceMode, setReferenceMode] = useState<"upload" | "search">("upload");
  const [reference, setReference] = useState<File | null>(null);
  const [referenceUrl, setReferenceUrl] = useState<string | null>(null);
  const [logoMode, setLogoMode] = useState<"upload" | "search">("upload");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);

  const [loading, setLoading] = useState(false);
  const [sampleUrl, setSampleUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  async function runSearch(
    kind: "base" | "reference" | "logo",
    keyword: string,
    setSearching: (v: boolean) => void,
    setResults: (v: Array<{ id: string; name: string; mediaUrl: string; previewUrl?: string }>) => void,
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
        Upload a base product image or search Sprinklr, plus optional reference and logo. Paste your prompt and generate.
      </div>

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
            <input type="file" accept="image/*" onChange={(e) => setBase(e.target.files?.[0] || null)} />
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
                onClick={() =>
                  runSearch("base", baseKeyword, setBaseSearching, setBaseResults, setBaseUrl)
                }
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
            <input type="file" accept="image/*" onChange={(e) => setReference(e.target.files?.[0] || null)} />
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
                  runSearch(
                    "reference",
                    referenceKeyword,
                    setReferenceSearching,
                    setReferenceResults,
                    setReferenceUrl
                  )
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
            <input type="file" accept="image/*" onChange={(e) => setLogo(e.target.files?.[0] || null)} />
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
                onClick={() =>
                  runSearch("logo", logoKeyword, setLogoSearching, setLogoResults, setLogoUrl)
                }
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
          <img src={referenceUrl} alt="Selected reference" style={{ width: "100%", border: "1px solid #ddd" }} />
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
