# Production Dockerfile for Flux Revenue Tracker
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install system dependencies for better-sqlite3 compilation
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    sqlite \
    sqlite-dev \
    pkgconfig \
    build-base

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install all dependencies with proper environment for better-sqlite3
ENV PYTHON=/usr/bin/python3
RUN npm install --legacy-peer-deps

# Ensure we have the correct adapter version that matches our SvelteKit version
RUN npm install --save-dev @sveltejs/adapter-node@^1.3.1 terser

# Rebuild better-sqlite3 for Alpine Linux
RUN npm rebuild better-sqlite3

# Copy source code
COPY . .

# Create optimized vite config for production (disable problematic ssr externals)
RUN echo 'import { sveltekit } from "@sveltejs/kit/vite";' > vite.config.js && \
    echo 'import { defineConfig } from "vite";' >> vite.config.js && \
    echo '' >> vite.config.js && \
    echo 'export default defineConfig({' >> vite.config.js && \
    echo '  plugins: [sveltekit()],' >> vite.config.js && \
    echo '  build: {' >> vite.config.js && \
    echo '    minify: "terser",' >> vite.config.js && \
    echo '    sourcemap: false,' >> vite.config.js && \
    echo '    rollupOptions: {' >> vite.config.js && \
    echo '      output: {' >> vite.config.js && \
    echo '        manualChunks: undefined' >> vite.config.js && \
    echo '      }' >> vite.config.js && \
    echo '    }' >> vite.config.js && \
    echo '  }' >> vite.config.js && \
    echo '});' >> vite.config.js

# Ensure svelte.config.js uses the correct adapter version
RUN echo 'import adapter from "@sveltejs/adapter-node";' > svelte.config.js && \
    echo '' >> svelte.config.js && \
    echo 'const config = {' >> svelte.config.js && \
    echo '  kit: {' >> svelte.config.js && \
    echo '    adapter: adapter()' >> svelte.config.js && \
    echo '  }' >> svelte.config.js && \
    echo '};' >> svelte.config.js && \
    echo '' >> svelte.config.js && \
    echo 'export default config;' >> svelte.config.js

# Build the application for production
RUN npm run build

# Remove development dependencies to reduce image size
RUN npm prune --production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S sveltekit -u 1001

# Create data directory for SQLite database with proper permissions
RUN mkdir -p /app/data && chown -R sveltekit:nodejs /app/data

# Set ownership of the application
RUN chown -R sveltekit:nodejs /app

# Switch to non-root user
USER sveltekit

# Set production environment variables
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000
ENV ORIGIN=http://localhost:3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/ || exit 1

# Expose the port
EXPOSE 3000

# Start the production server
CMD ["node", "build"]