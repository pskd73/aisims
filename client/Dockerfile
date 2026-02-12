# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Optional: set at build time to point client to your server (e.g. https://api.example.com or http://server:3001)
ARG VITE_SERVER_URL=
ENV VITE_SERVER_URL=${VITE_SERVER_URL}

COPY shared ./shared/
COPY client/package.json client/package-lock.json ./client/
COPY client/tsconfig.json client/tsconfig.node.json ./client/
COPY client/vite.config.ts client/index.html client/nginx.conf ./client/
COPY client/src ./client/src/

WORKDIR /app/client
RUN npm ci
RUN npm run build

# Serve stage
FROM nginx:alpine

# Remove default static content
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets from builder
COPY --from=builder /app/client/dist /usr/share/nginx/html

# SPA fallback: serve index.html for client routes
COPY --from=builder /app/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
