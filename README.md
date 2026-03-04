# Digital Cafeteria

Microservices-based cafeteria platform with authentication, order intake, inventory control, kitchen processing, and real-time notifications.

## Main Services

| Service | Folder | Container | Internal Port | Host Port | Purpose |
|---|---|---|---:|---:|---|
| Identity Service | `auth-service` | `identity-service` | 3001 | 8081 | Register/login users, JWT, auth metrics |
| Gateway Service | `order-gatewar-service` | `gateway-service` | 3000 | 8090 | Entry point for orders, JWT validation, Redis checks, RabbitMQ publish |
| Stock Service | `stock-service` | `stock-service` | 8082 | 8082 | Inventory and stock deduction logic |
| Kitchen Service | `kitchen-service` | `kitchen-service` | 8083 | 8083 | Consumes order events and processes kitchen workflow |
| Notification Service | `notification-service` | `notification-service` | 8084 | 8084 | Consumes events and pushes real-time updates (WebSocket) |
| Frontend | `frontend` | `frontend` | 8085 | 8085 | Student/Admin UI and dashboard |

## Bonus Challenges Status

- ✅ **Visual Alerts**: Implemented in Admin Dashboard (alerts when Gateway average latency exceeds 1000ms over ~30 seconds).
- ✅ **Rate Limiting**: Implemented in Identity Service (limits a Student ID to 3 login attempts per minute).

## Infrastructure Services

| Service | Container | Host Port(s) | Purpose |
|---|---|---|---|
| MongoDB | `mongo` | 27017 | Primary data store |
| Redis | `redis` | 6379 | Caching and fast stock checks |
| RabbitMQ | `rabbitmq` | 5672, 15672 | Message broker and management UI |

RabbitMQ management UI: `http://localhost:15672` (default login `guest/guest`).

## Prerequisites

- Docker Desktop (recommended latest stable)
- Git
- Node.js 20+ (only needed for running services without Docker)

## Quick Start (Recommended)

```bash
git clone https://github.com/MultazamMahmud12/Digital-Cafeteria
cd Digital-Cafeteria
docker compose up --build
```

Open:
- Student UI: `http://localhost:8085/student`
- Admin UI: `http://localhost:8085/admin`

Stop everything:

```bash
docker compose down
```

## Endpoints and URLs

| Component | URL |
|---|---|
| Identity Service | `http://localhost:8081` |
| Gateway Service | `http://localhost:8090` |
| Stock Service | `http://localhost:8082` |
| Kitchen Service | `http://localhost:8083` |
| Notification Service | `http://localhost:8084` |
| Frontend | `http://localhost:8085` |
| RabbitMQ UI | `http://localhost:15672` |

## How the Flow Works

1. User authenticates through Identity Service.
2. Frontend sends order request to Gateway Service.
3. Gateway validates token and checks stock/cache signals.
4. Gateway publishes order event to RabbitMQ (`orders.x`).
5. Kitchen and Notification services consume events asynchronously.
6. Notification service pushes status updates to clients via WebSocket.

## Environment Notes

Configuration for all services is defined in `docker-compose.yml`.

Important env groups used by services:
- Auth/identity: `JWT_SECRET`, `MONGO_URI`, Redis connection settings
- Gateway: `JWT_SECRET`, service URLs (`STOCK_SERVICE_URL`, `IDENTITY_SERVICE_URL`), RabbitMQ settings
- Stock: `MONGO_URI`, `REDIS_URL`, RabbitMQ settings
- Kitchen/Notification: RabbitMQ URL, exchange, queue names
- Frontend: `PUBLIC_*` URLs and `PUBLIC_NOTIFICATION_WS_URL`

If you need local customization, adjust `docker-compose.yml` values (or service-specific `.env` files where applicable).

## Running a Single Service Locally (Without Compose)

Install dependencies and run from each service folder.

### Identity Service

```bash
cd auth-service
npm install
npm run start
```

### Gateway Service

```bash
cd order-gatewar-service
npm install
npm run start
```

### Stock Service

```bash
cd stock-service
npm install
npm run build
npm run start
```

### Kitchen Service

```bash
cd kitchen-service
npm install
npm run start
```

### Notification Service

```bash
cd notification-service
npm install
npm run start
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Testing

Run tests per service:

```bash
cd auth-service && npm test
cd order-gatewar-service && npm test
cd stock-service && npm test
```

## Useful Docker Commands

```bash
docker compose ps
docker compose logs -f <service-name>
docker compose restart <service-name>
docker compose up -d --build <service-name>
docker compose exec redis redis-cli
docker compose exec mongodb mongosh
```

## Troubleshooting

- Port conflict: stop conflicting process or change mapped port in `docker-compose.yml`.
- Service exits: check logs with `docker compose logs <service-name>`.
- Broker not ready: wait for RabbitMQ healthcheck, then restart dependent services.
- DB/cache readiness: allow MongoDB/Redis to pass healthchecks before retrying.

## Repository Structure

```text
Digital-Cafeteria/
├── auth-service/
├── order-gatewar-service/
├── stock-service/
├── kitchen-service/
├── notification-service/
├── frontend/
├── docker-compose.yml
└── README.md
```

## Additional Documentation

- `DEPENDENCIES_DOCUMENTATION.md`
- `DEMO_RESILIENCE.md`
- `REQUIREMENT_ANALYSIS.md`
- `STACK_REPORT.md`

---

Last updated: March 4, 2026
