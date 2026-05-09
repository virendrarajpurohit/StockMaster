# StockMaster

Mobile-first Hindi/English inventory management web app for handicraft businesses that track 100+ SKUs while actively moving only 10-20 running items.

## Features

- Live stock dashboard with total SKUs, active SKUs, total units, and low-stock count.
- Purchase flow for manufacturer bulk stock: add SKU, item name, material, count, and optional price.
- Sale flow for local shops: add shop name and items; stock is subtracted only when enough inventory exists.
- OCR-assisted bill entry from phone camera/image using Tesseract.js, with editable review before saving.
- Full stock history for additions and subtractions.
- Mobile-friendly responsive UI with Hindi/English toggle.
- Supabase PostgreSQL schema for items, parties, transactions, and transaction lines.
- Render deployment configuration with health check endpoint.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create Supabase tables by running `supabase/schema.sql` in the Supabase SQL editor.

3. Copy environment variables:

   ```bash
   cp .env.example .env
   ```

4. Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`.

5. Start development server:

   ```bash
   npm run dev
   ```

## Render deployment

This repo includes `render.yaml` for a Render web service:

- Build command: `npm ci && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

Set these environment variables in Render:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_URL` (optional, your Render URL)

For true 24/7 uptime, choose a paid Render instance. Free instances can sleep; this app exposes `/api/health` so Render health checks and external monitors can verify the service. An optional `npm run keepalive` script can ping `APP_URL/api/health` every 10 minutes from any always-on worker or external scheduler, but it cannot prevent sleep when the same free web service is already asleep.

## Bill OCR format tips

OCR works best when each bill line has this simple structure:

```text
SKU Item Name Quantity Price
WH-001 Wooden Elephant 12 80
MT-2 Metal Diya 5 45
```

Always review extracted lines before pressing Buy or Sale.
