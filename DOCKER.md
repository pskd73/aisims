# Docker build

Build from the **repository root** so `shared/` and each app are in context.

## Server

```bash
docker build -f server/Dockerfile -t aisims-server .
docker run -p 3001:3001 -e PORT=3001 aisims-server
```

## Client

```bash
# Default: client uses http://localhost:3001 for API/WS
docker build -f client/Dockerfile -t aisims-client .

# Point client at a specific server (replace with your server URL)
docker build -f client/Dockerfile --build-arg VITE_SERVER_URL=https://your-api.example.com -t aisims-client .
docker run -p 8080:80 aisims-client
```

Then open http://localhost:8080. If `VITE_SERVER_URL` was not set, the client will try to reach the backend at `http://localhost:3001` (e.g. when the server runs on the host or another container with published port 3001).
