FROM node:20-alpine

WORKDIR /workspace/backend

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend ./
COPY database /workspace/database

RUN chmod +x scripts/*.sh

RUN chown -R node:node /workspace
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:4000/api/v1/health >/dev/null || exit 1

CMD ["./scripts/bootstrap-and-start.sh"]
