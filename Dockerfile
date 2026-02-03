FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
RUN mkdir -p /temp/dev
COPY package.json bun.lock /temp/dev/
RUN cd /temp/dev && bun install --frozen-lockfile

# Build the app
FROM base AS prerelease
COPY --from=install /temp/dev/node_modules node_modules
COPY . .

# Production image
FROM base AS release
COPY --from=install /temp/dev/node_modules node_modules
COPY --from=prerelease /app/index.ts .
COPY --from=prerelease /app/src ./src
COPY --from=prerelease /app/package.json .

# Create a non-root user
RUN addgroup --system --gid 1001 exporter && \
    adduser --system --uid 1001 exporter
USER exporter

# Expose the default port
EXPOSE 9090

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD bun run -e "fetch('http://localhost:9090/health').then(r => r.ok ? process.exit(0) : process.exit(1))"

# Run the app
ENTRYPOINT ["bun", "run", "index.ts"]
