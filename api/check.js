// Vercel serverless function: POST /api/check
// Body: { brand: string, category: string }
// Queries Gemini with the same "best X in category" question a real user
// might ask, then asks Gemini to analyze its own answer for brand mentions.

// ---------- Settings you can tweak ----------
const ALLOWED_ORIGINS = [
  "https://lumeta-ai.vercel.app",
  "http://localhost:3000", // for `vercel dev`
  // Add your own domain here later, e.g. "https://lumeta.ai"
];

const MAX_PER_MINUTE = 5;   // checks per visitor per minute
const MAX_PER_DAY = 40;     // checks per visitor per day
const MAX_BRAND_LENGTH = 80;
const MAX_CATEGORY_LENGTH = 120;

// ---------- Simple in-memory rate limiter ----------
// Note: serverless instances don't share memory and reset when they go idle,
// so this is a good first line of defence, not a hard guarantee.
// For a strict limit later, use Upstash Redis / Vercel KV.
const hits = new Map(); // ip -> { minute: [timestamps], day: [timestamps] }

function checkRateLimit(ip) {
  const now = Date.now();
  const minuteAgo = now - 60 * 1000;
  const dayAgo = now - 24 * 60 * 60 * 1000;

  const entry = hits.get(ip) || [];
  const recent = entry.filter((t) => t > dayAgo);
  const lastMinute = recent.filter((t) => t > minuteAgo);

  if (lastMinute.length >= MAX_PER_MINUTE) {
    return { ok: false, retryAfter: 60, reason: "Too many checks in a minute. Please wait a bit and try again." };
  }
  if (recent.length >= MAX_PER_DAY) {
    return { ok: false, retryAfter: 3600, reason: "Daily limit reached. Please come back tomorrow." };
  }

  recent.push(now);
  hits.set(ip, recent);

  // Keep memory small
  if (hits.size > 2000) {
    for (const [key, times] of hits) {
      if (!times.some((t) => t > dayAgo)) hits.delete(key);
    }
  }
  return { ok: true };
}

function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  // ---------- CORS ----------
  const origin = req.headers.origin;
  if (origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      res.status(403).json({ error: "Origin not allowed" });
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST" });
    return;
  }

  // ---------- Rate limit ----------
  const limit = checkRateLimit(getClientIp(req));
  if (!limit.ok) {
    res.setHeader("Retry-After", String(limit.retryAfter));
    res.status(429).json({ error: limit.reason });
    return;
  }

  // ---------- Input validation ----------
  const { brand, category } = req.body || {};

  if (typeof brand !== "string" || typeof category !== "string" || !brand.trim() || !category.trim()) {
    res.status(400).json({ error: "brand and category are both required" });
    return;
  }

  const cleanBrand = brand.trim();
  const cleanCategory = category.trim();

  if (cleanBrand.length > MAX_BRAND_LENGTH || cleanCategory.length > MAX_CATEGORY_LENGTH) {
    res.status(400).json({
      error: `Brand must be under ${MAX_BRAND_LENGTH} characters and category under ${MAX_CATEGORY_LENGTH}.`,
    });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not set");
    res.status(500).json({ error: "Server misconfigured" });
    return;
  }

  const prompt = `Someone asks an AI assistant: "What are the best options for ${cleanCategory}?"

Answer that question genuinely, based on real knowledge, mentioning real well-known options in this space if you know of any. Do not invent fake company names.

Then analyze your own answer for whether "${cleanBrand}" was mentioned.

Respond with ONLY valid JSON, no markdown formatting, no other text, in this exact shape:
{
  "mentioned": "Yes" or "No",
  "position": "1st", "2nd", "3rd", "Not ranked", or "N/A",
  "sentiment": "Positive", "Neutral", or "Not mentioned",
  "competitors_mentioned": ["name1", "name2", "name3"],
  "actions": ["specific actionable suggestion 1", "specific actionable suggestion 2", "specific actionable suggestion 3"]
}

If "${cleanBrand}" is a small or less-known business, that is expected and normal — most brands are not mentioned by default. In that case set mentioned to "No", and make the actions specific to improving AI visibility for a brand like this one, not generic advice.`;

  try {
    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      console.error("Gemini API error:", geminiResponse.status, errText);
      res.status(502).json({ error: "The AI service had a problem. Please try again shortly." });
      return;
    }

    const data = await geminiResponse.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.error("Gemini returned no usable text:", JSON.stringify(data));
      res.status(502).json({ error: "The AI service returned an empty answer. Please try again." });
      return;
    }

    // Gemini sometimes wraps JSON in markdown code fences despite instructions — strip them.
    const cleaned = rawText.replace(/```json\s*|\s*```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Could not parse Gemini JSON:", rawText);
      res.status(502).json({ error: "Could not read the AI's answer. Please try again." });
      return;
    }

    res.status(200).json({ engine: "gemini", ...parsed });
  } catch (err) {
    console.error("Unexpected error:", err);
    res.status(500).json({ error: "Unexpected server error" });
  }
}
