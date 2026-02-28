# kitchen-service

Node.js kitchen microservice for the cafeteria demo.

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

- `PORT` (default: `8083`)
- `RABBITMQ_URL` (default: `amqp://rabbitmq:5672`)
- `RABBITMQ_EXCHANGE` (default: `orders.x`)
- `RABBITMQ_KITCHEN_QUEUE` (default: `kitchen.q`)
- `ENABLE_CHAOS` (default: `false`)

## Endpoints

- `GET /health`
- `GET /metrics`
- `POST /chaos/kill`

## Docker

```bash
docker build -t kitchen-service .
docker run --rm -p 8083:8083 --env RABBITMQ_URL=amqp://rabbitmq:5672 kitchen-service
```
