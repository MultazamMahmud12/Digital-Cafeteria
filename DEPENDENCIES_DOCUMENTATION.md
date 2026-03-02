# Dependencies & Documentation

**Project**: Digital Cafeteria Microservices Platform  
**Date**: March 2, 2026

---

## Quick Start

### Prerequisites
- **Docker Desktop** (24.x or higher) - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** (for cloning repository)

### Installation & Run

```bash
# 1. Clone the repository
git clone <repository-url>
cd "Digital Cafeteria"

# 2. Start all services (builds images + runs containers)
docker compose up --build

# 3. Access the application
# Frontend: http://localhost:8085
# Admin Dashboard: http://localhost:8085/admin
# Student Dashboard: http://localhost:8085/student
```

**That's it!** All 8 services (5 microservices + 3 infrastructure) start automatically.

**Note**: Environment variables are configured in `docker-compose.yml` (no separate `.env` files needed).

---

## Troubleshooting

### If a Service Fails to Start

**Check service status:**
```bash
docker compose ps
```

**View service logs:**
```bash
docker compose logs <service-name>
# Example: docker compose logs gateway-service
```

**Restart specific service:**
```bash
# Rebuild and restart
docker compose up -d --build <service-name>

# Or restart without rebuild
docker compose restart <service-name>
```

**Common Issues:**

| Issue | Solution |
|-------|----------|
| **Port already in use** | Stop process using port or change port in `docker-compose.yml` |
| **MongoDB connection failed** | Wait 10s for MongoDB to initialize, then restart service |
| **RabbitMQ not ready** | Wait 10-15s for RabbitMQ to initialize, then restart dependent services |
| **Build failed** | Run `docker compose down` then `docker compose up --build` |

---

## System Dependencies

| Service | Key Dependencies | Purpose |
|---------|-----------------|---------|
| **auth-service** | express, mongoose, jsonwebtoken, bcrypt, express-rate-limit | Authentication, JWT tokens, rate limiting |
| **gateway-service** | express, ioredis, amqplib, axios, mongoose | Order gateway, Redis cache, RabbitMQ publisher |
| **stock-service** | express, mongoose, typescript | Inventory management, optimistic locking |
| **kitchen-service** | amqplib, axios, mongoose | Async order processing, RabbitMQ consumer |
| **notification-service** | ws (WebSocket), amqplib, mongoose | Real-time WebSocket updates, RabbitMQ consumer |
| **frontend** | react, react-router-dom, axios, vite, tailwindcss | Student & Admin UI |

**Infrastructure**: MongoDB Atlas (cloud), Redis 7.x (cache), RabbitMQ 3.x (message broker)

---

## Common Commands

### Service Management
```bash
# Start all services
docker compose up -d

# Stop all services
docker compose down

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f gateway-service

# Restart service
docker compose restart gateway-service

# Rebuild service
docker compose up -d --build gateway-service

# Check service status
docker compose ps

# Stop specific service
docker compose stop gateway-service

# Start specific service
docker compose start gateway-service
```

### Database Operations
```bash
# Access MongoDB (local container)
docker compose exec mongodb mongosh

# Access MongoDB Atlas (via stock-service)
docker compose exec stock-service node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(() => console.log('Connected'));"

# Access Redis CLI
docker compose exec redis redis-cli
```

### RabbitMQ Operations
```bash
# Check queue status
docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged

# Access RabbitMQ Management UI
# Open: http://localhost:15672
# Username: guest
# Password: guest
```

### Cache Operations
```bash
# Check cached stock status
docker compose exec redis redis-cli GET "stock_status_biryani_veg"

# List all cached keys
docker compose exec redis redis-cli KEYS "stock_status_*"

# Clear all cache
docker compose exec redis redis-cli FLUSHALL
```

---

## Development Workflow

### 1. Initial Setup
```bash
git clone <repository-url>
cd "Digital Cafeteria"
docker compose up --build
```

### 2. Making Changes
```bash
# Edit code in your IDE
# Rebuild affected service
docker compose up -d --build <service-name>
```

### 3. Running Tests
```bash
# Gateway service tests
cd order-gatewar-service
npm test

# Stock service tests
cd stock-service
npm test

# Auth service tests
cd auth-service
npm test
```

### 4. Viewing Logs
```bash
# Real-time logs for debugging
docker compose logs -f gateway-service kitchen-service notification-service
```

---

## Testing the System

### 1. Health Check
```bash
# Check all services are healthy
curl http://localhost:8081/health  # Auth
curl http://localhost:8080/health  # Gateway
curl http://localhost:8082/health  # Stock
curl http://localhost:8083/health  # Kitchen
curl http://localhost:8084/health  # Notification
```

### 2. User Flow Test
```bash
# 1. Register user
curl -X POST http://localhost:8081/auth/register \
  -H "Content-Type: application/json" \
  -d '{"studentId":"TEST001","name":"Test User","email":"test@uni.edu","password":"pass123"}'

# 2. Login
curl -X POST http://localhost:8081/auth/login \
  -H "Content-Type: application/json" \
  -d '{"studentId":"TEST001","password":"pass123"}'

# 3. Place order (use token from login)
curl -X POST http://localhost:8080/order \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"items":[{"itemId":"biryani_veg","quantity":1}]}'
```

### 3. Resilience Test
```bash
# Kill notification service
curl -X POST http://localhost:8084/chaos/kill

# Place order (should still work)
curl -X POST http://localhost:8080/order \
  -H "Authorization: Bearer <token>" \
  -d '{"items":[{"itemId":"biryani_veg","quantity":1}]}'

# Restart notification service
docker start notification-service
```

---

## CI/CD Pipeline

GitHub Actions automatically runs on every push to validate code quality and functionality:

### What We Test
1. **Code Quality**: ESLint checks for syntax errors and code style violations
2. **Unit Tests**: Jest runs automated test suites including:
   - **Order Validation**: Reject invalid item IDs, quantities ≤ 0
   - **Stock Deduction**: Prevent negative stock, handle concurrent updates (optimistic locking)
   - **Authentication**: Reject expired/invalid JWT tokens
   - **Rate Limiting**: Block after 3 failed login attempts
3. **Code Coverage**: Minimum 80% coverage required (fails build if below threshold)
4. **Build Verification**: TypeScript compilation for stock-service

### Pipeline Status
- ✅ **Pass**: Code can be merged to main branch
- ❌ **Fail**: Build blocks until tests pass

**Workflow Files**:
- `.github/workflows/gateway-service-ci.yml` (Order & Auth tests)
- `.github/workflows/stock-service-ci.yml` (Stock & TypeScript tests)

---

## Support

For issues or questions:
1. Check service logs: `docker compose logs <service-name>`
2. Verify service health: `curl http://localhost:<port>/health`
3. Review [DEMO_RESILIENCE.md](DEMO_RESILIENCE.md) for demo scenarios
4. Review [STACK_REPORT.md](STACK_REPORT.md) for architecture details

