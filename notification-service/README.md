# notification-service

Node.js notification microservice for cafeteria demo.

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start service:

```bash
npm start
```

## Environment variables

- `PORT` (default: `8084`)
- `RABBITMQ_URL` (default: `amqp://rabbitmq:5672`)
- `RABBITMQ_EXCHANGE` (default: `orders.x`)
- `RABBITMQ_NOTIFY_QUEUE` (default: `notify.q`)
- `ENABLE_CHAOS` (default: `false`)

## Endpoints

- `GET /health`
- `GET /metrics`
- `POST /chaos/kill`
- `WS /ws`

## Docker

```bash
docker build -t notification-service .
docker run --rm -p 8084:8084 --env RABBITMQ_URL=amqp://rabbitmq:5672 notification-service
```
