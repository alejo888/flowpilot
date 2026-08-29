FROM node:24-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx ng build --configuration production

FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Self-signed cert so the container also answers on https://localhost. This is
# not for real deploys (TLS terminates upstream there) — it exists so the e2e
# suite can exercise the `Secure` refresh-cookie flow on WebKit, which refuses
# to send `Secure` cookies over plaintext http to localhost.
RUN apk add --no-cache openssl \
    && mkdir -p /etc/nginx/certs \
    && openssl req -x509 -newkey rsa:2048 -nodes -days 3650 \
        -keyout /etc/nginx/certs/local.key -out /etc/nginx/certs/local.crt \
        -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost"

EXPOSE 80 443
