FROM node:20-alpine AS build
WORKDIR /app
COPY backend/package*.json ./
RUN npm ci --no-audit --no-fund
COPY backend/tsconfig.json ./
COPY backend/src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium-browser
RUN apk add --no-cache ca-certificates chromium wget
COPY backend/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY --from=build /app/dist ./dist
COPY public/fonts ./assets/fonts
COPY public/favicon.svg ./assets/favicon.svg
COPY public/images/orenza-logo.png ./assets/orenza-logo.png
COPY public/images ./public-images-default
EXPOSE 8787
CMD ["sh", "-c", "cp -R -n /app/public-images-default/. /app/public/images/ && node dist/migrate.js && node dist/server.js"]
