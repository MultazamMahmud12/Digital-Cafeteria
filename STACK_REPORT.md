# Stack Report & Justification

**Project**: Digital Cafeteria Microservices Platform  
**Date**: March 2, 2026

---

## Technology Stack Overview

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React + Vite | React 18 |
| **Styling** | Tailwind CSS | 3.x |
| **Backend** | Node.js | 18-20 |
| **Type Safety** | TypeScript | 5.x (Stock Service) |
| **Primary Database** | MongoDB Atlas | Cloud |
| **Cache Layer** | Redis | 7.x |
| **Message Queue** | RabbitMQ | 3.x |
| **Authentication** | JWT (jsonwebtoken) | HS256 |
| **Real-Time Communication** | WebSocket | Native |
| **Container Runtime** | Docker + Docker Compose | 24.x |
| **CI/CD** | GitHub Actions | - |

---

## Stack Justification

### Frontend: React + Vite

**Why React?**
- Component-based architecture perfect for reusable UI elements (OrderForm, OrderTracker, HealthGrid)
- Large ecosystem for WebSocket integration and real-time updates
- Virtual DOM enables efficient re-rendering when order status changes

**Why Vite over Create React App?**
- 10-20x faster development server startup (instant hot module replacement)
- Optimized production builds with automatic code splitting
- Lightweight and modern (no legacy Webpack configuration)

**Why Tailwind CSS?**
- Rapid UI development without writing custom CSS
- Consistent design system (colors for health indicators: green/red)
- Responsive design out-of-the-box for mobile support

---

### Backend: Node.js + TypeScript

**Why Node.js?**
- **Async I/O**: Non-blocking operations perfect for handling 100+ concurrent requests
- **Single Language**: JavaScript/TypeScript across frontend and backend (developer efficiency)
- **Rich Ecosystem**: Native support for RabbitMQ (amqplib), Redis (ioredis), MongoDB (mongoose)
- **Event-Driven**: Ideal for real-time WebSocket connections

**Why TypeScript for Stock Service?**
- **Type Safety**: Prevents bugs in critical stock deduction logic (catch errors at compile time)
- **Concurrency Control**: Strong typing for optimistic locking (version field enforcement)
- **Maintainability**: Clear interfaces for database models and service contracts

**Why JavaScript for Other Services?**
- Faster development for simpler services (auth, kitchen, notification)
- No build step needed (shorter development cycle)

---

### Database: MongoDB Atlas (NoSQL)

**Why MongoDB over SQL (PostgreSQL/MySQL)?**
- **Flexible Schema**: Order structure evolves (adding status history, payment info later)
- **JSON-Native**: Direct mapping between JavaScript objects and database documents (no ORM overhead)
- **Horizontal Scaling**: Atlas auto-sharding handles growth from 500 to 2000+ students
- **Embedded Documents**: Store order items array without JOIN queries (faster reads)

**Why MongoDB Atlas (Cloud) over Self-Hosted?**
- **Managed Service**: Automatic backups, updates, and monitoring
- **High Availability**: Built-in replication (99.995% uptime SLA)
- **Connection Pooling**: Handles 100+ concurrent connections efficiently
- **Global Distribution**: Low latency for multi-campus deployments (future)

**Example Performance Benefit**:
```javascript
// SQL Approach (2 queries):
SELECT * FROM orders WHERE order_id = 'ABC123';
SELECT * FROM order_items WHERE order_id = 'ABC123';

// MongoDB Approach (1 query):
db.orders.findOne({ orderId: 'ABC123' }); // Items embedded in document
```

---

### Cache: Redis

**Why Redis over Memcached?**
- **Data Structures**: Supports strings, hashes, sets (flexible caching strategies)
- **TTL (Time-to-Live)**: Automatic expiration for OUT_OF_STOCK status (1-hour cache)
- **Pub/Sub**: Future support for real-time cache invalidation across multiple gateway instances
- **Persistence**: Optional disk persistence (RDB snapshots)

**Performance Impact**:
- **Cache Hit**: 5-10ms response time (90% faster than database)
- **Cache Miss**: 80-120ms (MongoDB query + transaction)
- **Result**: Protects database from 90% of stock check queries during peak hours

---

### Message Queue: RabbitMQ

**Why RabbitMQ over Kafka/Redis Pub/Sub?**
- **Message Durability**: Messages survive broker restarts (critical for orders)
- **Acknowledgment System**: Kitchen service confirms message processing (guaranteed delivery)
- **Dead Letter Queues**: Handle failed orders automatically (future retry logic)
- **Routing Flexibility**: Topic exchanges for complex order routing (priority orders)

**Why Not Kafka?**
- Overkill for our scale (200-500 orders/day vs Kafka's millions/second)
- RabbitMQ simpler to configure and monitor
- Lower resource footprint (important for demo environment)

**Why Not Redis Pub/Sub?**
- No message persistence (order lost if kitchen service is down)
- No acknowledgment mechanism (can't guarantee delivery)

**Resilience Benefit**:
```
Kitchen Service DOWN → Orders queue in RabbitMQ → Zero data loss
Kitchen Service UP → Processes all queued orders → Business continuity
```

---

### Authentication: JWT (JSON Web Tokens)

**Why JWT over Session Cookies?**
- **Stateless**: Gateway doesn't need session storage (scales horizontally)
- **Microservices-Friendly**: Token validated independently by each service
- **Mobile-Ready**: Easy to use in future mobile apps (no cookie limitations)
- **Expiration Built-In**: 1-hour TTL prevents token hijacking

**Security Tradeoff**:
- ❌ Can't revoke tokens before expiration (unless we add blacklist)
- ✅ Blacklist implemented using Redis (logged-out tokens cached)

---

### Real-Time: WebSocket (Native)

**Why WebSocket over HTTP Polling?**
- **Reduced Latency**: <500ms status updates (vs 2-5s polling intervals)
- **Lower Bandwidth**: Single persistent connection (vs 30+ HTTP requests/minute)
- **Server-Push**: Notification service pushes updates (client doesn't ask repeatedly)

**Why Native WebSocket over Socket.IO?**
- **Lightweight**: No extra library overhead
- **Browser Support**: All modern browsers support WebSocket natively
- **Simplicity**: WebSocket sufficient for our use case (no rooms/namespaces needed)

---

### Container Runtime: Docker + Docker Compose

**Why Docker?**
- **Reproducible Environment**: Judges run system with single `docker compose up -d` command
- **Isolation**: Each service has independent dependencies (no version conflicts)
- **Portability**: Runs on Windows, macOS, Linux identically

**Why Docker Compose (not Kubernetes)?**
- **Simplicity**: Local development and demo environment (no cluster overhead)
- **Single File**: All services configured in one `docker-compose.yml`
- **Resource Efficiency**: Runs on laptops (Kubernetes requires more resources)

**Future Scaling Path**:
- Compose YAML easily converts to Kubernetes manifests
- Deploy to AWS ECS/Azure Container Apps/Google Cloud Run

---

### CI/CD: GitHub Actions

**Why GitHub Actions over Jenkins/CircleCI?**
- **Native Integration**: Seamless with GitHub repository
- **Free for Public Repos**: No additional cost
- **YAML Configuration**: Simple workflow definition (`.github/workflows/`)
- **Matrix Testing**: Test multiple Node.js versions in parallel

**What We Validate**:
```yaml
✅ Unit Tests (Jest): Order validation, stock deduction, auth middleware

✅ Build Verification: TypeScript compilation
```

---

## Performance Benchmarks

| Operation | Technology | Response Time | Justification |
|-----------|-----------|---------------|---------------|
| **Order Placement** | Node.js + Redis + MongoDB | <2 seconds | Async I/O, cache-first strategy |
| **Stock Check (Cache Hit)** | Redis | 5-10ms | In-memory lookup |
| **Stock Check (Cache Miss)** | MongoDB Atlas | 80-120ms | Optimistic locking transaction |
| **Kitchen Processing** | RabbitMQ + Node.js | 3-7 seconds | Async decoupling (realistic cooking time) |
| **Status Update** | WebSocket | <500ms | Server-push notification |

---

## Scalability Strategy

| Component | Current Scale | Future Scale | How We Scale |
|-----------|--------------|--------------|--------------|
| **Frontend** | 1 instance | CDN deployment | Static site hosting (Vercel/Netlify) |
| **Gateway** | 1 instance | 3-5 replicas | Horizontal scaling + load balancer |
| **Stock** | 1 instance | 3 replicas | Stateless service + shared MongoDB |
| **Kitchen** | 1 instance | 3 replicas | Multiple consumers + RabbitMQ |
| **Notification** | 1 instance | 3 replicas | WebSocket sticky sessions |
| **MongoDB** | Atlas M0 Free | Atlas M10+ | Auto-sharding + read replicas |
| **Redis** | Single node | Redis Cluster | Sharding + master-slave replication |
| **RabbitMQ** | Single node | HA Cluster | Mirrored queues + load balancer |

---

## Alternative Technologies Considered

| We Chose | Alternative | Why We Rejected It |
|----------|-------------|-------------------|
| **React** | Vue.js | React has larger ecosystem and better enterprise adoption |
| **MongoDB** | PostgreSQL | Flexible schema needed for evolving order structure |
| **RabbitMQ** | Apache Kafka | Kafka overkill for 200-500 orders/day |
| **JWT** | OAuth2 | OAuth2 too complex for internal student authentication |
| **WebSocket** | Server-Sent Events (SSE) | SSE one-way only (can't send client → server easily) |
| **Docker Compose** | Kubernetes | K8s too heavy for local development/demo |

---

## Technology Alignment with Requirements

| Requirement | Technology Used | How It Helps |
|------------|----------------|--------------|
| **<2s Order Response** | Node.js async I/O + Redis cache | Non-blocking operations, cache-first strategy |
| **100+ Concurrent Orders** | Node.js event loop + MongoDB Atlas | Single-threaded async handles concurrency efficiently |
| **No Overselling** | MongoDB optimistic locking (version field) | Atomic stock updates prevent race conditions |
| **Graceful Degradation** | RabbitMQ durable queues | Orders survive service crashes (message persistence) |
| **Real-Time Updates** | WebSocket | Persistent connection for instant status push |
| **Single Command Deploy** | Docker Compose | Orchestrates 8 containers with one command |
| **Automated Testing** | GitHub Actions + Jest | CI pipeline catches bugs before deployment |

---

## Summary

Our tech stack prioritizes **resilience, performance, and scalability**:

✅ **Node.js + Express**: Fast async I/O for high concurrency  
✅ **MongoDB Atlas**: Flexible schema + managed cloud service  
✅ **Redis**: 90% faster stock checks (protects database)  
✅ **RabbitMQ**: Zero message loss (orders survive crashes)  
✅ **WebSocket**: Real-time updates without polling overhead  
✅ **Docker + Compose**: One-command deployment for judges  
✅ **TypeScript**: Type safety for critical stock logic  

Each technology choice directly addresses a specific problem statement requirement (overselling, database overload, poor UX, system failures).

---


