# ScentPlugSweden Luxury Image Studio

Standalone admin image workflow for the existing Express/Railway storefront. No Angie, Elementor, WooCommerce, or third-party WordPress plugin.

## Setup
1. Add `GEMINI_API_KEY` as a Railway service variable. Never commit the key.
2. Deploy this branch only to a staging Railway service first.
3. PostgreSQL is required for durable generated-image storage. The image table is created automatically during database initialization.
4. Open `/admin`, sign in, select **AI-produktbilder**, upload a product image, choose a luxury style, and generate one preview.
5. Inspect the bottle, label, brand, cap, liquid colour, and text. Only click **Godkänn som produktbild** when satisfied.

## Safety
- The source image is uploaded explicitly by an authenticated admin; the server does not fetch arbitrary image URLs.
- One generation per request, maximum 8 MB input, accepted raster formats only.
- The source product record and image URL are not modified during generation.
- Generated output is stored separately in PostgreSQL and exposed through an opaque UUID URL.
- Product image URL is updated only after explicit approval.
- No bulk generation, automatic retries, or background jobs.
- Gemini may alter fine label text/logos; manual review is mandatory.
- Without PostgreSQL, generation is disabled to avoid ephemeral Railway filesystem storage.
