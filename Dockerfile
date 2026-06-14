# Stage 1: Build
FROM node:24-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Build Vite frontend
RUN npx vite build

# Bundle Express server with esbuild (--packages=external avoids CJS require() issues in ESM output)
RUN npx esbuild server.ts \
    --bundle \
    --platform=node \
    --format=esm \
    --packages=external \
    --target=es2022 \
    --outfile=dist-server/server.js

# Stage 2: Production
FROM node:24-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Copy package files for npm ci and ESM type declaration
COPY package.json package-lock.json ./

# Install production-only dependencies
RUN npm ci --omit=dev

# Copy build artifacts from Stage 1
COPY --from=build /app/dist-server/server.js ./server.js
COPY --from=build /app/dist ./dist

# Copy runtime config
COPY config.json ./

EXPOSE 3000

CMD ["node", "server.js"]
