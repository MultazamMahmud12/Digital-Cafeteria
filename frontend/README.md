# frontend

React + Express frontend for the cafeteria microservice demo.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start server:

```bash
npm start
```

3. Open pages:

- Student: `http://localhost:8085/student`
- Admin: `http://localhost:8085/admin`

## Runtime config endpoint

- `GET /config`

Returns:

- `identityBaseUrl`, `identityLoginPath`
- `gatewayBaseUrl`, `gatewayOrderPath`
- `notificationWsUrl`
- `services` list for admin dashboard checks

## Environment variables

- `PORT` (default: `8085`)
- `PUBLIC_IDENTITY_URL` (default: `http://localhost:8081`)
- `PUBLIC_GATEWAY_URL` (default: `http://localhost:8080`)
- `PUBLIC_STOCK_URL` (default: `http://localhost:8082`)
- `PUBLIC_KITCHEN_URL` (default: `http://localhost:8083`)
- `PUBLIC_NOTIFICATION_URL` (default: `http://localhost:8084`)
- `PUBLIC_NOTIFICATION_WS_URL` (default: `ws://localhost:8084/ws`)

## Docker

```bash
docker build -t cafeteria-frontend .
docker run --rm -p 8085:8085 cafeteria-frontend
```
