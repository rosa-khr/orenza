FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
  if [ -f /run/secrets/npm_ca ]; then npm config set cafile /run/secrets/npm_ca; fi \
  && npm install --no-audit --no-fund
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://127.0.0.1/ || exit 1
