FROM node:24-alpine

ARG FASTTRACK_VERSION=2.2.0

RUN addgroup -S -g 10001 fasttrack \
 && adduser -S -D -H -u 10001 -G fasttrack -s /sbin/nologin fasttrack \
 && mkdir -p /app /data /backups \
 && chown -R fasttrack:fasttrack /app /data /backups

WORKDIR /app
COPY --chown=fasttrack:fasttrack backend ./backend
COPY --chown=fasttrack:fasttrack public ./public
COPY --chown=fasttrack:fasttrack package.json package-lock.json ./

ENV NODE_ENV=production \
    PORT=8080 \
    DB_PATH=/data/fasttrack.db \
    LEGACY_DATA_DIR=/data/app_data \
    BACKUP_DIR=/backups \
    FASTTRACK_VERSION=${FASTTRACK_VERSION}

VOLUME ["/data", "/backups"]
EXPOSE 8080
USER fasttrack

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "backend/server.js"]
