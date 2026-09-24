# Lumeta — AI Brand Visibility Tracker

**Live demo: https://lumeta-ai.vercel.app**

When people ask AI assistants "what are the best options for [category]?", is your brand in the answer? Lumeta checks, and tells you what to do about it.

Enter a brand and a category. Lumeta asks Gemini the same question a real customer would ask, then reports whether the brand was mentioned, where it ranked, which competitors appeared, and specific GEO/AEO (generative and answer engine optimization) actions to improve visibility.

## What it returns

- **Mentioned:** Yes or No
- **Position:** 1st, 2nd, 3rd, or not ranked
- **Sentiment:** Positive, Neutral, or not mentioned
- **Competitors** the AI recommended instead
- **Actions:** concrete suggestions for improving AI visibility

## How it works

- `public/index.html` is a single-page frontend with a blueprint-style design.
- `api/check.js` is a Vercel serverless function (`POST /api/check`) that sends the prompt to the Gemini API and returns structured JSON.
- The API key lives in a server-side environment variable and is never exposed to the browser.

## Built-in protections

- CORS restricted to an allowlist of origins
- Per-visitor rate limiting (in-memory, best effort)
- Input validation and length limits
- Upstream error details logged server-side, not sent to visitors

## Run it yourself

1. Clone the repo and install the Vercel CLI: `npm i -g vercel`
2. Create a `.env.local` file containing `GEMINI_API_KEY=your_key_here` (get a key from Google AI Studio)
3. Run `vercel dev` and open http://localhost:3000
4. Deploy with `vercel --prod`

Test the API directly:

```
curl -X POST http://localhost:3000/api/check -H "Content-Type: application/json" -d "{\"brand\": \"YourBrand\", \"category\": \"your category\"}"
```

## Current status

**Working:**
- Live Gemini integration, deployed end to end

**Planned:**
- More AI engines (ChatGPT, Claude, Perplexity, and others). The page shows them, but only Gemini is connected today.
- Saved check history and user accounts
- A working waitlist signup
- Stricter, shared rate limiting

## Notes

Results reflect a single AI response at a single moment and can vary between runs. Treat them as a signal, not a guarantee.

## Author

Built by Muhammad Ali. Full stack developer working with React, Node.js and LLM integration.
