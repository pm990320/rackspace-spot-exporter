import { Registry, Gauge } from 'prom-client';
import { RackspaceSpotClient } from './api-client';
import type { components } from './api-types';

type CloudSpace = components['schemas']['io.rxt.ngpc.v1.CloudSpace'];
type SpotNodePool = components['schemas']['io.rxt.ngpc.v1.SpotNodePool'];
type OnDemandNodePool = components['schemas']['io.rxt.ngpc.v1.OnDemandNodePool'];

export class RackspaceSpotCollector {
  private client: RackspaceSpotClient;
  private registry: Registry;
  private organization: string;

  // CloudSpace metrics
  private cloudspaceNodesGauge: Gauge;

  // SpotNodePool metrics
  private spotNodePoolDesiredGauge: Gauge;
  private spotNodePoolWonCountGauge: Gauge;

  // OnDemandNodePool metrics
  private onDemandNodePoolDesiredGauge: Gauge;
  private onDemandNodePoolReservedCountGauge: Gauge;

  constructor(client: RackspaceSpotClient, organization: string, registry?: Registry) {
    this.client = client;
    this.organization = organization;
    this.registry = registry || new Registry();

    // Initialize metrics
    this.cloudspaceNodesGauge = new Gauge({
      name: 'rackspace_spot_cloudspace_nodes_total',
      help: 'Total number of nodes in a cloudspace',
      labelNames: ['namespace', 'cloudspace', 'cloudspace_region'],
      registers: [this.registry],
    });

    this.spotNodePoolDesiredGauge = new Gauge({
      name: 'rackspace_spot_spotnodepool_desired',
      help: 'Desired number of nodes in a spot node pool',
      labelNames: ['namespace', 'cloudspace', 'nodepool', 'serverclass'],
      registers: [this.registry],
    });

    this.spotNodePoolWonCountGauge = new Gauge({
      name: 'rackspace_spot_spotnodepool_won_count',
      help: 'Number of nodes won in a spot node pool',
      labelNames: ['namespace', 'cloudspace', 'nodepool', 'serverclass', 'bid_status'],
      registers: [this.registry],
    });

    this.onDemandNodePoolDesiredGauge = new Gauge({
      name: 'rackspace_spot_ondemandnodepool_desired',
      help: 'Desired number of nodes in an on-demand node pool',
      labelNames: ['namespace', 'cloudspace', 'nodepool', 'serverclass'],
      registers: [this.registry],
    });

    this.onDemandNodePoolReservedCountGauge = new Gauge({
      name: 'rackspace_spot_ondemandnodepool_reserved_count',
      help: 'Number of reserved nodes in an on-demand node pool',
      labelNames: ['namespace', 'cloudspace', 'nodepool', 'serverclass', 'reserved_status'],
      registers: [this.registry],
    });
  }

  async collect(): Promise<void> {
    try {
      await Promise.all([
        this.collectCloudSpaceMetrics(),
        this.collectSpotNodePoolMetrics(),
        this.collectOnDemandNodePoolMetrics(),
      ]);
    } catch (error) {
      console.error('Error collecting metrics:', error);
      throw error;
    }
  }

  private async collectCloudSpaceMetrics(): Promise<void> {
    const cloudSpaces = await this.client.listCloudSpaces(this.organization);

    if (!cloudSpaces?.items) {
      return;
    }

    for (const cloudSpace of cloudSpaces.items as CloudSpace[]) {
      const name = cloudSpace.metadata?.name || 'unknown';
      const region = cloudSpace.spec?.region || 'unknown';
      const assignedServers = cloudSpace.status?.assignedServers || {};
      const nodeCount = Object.keys(assignedServers).length;

      this.cloudspaceNodesGauge.set(
        {
          namespace: this.organization,
          cloudspace: name,
          cloudspace_region: region,
        },
        nodeCount
      );
    }
  }

  private async collectSpotNodePoolMetrics(): Promise<void> {
    const spotNodePools = await this.client.listSpotNodePools(this.organization);

    if (!spotNodePools?.items) {
      return;
    }

    for (const pool of spotNodePools.items as SpotNodePool[]) {
      const name = pool.metadata?.name || 'unknown';
      const cloudSpace = pool.spec?.cloudSpace || 'unknown';
      const serverClass = pool.spec?.serverClass || 'unknown';
      const desired = pool.spec?.desired || 0;
      const wonCount = pool.status?.wonCount || 0;
      const bidStatus = pool.status?.bidStatus || 'unknown';

      // Set desired count
      this.spotNodePoolDesiredGauge.set(
        {
          namespace: this.organization,
          cloudspace: cloudSpace,
          nodepool: name,
          serverclass: serverClass,
        },
        desired
      );

      // Set won count
      this.spotNodePoolWonCountGauge.set(
        {
          namespace: this.organization,
          cloudspace: cloudSpace,
          nodepool: name,
          serverclass: serverClass,
          bid_status: bidStatus,
        },
        wonCount
      );
    }
  }

  private async collectOnDemandNodePoolMetrics(): Promise<void> {
    const onDemandNodePools = await this.client.listOnDemandNodePools(this.organization);

    if (!onDemandNodePools?.items) {
      return;
    }

    for (const pool of onDemandNodePools.items as OnDemandNodePool[]) {
      const name = pool.metadata?.name || 'unknown';
      const cloudSpace = pool.spec?.cloudSpace || 'unknown';
      const serverClass = pool.spec?.serverClass || 'unknown';
      const desired = pool.spec?.desired || 0;
      const reservedCount = pool.status?.reservedCount || 0;
      const reservedStatus = pool.status?.reservedStatus || 'unknown';

      // Set desired count
      this.onDemandNodePoolDesiredGauge.set(
        {
          namespace: this.organization,
          cloudspace: cloudSpace,
          nodepool: name,
          serverclass: serverClass,
        },
        desired
      );

      // Set reserved count
      this.onDemandNodePoolReservedCountGauge.set(
        {
          namespace: this.organization,
          cloudspace: cloudSpace,
          nodepool: name,
          serverclass: serverClass,
          reserved_status: reservedStatus,
        },
        reservedCount
      );
    }
  }

  getRegistry(): Registry {
    return this.registry;
  }
}
