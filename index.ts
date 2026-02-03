import { RackspaceSpotClient } from './src/api-client';
import { RackspaceSpotCollector } from './src/collector';
import { collectDefaultMetrics, Registry } from 'prom-client';

// Configuration from environment variables
const config = {
  refreshToken: process.env.RACKSPACE_REFRESH_TOKEN || '',
  apiBaseUrl: process.env.RACKSPACE_API_URL || undefined, // Uses default: https://spot.rackspace.com
  authBaseUrl: process.env.RACKSPACE_AUTH_URL || undefined, // Uses default: https://login.spot.rackspace.com
  namespace: process.env.RACKSPACE_NAMESPACE || '',
  port: parseInt(process.env.PORT || '9090', 10),
  metricsPath: process.env.METRICS_PATH || '/metrics',
  scrapeInterval: parseInt(process.env.SCRAPE_INTERVAL || '60', 10) * 1000, // Convert to milliseconds
};

// Validate required configuration
if (!config.refreshToken || !config.namespace) {
  console.error('ERROR: Required environment variables are missing:');
  console.error('  - RACKSPACE_REFRESH_TOKEN');
  console.error('  - RACKSPACE_NAMESPACE');
  process.exit(1);
}

// Create registry and enable default metrics
const registry = new Registry();
collectDefaultMetrics({ register: registry });

// Create client and collector
const client = new RackspaceSpotClient({
  refreshToken: config.refreshToken,
  apiBaseUrl: config.apiBaseUrl,
  authBaseUrl: config.authBaseUrl,
});

const collector = new RackspaceSpotCollector(client, config.namespace, registry);

// Background collection loop
let isCollecting = false;
async function collectMetrics() {
  if (isCollecting) {
    console.log('Collection already in progress, skipping...');
    return;
  }

  isCollecting = true;
  try {
    await collector.collect();
    console.log(`Metrics collected successfully at ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error collecting metrics:', error);
  } finally {
    isCollecting = false;
  }
}

// Initial collection
console.log('Performing initial metrics collection...');
await collectMetrics();

// Schedule periodic collection
setInterval(collectMetrics, config.scrapeInterval);

// Create HTTP server
const server = Bun.serve({
  port: config.port,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === config.metricsPath) {
      const metrics = await registry.metrics();
      return new Response(metrics, {
        headers: {
          'Content-Type': registry.contentType,
        },
      });
    }

    if (url.pathname === '/health' || url.pathname === '/healthz') {
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/ready' || url.pathname === '/readyz') {
      return new Response('OK', { status: 200 });
    }

    if (url.pathname === '/') {
      return new Response(
        `<html>
<head><title>Rackspace Spot Exporter</title></head>
<body>
<h1>Rackspace Spot Exporter</h1>
<p><a href="${config.metricsPath}">Metrics</a></p>
<p>Namespace: ${config.namespace}</p>
<p>Scrape Interval: ${config.scrapeInterval / 1000}s</p>
</body>
</html>`,
        {
          headers: {
            'Content-Type': 'text/html',
          },
        }
      );
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Rackspace Spot Exporter started`);
console.log(`  - Metrics endpoint: http://localhost:${config.port}${config.metricsPath}`);
console.log(`  - Health endpoint: http://localhost:${config.port}/health`);
console.log(`  - Namespace: ${config.namespace}`);
console.log(`  - Scrape interval: ${config.scrapeInterval / 1000}s`);