FROM node:20-alpine AS builder

WORKDIR /app
COPY package.json package-lock.json* .npmrc ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* vars are baked into the client bundle at build time, not
# read at runtime — this one is a fixed relative path regardless of
# environment (client calls always go through this app's own /api proxy
# route, which reads EC2_API_URL server-side at request time instead).
ENV NEXT_PUBLIC_API_URL=/api
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
