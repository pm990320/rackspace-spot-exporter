# Rackspace Spot Exporter

[![CI](https://github.com/pm990320/rackspace-spot-exporter/actions/workflows/ci.yaml/badge.svg)](https://github.com/pm990320/rackspace-spot-exporter/actions/workflows/ci.yaml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Prometheus exporter for [Rackspace Spot](https://spot.rackspace.com) - a managed Kubernetes platform with auction-based pricing.

## Features

- **CloudSpace Metrics**: Monitor node counts across your Kubernetes clusters
- **SpotNodePool Metrics**: Track bid status, desired vs. won nodes
- **OnDemandNodePool Metrics**: Monitor reserved node allocation
- **Prometheus Operator Support**: ServiceMonitor, PodMonitor, and PrometheusRule CRDs
- **Helm Chart**: Easy Kubernetes deployment with OCI registry support
- **Type-Safe**: Full TypeScript implementation with OpenAPI-generated types

## Prerequisites

- A Rackspace Spot account
- A refresh token from the Rackspace Spot console

## Getting Your Refresh Token

1. Log in to the [Rackspace Spot Console](https://spot.rackspace.com)
2. Navigate to **API Access > Terraform** in the sidebar
3. Click **Get New Token** to generate a refresh token
4. Copy the token for use with this exporter

## Quick Start

### Docker

```bash
docker run -d \
  -e RACKSPACE_REFRESH_TOKEN="your-refresh-token" \
  -e RACKSPACE_ORGANIZATION="org-xxxxx" \
  -p 9090:9090 \
  ghcr.io/pm990320/rackspace-spot-exporter:latest
```

### Kubernetes (Helm)

```bash
# Create a secret with your refresh token
kubectl create secret generic rackspace-spot-credentials \
  --from-literal=refresh-token=your-refresh-token

# Install from OCI registry
helm install rackspace-spot-exporter \
  oci://ghcr.io/pm990320/charts/rackspace-spot-exporter \
  --version 0.1.0 \
  --set rackspaceSpot.organization=org-xxxxx \
  --set rackspaceSpot.existingSecret=rackspace-spot-credentials
```

### Local Development

```bash
# Install dependencies
bun install

# Set environment variables
export RACKSPACE_REFRESH_TOKEN="your-refresh-token"
export RACKSPACE_ORGANIZATION="org-xxxxx"

# Run the exporter
bun run start

# Access metrics
curl http://localhost:9090/metrics
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `RACKSPACE_REFRESH_TOKEN` | Yes | - | OAuth refresh token from Rackspace Spot console |
| `RACKSPACE_ORGANIZATION` | Yes | - | Organization ID (e.g., `org-xxxxx`) |
| `RACKSPACE_API_URL` | No | `https://spot.rackspace.com` | Rackspace Spot API URL |
| `RACKSPACE_AUTH_URL` | No | `https://login.spot.rackspace.com` | Rackspace OAuth URL |
| `PORT` | No | `9090` | Exporter listen port |
| `METRICS_PATH` | No | `/metrics` | Metrics endpoint path |
| `SCRAPE_INTERVAL` | No | `60` | API scrape interval (seconds) |

### Helm Values

| Value | Required | Default | Description |
|-------|----------|---------|-------------|
| `rackspaceSpot.organization` | Yes | - | Organization ID to monitor |
| `rackspaceSpot.refreshToken` | Yes* | - | Refresh token (*or use `existingSecret`) |
| `rackspaceSpot.existingSecret` | No | - | Name of existing secret with `refresh-token` key |
| `serviceMonitor.enabled` | No | `false` | Enable Prometheus Operator ServiceMonitor |
| `podMonitor.enabled` | No | `false` | Enable Prometheus Operator PodMonitor |
| `prometheusRule.enabled` | No | `false` | Enable PrometheusRule for alerting |

See [values.yaml](helm/rackspace-spot-exporter/values.yaml) for all options.

## Metrics

### CloudSpace Metrics

| Metric | Description | Labels |
|--------|-------------|--------|
| `rackspace_spot_cloudspace_nodes_total` | Total nodes in a cloudspace | `namespace`, `cloudspace`, `cloudspace_region` |

### SpotNodePool Metrics

| Metric | Description | Labels |
|--------|-------------|--------|
| `rackspace_spot_spotnodepool_desired` | Desired node count | `namespace`, `cloudspace`, `nodepool`, `serverclass` |
| `rackspace_spot_spotnodepool_won_count` | Nodes won in auction | `namespace`, `cloudspace`, `nodepool`, `serverclass`, `bid_status` |

### OnDemandNodePool Metrics

| Metric | Description | Labels |
|--------|-------------|--------|
| `rackspace_spot_ondemandnodepool_desired` | Desired node count | `namespace`, `cloudspace`, `nodepool`, `serverclass` |
| `rackspace_spot_ondemandnodepool_reserved_count` | Reserved nodes | `namespace`, `cloudspace`, `nodepool`, `serverclass`, `reserved_status` |

## Prometheus Operator Integration

### ServiceMonitor

```yaml
serviceMonitor:
  enabled: true
  interval: 60s
  scrapeTimeout: 30s
  labels:
    release: prometheus  # Must match your Prometheus Operator release
```

### Example Alerts

```yaml
prometheusRule:
  enabled: true
  rules:
    - alert: SpotNodePoolBelowDesired
      expr: rackspace_spot_spotnodepool_won_count < rackspace_spot_spotnodepool_desired
      for: 10m
      labels:
        severity: warning
      annotations:
        summary: "Spot pool {{ $labels.nodepool }} below capacity"
        description: "Won {{ $value }} nodes but desired {{ $labels.desired }}"

    - alert: RackspaceSpotExporterDown
      expr: up{job="rackspace-spot-exporter"} == 0
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "Rackspace Spot Exporter is down"
```

## Development

```bash
# Install dependencies
bun install

# Run in watch mode
bun run dev

# Type checking
bun run typecheck

# Run tests
bun run test

# Run tests with coverage
bun run test:coverage

# Regenerate API types from OpenAPI spec
bun run generate-types
```

### Project Structure

```
rackspace-spot-exporter/
├── index.ts              # Main server entry point
├── src/
│   ├── api-client.ts     # Type-safe Rackspace Spot API client
│   ├── api-types.ts      # Generated OpenAPI types
│   └── collector.ts      # Prometheus metrics collector
├── tests/                # Unit and integration tests
├── helm/                 # Helm chart
│   └── rackspace-spot-exporter/
└── openapi.yaml          # Rackspace Spot OpenAPI spec
```

### Testing

The project includes comprehensive tests:

- **Unit Tests**: Test API client and collector with mocked responses
- **Helm Tests**: Validate chart templating and required values

```bash
bun run test           # Run all tests
bun run test:watch     # Watch mode
bun run test:coverage  # With coverage report
```

## Architecture

This exporter uses a type-safe approach:

1. **Generated Types**: TypeScript types auto-generated from the official Rackspace Spot OpenAPI 3.0 spec using `openapi-typescript`
2. **Type-Safe Client**: The `openapi-fetch` library provides compile-time type checking for API calls
3. **Prometheus Client**: Uses `prom-client` for metric collection and exposition

## Releasing

See [RELEASING.md](RELEASING.md) for release process documentation.

## License

MIT

## Disclaimer

This is a third-party, community-maintained exporter and is not officially published or supported by Rackspace Technology.
