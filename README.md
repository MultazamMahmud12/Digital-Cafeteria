# Digital Cafeteria - Microservices Platform

A resilient, cloud-native cafeteria management system built with microservices architecture to handle high-volume meal orders during peak hours.

---

##  Quick Start

### Prerequisites
- **Docker Desktop** (24.x+)
- **Git**

### Run the System

```bash
# Clone repository
git clone <repository-url>
cd "Digital Cafeteria"

# Start all services (one command!)
docker compose up --build

# Access the application
# Student Dashboard: http://localhost:8085/student
# Admin Dashboard: http://localhost:8085/admin
```

**That's it!** All 8 services start automatically.

---

## 🔧 Troubleshooting

### If a Service Fails to Start

**Step 1: Check which service failed**
```bash
docker compose ps
# Look for services with "Exit" status instead of "Up"
```

**Step 2: View service logs**
```bash
docker compose logs <service-name>
# Example: docker compose logs gateway-service
```

**Step 3: Try these fixes**

| Issue | Solution |
|-------|----------|
| **Port already in use** | `docker compose down` then change port in `docker-compose.yml` or stop conflicting process |
| **MongoDB connection failed** | Wait 10-15s for MongoDB to initialize, then: `docker compose restart <service-name>` |
| **RabbitMQ not ready** | Wait 10-15s for RabbitMQ to initialize, then: `docker compose restart kitchen-service notification-service` |
| **Build error** | `docker compose down` → `docker compose up --build` |
| **Service crash loop** | Check logs for error, fix code, then: `docker compose up -d --build <service-name>` |

**Step 4: Restart specific service**
```bash
# Rebuild and restart
docker compose up -d --build <service-name>

# Or just restart (no rebuild)
docker compose restart <service-name>
```

**Step 5: Nuclear option (if all else fails)**
```bash
docker compose down              # Stop everything
docker compose up --build        # Rebuild all images and start fresh
```

**Still stuck?** Check [DEPENDENCIES_DOCUMENTATION.md](DEPENDENCIES_DOCUMENTATION.md) for detailed troubleshooting

---

## 🎯 What This System Does

### The Problem We Solve
- **Overselling**: Prevents stock going negative during 100+ concurrent orders
- **Database Overload**: Redis cache protects database (90% faster stock checks)
- **Poor User Experience**: Real-time order tracking (no page refresh)
- **System Failures**: Services fail gracefully (orders never lost)
- **Security**: JWT authentication for all orders

### Key Features
✅ **<2 Second** order acknowledgment  
✅ **<10ms** cache-based stock rejection  
✅ **Real-Time** WebSocket status updates  
✅ **Async Processing** via RabbitMQ (orders survive crashes)  
✅ **Optimistic Locking** prevents race conditions  
✅ **Rate Limiting** (3 login attempts/minute)  
✅ **Health Monitoring** for all services  

---

## 🏗️ Architecture

### Microservices (5)
| Service | Port | Responsibility |
|---------|------|---------------|
| **Auth Service** | 8081 | JWT authentication, rate limiting |
| **Gateway Service** | 8080 | Order entry, Redis cache, token validation |
| **Stock Service** | 8082 | Inventory management, optimistic locking |
| **Kitchen Service** | 8083 | Async order processing (RabbitMQ consumer) |
| **Notification Service** | 8084 | Real-time WebSocket updates |
| **Frontend** | 8085 | React UI (Student & Admin dashboards) |

### Infrastructure (3)
- **MongoDB Atlas** (Cloud) - Persistent storage
- **Redis** (7.x) - Fast cache layer
- **RabbitMQ** (3.x) - Message broker

---

## 🛠️ Technology Stack

| Layer | Technology | Why? |
|-------|-----------|------|
| **Frontend** | React + Vite + Tailwind | Fast dev, component reusability, responsive design |
| **Backend** | Node.js + TypeScript | Async I/O (100+ concurrent orders), type safety |
| **Database** | MongoDB Atlas | Flexible schema, embedded documents, cloud-managed |
| **Cache** | Redis | 5-10ms response (vs 80-120ms DB query) |
| **Message Queue** | RabbitMQ | Message durability (orders survive crashes) |
| **Auth** | JWT | Stateless, microservices-friendly |
| **Real-Time** | WebSocket | <500ms updates (vs 2-5s polling) |
| **Containers** | Docker Compose | One-command deployment |

**Full justification**: See [STACK_REPORT.md](STACK_REPORT.md)

---

## 🎪 Resilience Demo

Our system continues working even when services fail. Watch orders flow through the system while killing services!

### Demo Scenarios
1. **Notification Service Down** → Orders still accepted & processed
2. **Kitchen Service Down** → Orders queued in RabbitMQ (no loss)
3. **Multiple Failures** → Graceful degradation
4. **Redis Fast Reject** → Out-of-stock items rejected in <10ms

**Step-by-step guide**: See [DEMO_RESILIENCE.md](DEMO_RESILIENCE.md)

**Quick Test**:
```bash
# Kill notification service
curl -X POST http://localhost:8084/chaos/kill

# Place order (still works!)
curl -X POST http://localhost:8080/order \
  -H "Authorization: Bearer <token>" \
  -d '{"items":[{"itemId":"biryani_veg","quantity":1}]}'

# Restart when ready
docker start notification-service
```

---

## 📋 Key Properties & Patterns

### 1. Cache-Aside Pattern (Redis)
```
Order Request → Check Redis Cache
  ├─ OUT_OF_STOCK → Reject (10ms)
  └─ NOT_CACHED → Query DB → Cache result (120ms)
```
**Benefit**: 90% fewer database queries during peak hours

### 2. Optimistic Locking (MongoDB)
```javascript
{
  name: "biryani_veg",
  stock: 10,
  version: 5  // Increment on every update
}
// Update fails if version mismatch → retry
```
**Benefit**: Prevents overselling during concurrent orders

### 3. Async Processing (RabbitMQ)
```
Gateway → RabbitMQ Queue → Kitchen Service
(2s response)    (durable)    (3-7s processing)
```
**Benefit**: Fast user feedback + decoupled services

### 4. Event-Driven Notifications (WebSocket)
```
Kitchen → RabbitMQ → Notification Service → WebSocket → UI
```
**Benefit**: Real-time updates without polling

### 5. Manual Restart Control (Demo)
```yaml
# docker-compose.yml
services:
  kitchen-service:
    # NO restart policy (stays down when killed)
```
**Benefit**: Full control for resilience demonstration

---

## 🧪 Testing & CI/CD

### Automated Testing (GitHub Actions)
Every push triggers:
- ✅ **ESLint** - Code quality checks
- ✅ **Jest Unit Tests** - Order validation, stock deduction, auth, rate limiting
- ✅ **Code Coverage** - 80%+ required
- ✅ **TypeScript Build** - Stock service compilation

**Workflow files**: `.github/workflows/gateway-service-ci.yml`, `.github/workflows/stock-service-ci.yml`

### Manual Testing
```bash
# Health checks
curl http://localhost:8081/health  # Auth
curl http://localhost:8080/health  # Gateway
curl http://localhost:8082/health  # Stock

# End-to-end flow
# 1. Register → 2. Login → 3. Place Order → 4. Track Status
```

---

## 📊 Performance Metrics

| Operation | Response Time | Technology |
|-----------|--------------|-----------|
| Order Acknowledgment | <2 seconds | Node.js async I/O |
| Cache Hit (Stock Check) | 5-10ms | Redis in-memory |
| Cache Miss (DB Query) | 80-120ms | MongoDB Atlas transaction |
| Kitchen Processing | 3-7 seconds | RabbitMQ + async worker |
| Status Update | <500ms | WebSocket push |

**Handles**: 100+ concurrent orders without overselling

---

## 🛠️ Common Commands

```bash
# ── SERVICE MANAGEMENT ──
docker compose up -d                  # Start all
docker compose down                   # Stop all
docker compose ps                     # Check status
docker compose logs -f <service>      # View logs
docker compose restart <service>      # Restart service
docker compose up -d --build <service> # Rebuild service

# ── HEALTH CHECKS ──
curl http://localhost:8080/health     # Gateway
curl http://localhost:8082/health     # Stock
curl http://localhost:8083/health     # Kitchen

# ── DATABASE/CACHE ──
docker compose exec redis redis-cli                    # Redis CLI
docker compose exec mongodb mongosh                    # MongoDB CLI
docker compose exec rabbitmq rabbitmqctl list_queues   # RabbitMQ queues

# RabbitMQ UI: http://localhost:15672 (guest/guest)
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| **[DEMO_RESILIENCE.md](DEMO_RESILIENCE.md)** | Complete resilience demonstration guide (4 demo scenarios) |
| **[STACK_REPORT.md](STACK_REPORT.md)** | Technology stack justification and alternatives considered |
| **[REQUIREMENT_ANALYSIS.md](REQUIREMENT_ANALYSIS.md)** | Project goals, user stories, constraints, success criteria |
| **[DEPENDENCIES_DOCUMENTATION.md](DEPENDENCIES_DOCUMENTATION.md)** | Dependencies, API docs, troubleshooting, commands |

---

## 🎯 Success Criteria

✅ Student can login → place order → see real-time status updates  
✅ Out-of-stock items rejected instantly (<10ms from cache)  
✅ Orders acknowledged in <2 seconds  
✅ System handles 100+ concurrent orders without overselling  
✅ Services can be killed/restarted without losing orders  
✅ Admin dashboard shows real-time service health  
✅ All unit tests pass in CI pipeline  
✅ System starts with single `docker compose up --build` command

---

## 📁 Project Structure

```
Digital Cafeteria/
├── auth-service/           # JWT authentication, rate limiting
├── order-gatewar-service/  # Order gateway, Redis cache, RabbitMQ publisher
├── stock-service/          # TypeScript, inventory management, optimistic locking
├── kitchen-service/        # RabbitMQ consumer, async processing
├── notification-service/   # WebSocket, real-time updates
├── frontend/               # React + Vite + Tailwind
├── docker-compose.yml      # Orchestration (8 services)
├── .github/workflows/      # CI/CD pipelines
├── DEMO_RESILIENCE.md      # Resilience demonstration guide
├── STACK_REPORT.md         # Technology justification
└── README.md               # This file
```

---

## 🚦 Getting Started Checklist

- [ ] Install Docker Desktop
- [ ] Clone repository
- [ ] Run `docker compose up --build`
- [ ] Access http://localhost:8085
- [ ] Register a student account
- [ ] Place your first order
- [ ] Watch real-time status updates
- [ ] Try killing services (resilience demo)
- [ ] Check health monitoring in admin dashboard

---

## 📞 Support

**Issues?**
1. Check service logs: `docker compose logs <service-name>`
2. Verify health: `curl http://localhost:<port>/health`
3. Review troubleshooting guide in [DEPENDENCIES_DOCUMENTATION.md](DEPENDENCIES_DOCUMENTATION.md)

**Questions about architecture?** → See [STACK_REPORT.md](STACK_REPORT.md)  
**Want to demo resilience?** → Follow [DEMO_RESILIENCE.md](DEMO_RESILIENCE.md)

---

**Built with ❤️ for resilient, scalable cafeteria management**

**Version**: 1.0 | **Date**: March 2, 2026
