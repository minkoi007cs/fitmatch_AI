# FitMatch AI

FitMatch AI is a production-ready Next.js App Router MVP for AI-powered fashion recommendations. Users can:

- sign in with Microsoft via Supabase Auth
- upload or capture clothing photos
- extract item metadata with OpenAI vision
- save items into a private digital wardrobe
- take a style quiz and store a persistent profile
- generate multi-style outfit suggestions
- save generated outfits for later review

## Stack

- Next.js 16 App Router + TypeScript
- Tailwind CSS 4
- Supabase Auth, Database, and Storage
- OpenAI API for image analysis and outfit generation

## Environment variables

Copy `.env.local.example` to `.env.local` and fill in:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_TEXT_MODEL=gpt-4o-mini
OPENAI_VISION_MODEL=gpt-4o-mini
```

## Supabase setup

1. Run the SQL in [supabase/schema.sql](/Users/khoihoang/Documents/clothes_design_app/supabase/schema.sql) in your Supabase SQL editor.
2. In Supabase Auth, enable the Microsoft provider. Supabase labels this provider as `azure`.
3. Add the callback URL:

```text
https://YOUR_DOMAIN/auth/callback
http://localhost:3000/auth/callback
```

4. Confirm the private storage bucket `fitmatch-wardrobe` exists if you manage buckets manually.
5. Add your Supabase service role key to `SUPABASE_SERVICE_ROLE_KEY` so server-side uploads can write to Storage reliably.

## Local development

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Production checks

The app currently passes:

```bash
npm run lint
npm run build
```

## API routes

- `POST /api/analyze-image`
- `POST /api/generate-outfit`
- `GET/POST /api/user/profile`
- `GET/POST /api/wardrobe`
- `PATCH/DELETE /api/wardrobe/[id]`
- `GET/POST /api/outfits`

## Notes

- If `OPENAI_API_KEY` is not set, the app falls back to deterministic placeholder analysis and outfit generation so the UI remains testable.
- Wardrobe images are stored in a private Supabase bucket and served back with signed URLs.
