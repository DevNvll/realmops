FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Install dependencies first (for better caching)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy built frontend assets
COPY --from=builder /app/dist ./dist

# Copy server files
COPY --from=builder /app/server ./server

# Copy package files for production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Install production dependencies only (includes tsx for running TypeScript)
RUN pnpm install --prod --frozen-lockfile

# Create data directory for auth database
RUN mkdir -p /app/data

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

EXPOSE 3000

# Run the combined server (auth + static files)
CMD ["node", "--import", "tsx", "server/index.ts"]
