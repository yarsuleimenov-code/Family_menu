const endpoint = process.env.APPS_SCRIPT_ENDPOINT || process.env.VITE_APPS_SCRIPT_ENDPOINT;
const token = process.env.API_TOKEN || process.env.VITE_API_TOKEN || '';
const dryRun = process.env.CLEANUP_DRY_RUN !== 'false';

if (!endpoint) {
  console.error('Missing APPS_SCRIPT_ENDPOINT or VITE_APPS_SCRIPT_ENDPOINT');
  process.exit(2);
}

async function call(action, payload = {}) {
  let lastError;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, token, payload }),
      });
      const text = await response.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error(`${action}: non-JSON response HTTP ${response.status}: ${text.slice(0, 300)}`);
      }
      if (!json.ok) throw new Error(`${action}: ${json.error || 'unknown error'}`);
      return json.data;
    } catch (error) {
      lastError = error;
      if (attempt === 4) break;
      await new Promise((resolve) => setTimeout(resolve, attempt * 2500));
    }
  }
  throw lastError;
}

const before = await call('getAppData');
const cleanup = await call('cleanupSeedRows', { dryRun });
const after = dryRun ? before : await call('getAppData');

console.log(JSON.stringify({
  ok: true,
  dryRun,
  cleanup,
  before: {
    dishes: before.dishes.length,
    baseProducts: before.baseProducts.length,
    calendarPlan: before.calendarPlan.length,
    selectedDinners: before.selectedDinners.length,
    shoppingSessions: before.shoppingSessions.length,
  },
  after: {
    dishes: after.dishes.length,
    baseProducts: after.baseProducts.length,
    calendarPlan: after.calendarPlan.length,
    selectedDinners: after.selectedDinners.length,
    shoppingSessions: after.shoppingSessions.length,
  },
}, null, 2));
