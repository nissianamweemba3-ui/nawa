// Entry point: `npm start`.
import { createApp } from './app.js';

const app = createApp();
const { port, host } = app.config;
app.server.listen(port, host, () => {
  console.log(`Zambia Compliance Intelligence Platform listening on http://${host}:${port}`);
  console.log(`AI provider: ${app.svc.gateway.providerName}${app.svc.gateway.provider.live ? '' : ' (deterministic mode — set ANTHROPIC_API_KEY to enable model generation)'}`);
});

const shutdown = () => { app.close().then(() => process.exit(0)); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
