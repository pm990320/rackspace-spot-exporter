import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Registry } from 'prom-client';
import { RackspaceSpotCollector } from '../src/collector';
import type { RackspaceSpotClient } from '../src/api-client';

/**
 * Unit tests for RackspaceSpotCollector
 *
 * Tests focus on:
 * - Metric registration
 * - Metric collection from API responses
 * - Error handling
 * - Label assignment
 */

// Create a mock client
function createMockClient(): RackspaceSpotClient {
  return {
    listCloudSpaces: vi.fn(),
    listSpotNodePools: vi.fn(),
    listOnDemandNodePools: vi.fn(),
  } as unknown as RackspaceSpotClient;
}

describe('RackspaceSpotCollector', () => {
  let mockClient: RackspaceSpotClient;
  let registry: Registry;
  let collector: RackspaceSpotCollector;

  beforeEach(() => {
    mockClient = createMockClient();
    registry = new Registry();
    collector = new RackspaceSpotCollector(mockClient, 'org-test', registry);
  });

  describe('constructor', () => {
    it('should create a collector with required parameters', () => {
      expect(collector).toBeDefined();
    });

    it('should register metrics in the provided registry', async () => {
      const metrics = await registry.getMetricsAsJSON();
      const metricNames = metrics.map((m) => m.name);

      expect(metricNames).toContain('rackspace_spot_cloudspace_nodes_total');
      expect(metricNames).toContain('rackspace_spot_spotnodepool_desired');
      expect(metricNames).toContain('rackspace_spot_spotnodepool_won_count');
      expect(metricNames).toContain('rackspace_spot_ondemandnodepool_desired');
      expect(metricNames).toContain('rackspace_spot_ondemandnodepool_reserved_count');
    });

    it('should create its own registry if not provided', () => {
      const collectorWithOwnRegistry = new RackspaceSpotCollector(mockClient, 'org-test');
      expect(collectorWithOwnRegistry.getRegistry()).toBeDefined();
    });
  });

  describe('collect', () => {
    it('should collect cloudspace metrics', async () => {
      vi.mocked(mockClient.listCloudSpaces).mockResolvedValue({
        items: [
          {
            metadata: { name: 'cloudspace-1' },
            spec: { region: 'us-central-dfw-1' },
            status: {
              assignedServers: {
                'server-1': {},
                'server-2': {},
              },
            },
          },
        ],
      } as any);

      vi.mocked(mockClient.listSpotNodePools).mockResolvedValue({ items: [] } as any);
      vi.mocked(mockClient.listOnDemandNodePools).mockResolvedValue({ items: [] } as any);

      await collector.collect();

      const metrics = await registry.metrics();
      expect(metrics).toContain('rackspace_spot_cloudspace_nodes_total');
      expect(metrics).toContain('cloudspace="cloudspace-1"');
      expect(metrics).toContain('cloudspace_region="us-central-dfw-1"');
      expect(metrics).toContain('namespace="org-test"');
      // Should have 2 nodes
      expect(metrics).toMatch(/rackspace_spot_cloudspace_nodes_total\{[^}]+\} 2/);
    });

    it('should collect spot node pool metrics', async () => {
      vi.mocked(mockClient.listCloudSpaces).mockResolvedValue({ items: [] } as any);
      vi.mocked(mockClient.listSpotNodePools).mockResolvedValue({
        items: [
          {
            metadata: { name: 'spot-pool-1' },
            spec: {
              cloudSpace: 'cloudspace-1',
              serverClass: 'gp.vs1.small-dfw',
              desired: 5,
            },
            status: {
              wonCount: 3,
              bidStatus: 'winning',
            },
          },
        ],
      } as any);
      vi.mocked(mockClient.listOnDemandNodePools).mockResolvedValue({ items: [] } as any);

      await collector.collect();

      const metrics = await registry.metrics();

      // Check desired metric
      expect(metrics).toContain('rackspace_spot_spotnodepool_desired');
      expect(metrics).toContain('nodepool="spot-pool-1"');
      expect(metrics).toContain('serverclass="gp.vs1.small-dfw"');
      expect(metrics).toMatch(/rackspace_spot_spotnodepool_desired\{[^}]+\} 5/);

      // Check won count metric
      expect(metrics).toContain('rackspace_spot_spotnodepool_won_count');
      expect(metrics).toContain('bid_status="winning"');
      expect(metrics).toMatch(/rackspace_spot_spotnodepool_won_count\{[^}]+\} 3/);
    });

    it('should collect on-demand node pool metrics', async () => {
      vi.mocked(mockClient.listCloudSpaces).mockResolvedValue({ items: [] } as any);
      vi.mocked(mockClient.listSpotNodePools).mockResolvedValue({ items: [] } as any);
      vi.mocked(mockClient.listOnDemandNodePools).mockResolvedValue({
        items: [
          {
            metadata: { name: 'ondemand-pool-1' },
            spec: {
              cloudSpace: 'cloudspace-1',
              serverClass: 'gp.vs1.medium-dfw',
              desired: 2,
            },
            status: {
              reservedCount: 2,
              reservedStatus: 'reserved',
            },
          },
        ],
      } as any);

      await collector.collect();

      const metrics = await registry.metrics();

      // Check desired metric
      expect(metrics).toContain('rackspace_spot_ondemandnodepool_desired');
      expect(metrics).toContain('nodepool="ondemand-pool-1"');
      expect(metrics).toMatch(/rackspace_spot_ondemandnodepool_desired\{[^}]+\} 2/);

      // Check reserved count metric
      expect(metrics).toContain('rackspace_spot_ondemandnodepool_reserved_count');
      expect(metrics).toContain('reserved_status="reserved"');
      expect(metrics).toMatch(/rackspace_spot_ondemandnodepool_reserved_count\{[^}]+\} 2/);
    });

    it('should handle empty responses', async () => {
      vi.mocked(mockClient.listCloudSpaces).mockResolvedValue({ items: [] } as any);
      vi.mocked(mockClient.listSpotNodePools).mockResolvedValue({ items: [] } as any);
      vi.mocked(mockClient.listOnDemandNodePools).mockResolvedValue({ items: [] } as any);

      await expect(collector.collect()).resolves.not.toThrow();
    });

    it('should handle null/undefined items', async () => {
      vi.mocked(mockClient.listCloudSpaces).mockResolvedValue({} as any);
      vi.mocked(mockClient.listSpotNodePools).mockResolvedValue(null as any);
      vi.mocked(mockClient.listOnDemandNodePools).mockResolvedValue(undefined as any);

      await expect(collector.collect()).resolves.not.toThrow();
    });

    it('should handle API errors', async () => {
      vi.mocked(mockClient.listCloudSpaces).mockRejectedValue(new Error('API Error'));
      vi.mocked(mockClient.listSpotNodePools).mockResolvedValue({ items: [] } as any);
      vi.mocked(mockClient.listOnDemandNodePools).mockResolvedValue({ items: [] } as any);

      await expect(collector.collect()).rejects.toThrow('API Error');
    });

    it('should use default values for missing fields', async () => {
      vi.mocked(mockClient.listCloudSpaces).mockResolvedValue({
        items: [
          {
            metadata: {},
            spec: {},
            status: {},
          },
        ],
      } as any);
      vi.mocked(mockClient.listSpotNodePools).mockResolvedValue({
        items: [
          {
            metadata: {},
            spec: {},
            status: {},
          },
        ],
      } as any);
      vi.mocked(mockClient.listOnDemandNodePools).mockResolvedValue({
        items: [
          {
            metadata: {},
            spec: {},
            status: {},
          },
        ],
      } as any);

      await collector.collect();

      const metrics = await registry.metrics();

      // Should have 'unknown' for missing values
      expect(metrics).toContain('cloudspace="unknown"');
      expect(metrics).toContain('nodepool="unknown"');
      expect(metrics).toContain('serverclass="unknown"');
    });
  });

  describe('getRegistry', () => {
    it('should return the registry', () => {
      expect(collector.getRegistry()).toBe(registry);
    });
  });
});
