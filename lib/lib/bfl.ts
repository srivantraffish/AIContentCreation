export function toBase64(buffer: Buffer) {
  return buffer.toString("base64");
}

export async function fetchToBuffer(url: string) {
  const cleanedUrl = url.replace(/%22$/g, "");
  const imgResp = await fetch(cleanedUrl);
  if (!imgResp.ok) {
    const txt = await imgResp.text();
    throw new Error(`Failed to fetch image: ${imgResp.status} ${txt}`);
  }
  const arrayBuf = await imgResp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export async function pollResult(pollingUrl: string, apiKey: string, timeoutMs = 120_000) {
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
    if (data?.status === "Task not found") throw new Error("Task not found (expired/wrong host). Re-run.");

    await new Promise((res) => setTimeout(res, 1200));
  }
}
