# backend/Dockerfile -- the Paystream wallet API as a Node 20 image.
# Multi-stage: one stage installs production dependencies, the second is the
# lean image that actually ships. The image carries its own Node 20, so it runs
# the same on any host regardless of the host's Node version.

# ---- stage 1: install production dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# ---- stage 2: the lean runtime image ----
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY server.js ./
COPY lib ./lib
EXPOSE 3000
USER node
CMD ["node", "server.js"]

