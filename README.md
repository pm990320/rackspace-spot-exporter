# Rackspace Spot Exporter

A Prometheus exporter for Rackspace Spot metrics, built with Bun and TypeScript. This exporter collects and exposes metrics about CloudSpaces, SpotNodePools, and OnDemandNodePools for monitoring with Prometheus.

## Features

- **CloudSpace Metrics**: Monitor the number of nodes in each cloudspace
- **SpotNodePool Metrics**: Track desired and won node counts for spot node pools
- **OnDemandNodePool Metrics**: Monitor desired and reserved node counts for on-demand pools
- **Prometheus Operator Support**: Includes ServiceMonitor and PodMonitor CRDs
- **OAuth Authentication**: Secure API access with automatic token refresh
- **Health & Readiness Probes**: Built-in Kubernetes health checking
- **Type-Safe**: Full TypeScript implementation with OpenAPI-generated types

## Metrics Exported

### CloudSpace Metrics
- `rackspace_spot_cloudspace_nodes_total`: Total number of nodes in a cloudspace
  - Labels: `namespace`, `cloudspace`, `cloudspace_region`

### SpotNodePool Metrics
- `rackspace_spot_spotnodepool_desired`: Desired number of nodes in a spot node pool
  - Labels: `namespace`, `cloudspace`, `nodepool`, `serverclass`
- `rackspace_spot_spotnodepool_won_count`: Number of nodes won in a spot node pool
  - Labels: `namespace`, `cloudspace`, `nodepool`, `serverclass`, `bid_status`

### OnDemandNodePool Metrics
- `rackspace_spot_ondemandnodepool_desired`: Desired number of nodes in an on-demand node pool
  - Labels: `namespace`, `cloudspace`, `nodepool`, `serverclass`
- `rackspace_spot_ondemandnodepool_reserved_count`: Number of reserved nodes in an on-demand node pool
  - Labels: `namespace`, `cloudspace`, `nodepool`, `serverclass`, `reserved_status`

## Quick Start

### Local Development

1. Install dependencies:
```bash
bun install
```

2. Set environment variables:
```bash
export RACKSPACE_REFRESH_TOKEN="your-refresh-token"
export RACKSPACE_NAMESPACE="org-xxxxx"
```

3. Run the exporter:
```bash
bun run start
```

4. Access metrics:
```bash
curl http://localhost:9090/metrics
```

### Docker

1. Build the image:
```bash
docker build -t rackspace-spot-exporter:latest .
```

2. Run the container:
```bash
docker run -d \
  -e RACKSPACE_REFRESH_TOKEN="your-refresh-token" \
  -e RACKSPACE_NAMESPACE="org-xxxxx" \
  -p 9090:9090 \
  rackspace-spot-exporter:latest
```

### Kubernetes (Helm)

#### Install from OCI Registry (recommended)

```bash
# Create a secret with your refresh token
kubectl create secret generic rackspace-spot-credentials \
  --from-literal=refresh-token=your-refresh-token

# Install from GHCR OCI registry
helm install rackspace-spot-exporter \
  oci://ghcr.io/pm990320/charts/rackspace-spot-exporter \
  --version 0.1.0 \
  --set rackspaceSpot.namespace=org-xxxxx \
  --set rackspaceSpot.existingSecret=rackspace-spot-credentials
```

#### Install from local chart

```bash
# Create a secret with your refresh token
kubectl create secret generic rackspace-spot-credentials \
  --from-literal=refresh-token=your-refresh-token

# Install from local chart
helm install rackspace-spot-exporter ./helm/rackspace-spot-exporter \
  --set rackspaceSpot.namespace=org-xxxxx \
  --set rackspaceSpot.existingSecret=rackspace-spot-credentials
```

#### Enable ServiceMonitor for Prometheus Operator

```bash
helm install rackspace-spot-exporter \
  oci://ghcr.io/pm990320/charts/rackspace-spot-exporter \
  --version 0.1.0 \
  --set rackspaceSpot.namespace=org-xxxxx \
  --set rackspaceSpot.existingSecret=rackspace-spot-credentials \
  --set serviceMonitor.enabled=true \
  --set serviceMonitor.labels.release=prometheus
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `RACKSPACE_REFRESH_TOKEN` | OAuth Refresh Token from Rackspace Spot console | - | Yes |
| `RACKSPACE_NAMESPACE` | Organization namespace (org-xxxxx) | - | Yes |
| `RACKSPACE_API_URL` | Rackspace Spot API URL | `https://spot.rackspace.com` | No |
| `RACKSPACE_AUTH_URL` | Rackspace OAuth URL | `https://login.spot.rackspace.com` | No |
| `PORT` | Exporter port | `9090` | No |
| `METRICS_PATH` | Metrics endpoint path | `/metrics` | No |
| `SCRAPE_INTERVAL` | How often to scrape the API (seconds) | `60` | No |

### Helm Values

See [helm/rackspace-spot-exporter/values.yaml](helm/rackspace-spot-exporter/values.yaml) for all configuration options.

Key configuration options:
- `rackspaceSpot.namespace`: The organization namespace to monitor (required)
- `rackspaceSpot.refreshToken`: OAuth refresh token (required if not using existingSecret)
- `rackspaceSpot.existingSecret`: Use an existing secret for the refresh token
- `serviceMonitor.enabled`: Enable Prometheus Operator ServiceMonitor
- `podMonitor.enabled`: Enable Prometheus Operator PodMonitor
- `prometheusRule.enabled`: Enable PrometheusRule for alerting
- `exporter.scrapeInterval`: How often to scrape the API (in seconds)

## Prometheus Operator Integration

### ServiceMonitor

The exporter includes a ServiceMonitor CRD for automatic discovery by Prometheus Operator:

```yaml
serviceMonitor:
  enabled: true
  interval: 60s
  scrapeTimeout: 30s
  labels:
    release: prometheus  # Must match your Prometheus Operator release
```

### PrometheusRule Example

Enable alerting with PrometheusRule:

```yaml
prometheusRule:
  enabled: true
  labels:
    release: prometheus
  rules:
    - alert: RackspaceSpotExporterDown
      expr: up{job="rackspace-spot-exporter"} == 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Rackspace Spot Exporter is down"
        description: "Rackspace Spot Exporter has been down for more than 5 minutes."

    - alert: SpotNodePoolBelowDesired
      expr: rackspace_spot_spotnodepool_won_count < rackspace_spot_spotnodepool_desired
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Spot node pool {{ $labels.nodepool }} is below desired capacity"
        description: "Node pool {{ $labels.nodepool }} has {{ $value }} nodes but desires {{ $labels.desired }}"
```

## Publishing Docker Images

### Build and Push

```bash
# Build the image
docker build -t ghcr.io/pm990320/rackspace-spot-exporter:latest .

# Push to GitHub Container Registry
docker push ghcr.io/pm990320/rackspace-spot-exporter:latest
```

### GitHub Actions (CI/CD)

You can automate Docker builds using GitHub Actions. Create `.github/workflows/docker.yaml`:

```yaml
name: Build and Push Docker Image

on:
  push:
    branches: [main]
    tags: ['v*']
  pull_request:
    branches: [main]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: ${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - uses: actions/checkout@v4

      - name: Log in to Container Registry
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=ref,event=branch
            type=semver,pattern={{version}}
            type=sha

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: ${{ github.event_name != 'pull_request' }}
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
```

## Development

### Project Structure

```
rackspace-spot-exporter/
├── index.ts                  # Main server and metrics collection
├── src/
│   ├── api-client.ts        # Rackspace Spot API client (openapi-fetch)
│   ├── api-types.ts         # Generated TypeScript types from OpenAPI spec
│   └── collector.ts         # Metrics collector
├── openapi.yaml             # Rackspace Spot OpenAPI specification
├── Dockerfile               # Container image definition
└── helm/                    # Helm chart for Kubernetes deployment
    └── rackspace-spot-exporter/
        ├── Chart.yaml
        ├── values.yaml
        └── templates/
```

### Regenerate OpenAPI Types

If the API spec changes:

```bash
bun run generate-types
```

### Scripts

```bash
bun run start           # Start the exporter
bun run dev             # Start with watch mode
bun run generate-types  # Regenerate types from OpenAPI spec
bun run typecheck       # Run TypeScript type checking
```

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
