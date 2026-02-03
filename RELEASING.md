# Release Process

This document describes how to release a new version of the Rackspace Spot Exporter.

## GitHub Repository Setup (One-time)

### 1. Create Production Environment

1. Go to **Settings → Environments → New environment**
2. Name it `production`
3. Check **Required reviewers** and add yourself (or team members)
4. Optionally set **Wait timer** (e.g., 5 minutes) for additional safety

This ensures that any publish workflow will pause and wait for manual approval before pushing images.

### 2. Create Tag Protection Rules

1. Go to **Settings → Rules → Rulesets → New ruleset**
2. Name: `Protect version tags`
3. Enforcement status: **Active**
4. Target: **Tags** → Add target → Include by pattern: `v*`
5. Rules to enable:
   - ✅ Restrict deletions
   - ✅ Restrict updates
   - ✅ Block force pushes
6. Bypass list: Leave empty (or add yourself for emergencies)

This prevents deletion or modification of release tags once pushed.

### 3. Create Branch Protection Rules

1. Go to **Settings → Branches → Add branch protection rule**
2. Branch name pattern: `main`
3. Enable:
   - ✅ Require a pull request before merging
   - ✅ Require status checks to pass before merging
     - Add required checks: `test`, `docker-build`, `helm-lint`
   - ✅ Require branches to be up to date before merging
   - ✅ Do not allow bypassing the above settings

## Release Workflow

### Workflows Overview

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yaml` | Push/PR to main | Runs tests, Docker build, Helm lint |
| `publish.yaml` | Push `v*` tag | Validates version, publishes Docker & Helm to GHCR (requires approval) |
| `release.yaml` | Push `v*` tag | Creates GitHub Release with changelog |

### Creating a Release

1. **Update version in package.json**
   ```bash
   # Edit package.json and change "version": "0.1.0" to new version
   ```

2. **Commit the version bump**
   ```bash
   git add package.json
   git commit -m "chore: bump version to 0.2.0"
   git push origin main
   ```

3. **Wait for CI to pass** on the main branch

4. **Create and push the tag**
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

5. **Approve the deployment**
   - Go to **Actions → Publish** workflow run
   - Click **Review deployments**
   - Select `production` environment
   - Click **Approve and deploy**

6. **Verify the release**
   - Check **Packages** for the new Docker image
   - Check **Releases** for the GitHub Release
   - Test installation:
     ```bash
     helm pull oci://ghcr.io/pm990320/charts/rackspace-spot-exporter --version 0.2.0
     ```

## Version Format

Versions must follow [Semantic Versioning](https://semver.org/):
- `1.0.0` - Stable release
- `1.0.0-beta.1` - Pre-release (marked as pre-release on GitHub)
- `1.0.0-rc.1` - Release candidate

## Artifacts Published

On each release:
- **Docker image**: `ghcr.io/pm990320/rackspace-spot-exporter:VERSION`
- **Helm chart**: `oci://ghcr.io/pm990320/charts/rackspace-spot-exporter:VERSION`
- **GitHub Release**: With auto-generated changelog

## Troubleshooting

### Tag version doesn't match package.json
The publish workflow validates that the tag version matches `package.json`. Update package.json first, then tag.

### Publish workflow stuck waiting
Go to Actions, find the workflow run, and click "Review deployments" to approve.

### Need to re-release a version
Due to tag protection, you cannot overwrite tags. Instead:
1. Create a new patch version (e.g., `v0.2.1` instead of re-releasing `v0.2.0`)
2. Or ask an admin to temporarily disable the tag ruleset
