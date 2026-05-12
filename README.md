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

## Prerequisites

- Node.js 20 or newer.
- npm 10 or newer.
- A Supabase project.
- A Supabase service-role key for the backend only. Do not expose this key in browser code.

## Run locally

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Supabase database tables

1. Open your Supabase project dashboard.
2. Go to **SQL Editor**.
3. Open this repository's `supabase/schema.sql` file.
4. Copy the complete SQL file into the Supabase SQL Editor.
5. Click **Run**.

This creates the `items`, `parties`, `stock_transactions`, and `stock_transaction_lines` tables, plus the atomic `record_stock_transaction` function used to safely add/subtract stock.

### 3. Configure local environment variables

Create your local `.env` file:

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
PORT=10000
```

You can find these values in Supabase under **Project Settings → API**. Use the `service_role` key only on the server/local `.env`; never paste it into frontend code.

### 4. Start the local development app

```bash
npm run dev
```

Open the Vite URL shown in your terminal, usually:

```text
http://localhost:5173
```

The React frontend runs through Vite and calls the local Express API. The API runs on `http://localhost:10000`.

### 5. Test the production-style local app

After dependencies are installed, you can also test the same build/start flow Render uses:

```bash
npm run build
npm start
```

Then open:

```text
http://localhost:10000
```

Check the backend health endpoint:

```bash
curl http://localhost:10000/api/health
```

## Render deployment

This repo includes `render.yaml`, so Render can create the service from this repository.

### 1. Prepare Supabase first

Before deploying to Render:

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor.
3. Copy your `SUPABASE_URL`.
4. Copy your `service_role` key from **Project Settings → API**.

### 2. Create the Render service

1. Push this repository to GitHub/GitLab.
2. Open Render.
3. Click **New + → Blueprint** if you want Render to use `render.yaml`, or **New + → Web Service** if creating it manually.
4. Connect your repository.
5. If using manual setup, use these values:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Node Version | `20` |

The committed `render.yaml` already contains those settings.

### 3. Add Render environment variables

In Render, open the service and go to **Environment**. Add:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
APP_URL=https://your-render-service.onrender.com
NODE_VERSION=20
```

`APP_URL` is optional for the core app, but useful for the optional keepalive script or external monitoring.

### 4. Deploy

Click **Manual Deploy → Deploy latest commit**. After deployment, open:

```text
https://your-render-service.onrender.com
```

Verify the health endpoint:

```text
https://your-render-service.onrender.com/api/health
```

You should see JSON similar to:

```json
{"ok":true,"service":"stockmaster","time":"2026-05-09T00:00:00.000Z"}
```

### 5. 24/7 uptime note

For true 24/7 uptime, use a paid Render instance. Free Render services can sleep when idle. This app exposes `/api/health`, so Render health checks and external monitors can verify the service.

If you run an always-on worker, cron, or external uptime monitor, you can ping the app every 10 minutes:

```bash
APP_URL=https://your-render-service.onrender.com npm run keepalive
```

Important: a keepalive process running inside the same sleeping free web service cannot wake itself. Use a paid instance or an external scheduler/monitor if constant availability is required.

## Common troubleshooting

### `Supabase is not configured`

Your `.env` or Render environment variables are missing `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY`.

### `SKU ... does not exist. Add purchase stock first.`

You are trying to sell an item before adding it through the purchase flow.

### `Insufficient stock`

The sale quantity is greater than the available stock. Add more stock first or reduce the sale quantity.

### OCR did not fill all items

Use a clearer image and keep bill lines close to this format:

```text
SKU Item Name Quantity Price
WH-001 Wooden Elephant 12 80
MT-2 Metal Diya 5 45
```

Always review extracted lines before pressing Buy or Sale.
