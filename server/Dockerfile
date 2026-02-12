# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy shared (server tsconfig includes ../shared)
COPY shared ./shared/
COPY server/package.json server/package-lock.json ./server/
COPY server/tsconfig.json ./server/
COPY server/src ./server/src/

WORKDIR /app/server
RUN npm ci
RUN npm run build

# Run stage
FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001

COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/server/dist ./dist

EXPOSE 3001

# rootDir ".." gives dist/server/src/index.js and dist/shared/*
CMD ["node", "dist/server/src/index.js"]
