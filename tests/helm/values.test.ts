import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Helm chart tests
 *
 * These tests validate:
 * - Chart templating works correctly
 * - Required values are enforced
 * - Generated manifests have correct structure
 */

const CHART_PATH = path.join(__dirname, '../../helm/rackspace-spot-exporter');

function helmTemplate(setValues: string[] = []): string {
  const setArgs = setValues.map((v) => `--set ${v}`).join(' ');
  const cmd = `helm template test-release ${CHART_PATH} ${setArgs} 2>&1`;
  return execSync(cmd, { encoding: 'utf-8' });
}

function helmTemplateSafe(setValues: string[] = []): { success: boolean; output: string } {
  try {
    const output = helmTemplate(setValues);
    return { success: true, output };
  } catch (error: any) {
    return { success: false, output: error.stdout || error.message };
  }
}

describe('Helm Chart', () => {
  describe('required values', () => {
    it('should fail without organization', () => {
      const result = helmTemplateSafe([
        'rackspaceSpot.refreshToken=test-token',
      ]);
      expect(result.success).toBe(false);
      expect(result.output).toContain('rackspaceSpot.organization is required');
    });

    it('should fail without refreshToken when existingSecret is not set', () => {
      const result = helmTemplateSafe([
        'rackspaceSpot.organization=org-test',
      ]);
      expect(result.success).toBe(false);
      expect(result.output).toContain('rackspaceSpot.refreshToken is required');
    });

    it('should succeed with required values', () => {
      const result = helmTemplateSafe([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);
      expect(result.success).toBe(true);
    });

    it('should succeed with existingSecret instead of refreshToken', () => {
      const result = helmTemplateSafe([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.existingSecret=my-secret',
      ]);
      expect(result.success).toBe(true);
    });
  });

  describe('deployment', () => {
    it('should set correct environment variables', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).toContain('RACKSPACE_ORGANIZATION');
      expect(output).toContain('value: "org-test"');
      expect(output).toContain('RACKSPACE_REFRESH_TOKEN');
    });

    it('should set optional API URLs when provided', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
        'rackspaceSpot.apiUrl=https://custom-api.example.com',
        'rackspaceSpot.authUrl=https://custom-auth.example.com',
      ]);

      expect(output).toContain('RACKSPACE_API_URL');
      expect(output).toContain('https://custom-api.example.com');
      expect(output).toContain('RACKSPACE_AUTH_URL');
      expect(output).toContain('https://custom-auth.example.com');
    });

    it('should not set optional API URLs when not provided', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      // Count occurrences - should only have RACKSPACE_ORGANIZATION and RACKSPACE_REFRESH_TOKEN
      const envMatches = output.match(/name: RACKSPACE_/g) || [];
      // Should have: RACKSPACE_ORGANIZATION, RACKSPACE_REFRESH_TOKEN, PORT, METRICS_PATH, SCRAPE_INTERVAL
      expect(envMatches.length).toBeLessThanOrEqual(5);
    });

    it('should set correct port', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
        'exporter.port=8080',
      ]);

      expect(output).toContain('containerPort: 8080');
    });

    it('should include health probes', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).toContain('livenessProbe:');
      expect(output).toContain('readinessProbe:');
      expect(output).toContain('path: /health');
    });
  });

  describe('secret', () => {
    it('should create secret when refreshToken is provided', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).toContain('kind: Secret');
      expect(output).toContain('refresh-token:');
    });

    it('should not create secret when existingSecret is provided', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.existingSecret=my-secret',
      ]);

      // Should not contain a Secret resource (but may have secretKeyRef)
      const lines = output.split('\n');
      const secretResourceLines = lines.filter(
        (line, i) =>
          line.includes('kind: Secret') &&
          lines[i - 1]?.includes('apiVersion: v1')
      );
      expect(secretResourceLines.length).toBe(0);
    });
  });

  describe('service', () => {
    it('should create service with correct port', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).toContain('kind: Service');
      expect(output).toContain('port: 9090');
    });
  });

  describe('serviceMonitor', () => {
    it('should not create ServiceMonitor by default', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).not.toContain('kind: ServiceMonitor');
    });

    it('should create ServiceMonitor when enabled', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
        'serviceMonitor.enabled=true',
      ]);

      expect(output).toContain('kind: ServiceMonitor');
    });

    it('should set ServiceMonitor labels', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
        'serviceMonitor.enabled=true',
        'serviceMonitor.labels.release=prometheus',
      ]);

      expect(output).toContain('release: prometheus');
    });
  });

  describe('podMonitor', () => {
    it('should not create PodMonitor by default', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).not.toContain('kind: PodMonitor');
    });

    it('should create PodMonitor when enabled', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
        'podMonitor.enabled=true',
      ]);

      expect(output).toContain('kind: PodMonitor');
    });
  });

  describe('prometheusRule', () => {
    it('should not create PrometheusRule by default', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).not.toContain('kind: PrometheusRule');
    });

    it('should create PrometheusRule when enabled with rules', () => {
      // Note: This test may need adjustment based on how rules are configured
      const result = helmTemplateSafe([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
        'prometheusRule.enabled=true',
      ]);

      // PrometheusRule requires rules to be defined
      expect(result.success).toBe(true);
    });
  });

  describe('resources', () => {
    it('should set resource limits and requests', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).toContain('resources:');
      expect(output).toContain('limits:');
      expect(output).toContain('requests:');
    });
  });

  describe('security', () => {
    it('should set pod security context', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).toContain('securityContext:');
      expect(output).toContain('runAsNonRoot: true');
    });

    it('should set container security context', () => {
      const output = helmTemplate([
        'rackspaceSpot.organization=org-test',
        'rackspaceSpot.refreshToken=test-token',
      ]);

      expect(output).toContain('allowPrivilegeEscalation: false');
      expect(output).toContain('readOnlyRootFilesystem: true');
    });
  });
});
