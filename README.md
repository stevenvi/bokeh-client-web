# Bokeh Web Client

SvelteKit SPA / PWA for the Bokeh Media Server. Works in any modern browser and can be installed as a home-screen app on iOS and Android.

## Prerequisites

- Node.js 20+
- The Bokeh server running (see `server/` for setup)

## Development

### 1. Install dependencies

```bash
cd client-web
npm install
```

### 2. Start the server

In a separate terminal, start the Go server with CORS enabled for the dev origin:

```bash
cd server
CLIENT_ORIGIN=http://localhost:5173 go run ./cmd/server
```

### 3. Start the dev server

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The dev server proxies `/api` and `/images` to `localhost:3000`, so cookies work without cross-origin issues.

---

## Testing on a mobile device

The server address input in the app lets you point at any host, so you do not need the mobile device and your dev machine to share the same origin — but they do need to be on the same local network.

### 1. Find your machine's local IP

```bash
# macOS
ipconfig getifaddr en0

# Linux
hostname -I | awk '{print $1}'
```

### 2. Expose the dev server on the network

```bash
npm run dev -- --host
```

Vite will print something like:

```
  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.42:5173/
```

### 3. Restart the server with the mobile origin allowed

```bash
CLIENT_ORIGIN=http://192.168.1.42:5173 go run ./cmd/server
```

### 4. Open on the device

Navigate to `http://192.168.1.42:5173` in Safari or Chrome on your phone.

When prompted for the server address inside the app, enter `http://<your-machine-ip>:3000` (the Go server, not the Vite dev server).

> **iOS note:** Safari will offer an "Add to Home Screen" option from the share menu, but PWA service worker installation only works over HTTPS. For full installability during development, consider using a tool like [Caddy](https://caddyserver.com/) or [mkcert](https://github.com/FiloSottile/mkcert) to serve the dev server over a locally-trusted HTTPS connection.

---

## Production build

### 1. Build the static files

```bash
npm run build
```

Output goes to `build/`. It is a plain directory of HTML, JS, CSS, and assets — no Node.js required to serve it.

### 2. Serve it

Any static file server works. The only requirement is that all unmatched paths serve `build/index.html` (SPA fallback).

**Option A — Caddy (recommended)**

```caddy
example.com {
    # Serve the client
    root * /path/to/client-web/build
    try_files {path} /index.html
    file_server

    # Reverse-proxy the API and image endpoints to the Go server
    reverse_proxy /api/* localhost:3000
    reverse_proxy /images/* localhost:3000
}
```

With this setup the client and server share the same origin, so the server should be started without `CLIENT_ORIGIN` (CORS is not needed):

```bash
DEPLOY_ENV=production go run ./cmd/server
```

**Option B — Served by the Go server directly**

Copy the `build/` directory to a location the Go server can read, then configure it to serve static files. This keeps everything on one port without a reverse proxy.

**Option C — Any static host (Netlify, S3, etc.)**

Upload the contents of `build/` and configure the host's 404/fallback to point to `index.html`. You will need the `CLIENT_ORIGIN` set on the Go server and the client will prompt users for the server address.

### 3. HTTPS

The service worker (and therefore PWA installability) requires HTTPS in production. Use a reverse proxy like Caddy that handles TLS automatically, or configure your static host accordingly.

---

## Updating clients

Because this is a PWA with a service worker, users' browsers cache the app shell. After deploying a new build:

- The service worker's `registerType: 'autoUpdate'` will detect the new version on the next page load and update silently.
- Users will be running the new version on their next visit or tab reload.

No user action is required.
