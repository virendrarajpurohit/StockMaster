import '../server/loadEnv.js';
const url = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL;
const minutes = Number(process.env.KEEPALIVE_MINUTES || 10);

if (!url) {
  console.log('APP_URL/RENDER_EXTERNAL_URL not set; keepalive disabled.');
  process.exit(0);
}

const healthUrl = new URL('/api/health', url).toString();

async function ping() {
  try {
    const response = await fetch(healthUrl);
    console.log(`[keepalive] ${new Date().toISOString()} ${response.status} ${healthUrl}`);
  } catch (error) {
    console.error(`[keepalive] ${new Date().toISOString()} ${error.message}`);
  }
}

await ping();
setInterval(ping, minutes * 60 * 1000);
