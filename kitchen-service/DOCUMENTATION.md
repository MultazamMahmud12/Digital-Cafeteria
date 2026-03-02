# Kitchen Service Documentation

## 1) Purpose

`kitchen-service` simulates the kitchen stage of a cafeteria order pipeline.

It consumes newly created orders from RabbitMQ, immediately emits a status update that cooking has started, waits a realistic preparation time, and then emits a final status update that the order is ready.

This service is intentionally asynchronous so user-facing systems can respond quickly while kitchen preparation continues in the background.

---

## 2) What the service does

When a message with routing key `order.created` arrives:

1. Validates payload contains `orderId` as a non-empty string.
2. Publishes `order.status_changed` with status `IN_KITCHEN` immediately.
3. Waits random 3–7 seconds.
4. Publishes `order.status_changed` with status `READY`.
5. Acknowledges the message manually.

Additional runtime behavior:

- Uses `channel.prefetch(1)` so only one message is processed at a time (predictable demo behavior).
- Uses durable exchange/queue and persistent messages for better survivability.
- Maintains in-memory duplicate protection (`Set`) so the same `orderId` is not processed twice during current process lifetime.
- Exposes health and metrics endpoints for observability.
- Supports controlled chaos termination endpoint for resilience demos.
- Performs graceful shutdown on `SIGINT`/`SIGTERM`.

---

## 3) RabbitMQ contract used

### Environment defaults

- `RABBITMQ_URL`: `amqp://rabbitmq:5672`
- `RABBITMQ_EXCHANGE`: `orders.x`
- `RABBITMQ_KITCHEN_QUEUE`: `kitchen.q`

### Topology

- Exchange: `orders.x` (type: `topic`, durable)
- Queue: `kitchen.q` (durable)
- Binding: `kitchen.q` <- `orders.x` with routing key `order.created`

### Outgoing events

Routing key: `order.status_changed`

Payload shape:

```json
{
  "orderId": "string",
  "status": "IN_KITCHEN | READY",
  "timestamp": "ISO-8601"
}
```

Publish options:

- `persistent: true`
- `contentType: application/json`

---

## 4) HTTP API exposed

### `GET /health`

- Returns `200` when RabbitMQ connection is active **and** queue check (`checkQueue`) succeeds.
- Returns `503` when RabbitMQ is unavailable or queue check fails.

### `GET /metrics`

Returns machine-readable JSON:

- `jobs_processed_total`
- `jobs_failed_total`
- `avg_job_latency_ms`
- `http_requests_total`
- `http_failures_total`
- `avg_http_latency_ms`

### `POST /chaos/kill`

- If `ENABLE_CHAOS=true`: returns `202` then exits process with code `1`.
- Otherwise: returns `403`.

---

## 5) File-by-file responsibility

### `package.json`

- Declares runtime dependencies:
  - `express` (HTTP server)
  - `amqplib` (RabbitMQ integration)
- Declares start script: `npm start` -> `node src/index.js`
- Declares Node engine requirement (`>=20`).

### `src/index.js`

Main service implementation:

- Loads env vars and defaults.
- Creates Express app and middleware.
- Connects to RabbitMQ and declares topology.
- Consumes `order.created` and executes kitchen workflow.
- Publishes `order.status_changed` events.
- Tracks metrics.
- Implements `/health`, `/metrics`, `/chaos/kill`.
- Handles reconnect logic when broker disconnects.
- Handles graceful shutdown.

### `Dockerfile`

Containerizes the service:

- Base image: `node:20-alpine`
- Installs production dependencies
- Copies app source
- Exposes port `8083`
- Starts with `npm start`

### `README.md`

Quick-start instructions for local and Docker usage.

---

## 6) Why RabbitMQ is used here

RabbitMQ decouples order creation from kitchen processing.

Benefits in this system:

- **Asynchronous workflow**: API/user flow is not blocked by 3–7 second prep simulation.
- **Loose coupling**: producer services do not need direct kitchen-service calls.
- **Buffering**: queue absorbs bursts of orders.
- **Reliability controls**: durable topology + persistent messages + manual ack.
- **Event-driven updates**: downstream services can react to `order.status_changed`.

---

## 7) Why Docker is used here

Docker provides a reproducible runtime for dependencies (especially RabbitMQ) and, optionally, the service itself.

Benefits:

- No host-level RabbitMQ installation required.
- Same setup steps across developer machines.
- Easy reset (`docker rm -f rabbitmq` and rerun).
- Simplifies demo and CI environment parity.

---

## 8) Runtime environment variables

- `PORT` (default `8083`)
- `RABBITMQ_URL` (default `amqp://rabbitmq:5672`)
- `RABBITMQ_EXCHANGE` (default `orders.x`)
- `RABBITMQ_KITCHEN_QUEUE` (default `kitchen.q`)
- `ENABLE_CHAOS` (default false)

For local Docker RabbitMQ on Windows/macOS/Linux development, use:

- `RABBITMQ_URL=amqp://localhost:5672`

---

## 9) Typical local run sequence

1. Start RabbitMQ (Docker):

```bash
docker run -d --name rabbitmq -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

2. Start kitchen service:

```bash
npm install
RABBITMQ_URL=amqp://localhost:5672 npm start
```

(PowerShell equivalent)

```powershell
$env:RABBITMQ_URL="amqp://localhost:5672"
npm start
```

3. Validate:

- `GET /health` returns 200
- `GET /metrics` returns counters/latencies JSON
- publish `order.created` and observe `IN_KITCHEN` -> `READY`

---

## 10) Important demo limitations

- Duplicate protection uses in-memory `Set` only (resets on restart).
- Not horizontally-safe deduplication (no shared store).
- Failures are acked in current implementation (no retry/dead-letter strategy).

These are acceptable for demo scope but should be upgraded for production.
