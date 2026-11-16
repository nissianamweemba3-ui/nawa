// Entry point: `npm start`.
import { createApp } from './app.js';
import { loadConfig, productionConfigProblems } from './config.js';

const preflight = loadConfig();
if (preflight.production) {
  const problems = productionConfigProblems(preflight);
  if (problems.length) {
    console.error('Refusing to start in production. Fix these settings first:');
    for (const p of problems) console.error(`  - ${p}`);
    process.exit(1);
  }
}

const app = createApp();
const { port, host } = app.config;
app.server.listen(port, host, () => {
  console.log(`Zambia Compliance Intelligence Platform listening on http://${host}:${port}`);
  console.log(`Public site URL: ${app.config.siteUrl ?? '(not set; using the request host for canonical URLs)'}`);
  console.log(`AI provider: ${app.svc.gateway.providerName}${app.svc.gateway.provider.live ? '' : ' (deterministic mode; set ANTHROPIC_API_KEY to enable model generation)'}`);
});

const shutdown = () => { app.close().then(() => process.exit(0)); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
