# Production image for the DPA Zambia Compliance Platform.
# Works on any container host with a persistent volume (Render, Fly.io, Railway, a VPS).
# Node 22.23.4 matches the version the test suite runs on; node:sqlite needs Node 22.5 or newer.
FROM node:22.23.4-bookworm-slim

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app

# Install runtime dependencies only (no test, lint or build tooling).
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY server ./server
COPY web ./web
COPY --chmod=755 docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

# The database and encrypted evidence live on a mounted volume at /data. The entrypoint hands it to the
# unprivileged node user and runs the server as that user.
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 3000
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.js"]
