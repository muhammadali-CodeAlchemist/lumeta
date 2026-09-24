# Signal Backend — Gemini Brand Check API

A minimal Vercel serverless function that queries Gemini and analyzes whether
a brand gets mentioned for a given category — the real backend piece the
Claude-only demo doesn't have.

## What this is NOT (be clear-eyed about this)
- Not a full multi-engine tracker yet (Gemini only, for now)
- Not a database — every request is a fresh, uncached call
- Not authenticated — anyone with the URL can call it (fine for a demo, not for production)

## Setup

### 1. Get a free Gemini API key
Go to https://aistudio.google.com/apikey, sign in with a Google account,
create a key. The free tier has rate limits but no cost for light testing.

### 2. Install Vercel CLI (if you don't have it)
```bash
npm install -g vercel
```

### 3. Set up the project locally
```bash
cd signal-backend
vercel login
```

### 4. Add your API key as an environment variable
```bash
vercel env add GEMINI_API_KEY
```
Paste your key when prompted. Choose "Development, Preview, Production" (all three) when asked which environments.

### 5. Run it locally to test first
```bash
vercel dev
```
This starts a local server, usually at `http://localhost:3000`.

### 6. Test it with curl
```bash
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"brand": "WEB SAB Technologies", "category": "digital marketing agency for law firms"}'
```

You should get back JSON like:
```json
{
  "engine": "gemini",
  "mentioned": "No",
  "position": "Not ranked",
  "sentiment": "Not mentioned",
  "competitors_mentioned": ["...", "...", "..."],
  "actions": ["...", "...", "..."]
}
```

**If this curl command fails or returns an error, stop here and share the exact error — don't deploy yet until it works locally.**

### 7. Deploy to production
```bash
vercel --prod
```
This gives you a live URL like `https://signal-backend-yourname.vercel.app`.

### 8. Test the deployed version
```bash
curl -X POST https://your-deployed-url.vercel.app/api/check \
  -H "Content-Type: application/json" \
  -d '{"brand": "WEB SAB Technologies", "category": "digital marketing agency for law firms"}'
```

## Next steps once this works
- Wire the Signal landing page's frontend to call this endpoint instead of (or alongside) the Claude-only demo
- Add OpenAI/Perplexity as additional engines the same way (same pattern, different API)
- Add basic rate limiting so the free tier doesn't get exhausted by random traffic
- Restrict CORS in `api/check.js` from `"*"` to your actual frontend domain
