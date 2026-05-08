FROM node:20-alpine

WORKDIR /workspace/backend

COPY backend/package*.json ./
RUN npm install

COPY backend ./
COPY database /workspace/database

RUN chmod +x scripts/*.sh

EXPOSE 4000

CMD ["./scripts/bootstrap-and-start.sh"]
