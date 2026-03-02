# Requirement Analysis: Digital Cafeteria System

**Project Name**: Digital Cafeteria Microservices Platform  
**Date**: March 2, 2026

---

## 1. Project Goals (What Problem Are We Solving?)

### The Problem
Educational institutions face critical challenges during peak cafeteria hours (lunch/Iftar rush):

1. **Overselling**: Multiple students ordering simultaneously causes stock to go below zero
2. **Database Overload**: 100+ concurrent orders crash the system during rush hours
3. **Poor User Experience**: Students wait 10+ seconds not knowing if their order succeeded
4. **No Order Tracking**: Students don't know when food is ready (unnecessary waiting at counter)
5. **System Failures**: One service crashing brings down the entire system
6. **Security Issues**: No authentication means anyone can place orders under any student ID

### Our Solution
Build a **resilient microservices platform** that:
- ✅ Handles 100+ concurrent orders without overselling
- ✅ Responds to students in <2 seconds (fast acknowledgment)
- ✅ Provides real-time order status updates (no page refresh needed)
- ✅ Continues working even when some services fail (graceful degradation)
- ✅ Protects database with Redis caching (90% faster stock checks)
- ✅ Secures orders with JWT authentication

---

## 2. User Stories & Features (What Can Users Do?)

### For Students
- **Login**: "I can log in with my student ID and password to get a secure token"
- **Browse Menu**: "I can see available food items with current stock status"
- **Place Order**: "I can select an item, enter quantity, and submit my order"
- **Get Instant Feedback**: "I get immediate confirmation if my order is accepted or rejected"
- **Track Order Status**: "I see real-time updates: Pending → Verified → Cooking → Ready"
- **Know When Ready**: "I get notified when my food is ready for pickup"
- **Handle Out-of-Stock**: "If an item is out of stock, I'm told immediately (no waiting)"

### For Admins/Staff
- **Monitor System Health**: "I can see which services are running (Green) or down (Red)"
- **View Metrics**: "I see total orders processed, average response time, active orders"
- **Demonstrate Resilience**: "I can manually kill services to show the system handles failures"
- **Check Kitchen Queue**: "I see pending orders waiting to be prepared"

### Core System Features
| Feature | Description |
|---------|-------------|
| **Secure Authentication** | Login system issues JWT tokens; all orders require valid token |
| **Order Placement** | Students submit orders with item ID and quantity |
| **Stock Validation** | System checks stock availability before accepting order |
| **Fast Cache Check** | Redis cache rejects out-of-stock items in <10ms (no database query) |
| **Concurrency Control** | Optimistic locking prevents overselling during high traffic |
| **Async Processing** | Kitchen processes orders in background (3-7 seconds) |
| **Message Durability** | Orders saved in RabbitMQ queue (survive service crashes) |
| **Real-Time Notifications** | WebSocket pushes status updates to student browser |
| **Auto-Reconnection** | UI reconnects automatically if notification service restarts |
| **Health Monitoring** | Each service reports health status every 2 seconds |
| **Rate Limiting** | Maximum 3 login attempts per minute (prevent brute-force attacks) |

---

## 3. Constraints (Technical & Business Limitations)

### Technical Constraints
| Constraint | Reason |
|-----------|--------|
| **Must use Docker Compose** | Judges start system with single `docker compose up -d` command |
| **Node.js (v18-20) Required** | Backend services built with Node.js ecosystem |
| **MongoDB Atlas (Cloud)** | Stock service uses cloud database (not local MongoDB container) |
| **Redis (Single Instance)** | In-memory cache for fast stock checks |
| **RabbitMQ for Messaging** | Durable message queues for async processing |
| **JWT Authentication** | Token-based security (no session cookies) |
| **No Auto-Restart** | Services stay down when killed (for demo purposes) |
| **Docker Network Only** | Services communicate via internal network (not exposed ports) |

### Performance Constraints
| Constraint | Target |
|-----------|--------|
| Order acknowledgment must be **<2 seconds** | User gets response before timeout |
| Cache response must be **<10ms** | Fast rejection without database query |
| System must handle **100+ concurrent orders** | Peak lunch rush capacity |
| Kitchen processing takes **3-7 seconds** | Simulates real cooking time |

### Business Constraints
| Constraint | Value |
|-----------|-------|
| **Peak Hours** | 11:30 AM - 1:30 PM (heaviest traffic) |
| **Target Users** | 500-2000 students per institution |
| **Menu Size** | 10-15 food items |
| **Daily Orders** | 200-500 orders typical |

### Security Constraints
| Constraint | Implementation |
|-----------|----------------|
| **All Orders Require Authentication** | Must have valid JWT token in request header |
| **Token Expiration** | Tokens expire after 1 hour |
| **Rate Limiting** | Maximum 3 login attempts per minute |
| **Protected Routes** | Gateway rejects requests without token (401 Unauthorized) |

### CI/CD Constraints
| Constraint | Requirement |
|-----------|-------------|
| **Automated Testing** | Every code push runs unit tests via GitHub Actions |
| **Build Must Pass** | Tests must pass before code can merge |
| **Test Coverage** | Target 80%+ code coverage for business logic |
| **Test Cases Required** | Order validation, stock deduction, authentication, rate limiting |

---

## 4. System Architecture (5 Microservices)

| Service | Responsibility | Key Technology |
|---------|---------------|----------------|
| **Auth Service** | User login, JWT token generation | Node.js, MongoDB, bcrypt |
| **Gateway Service** | Order entry point, token validation, cache check | Node.js, Redis, RabbitMQ |
| **Stock Service** | Inventory management, concurrency control | TypeScript, MongoDB Atlas, Optimistic Locking |
| **Kitchen Service** | Async order processing (cooking simulation) | Node.js, RabbitMQ |
| **Notification Service** | Real-time status updates via WebSocket | Node.js, WebSocket, RabbitMQ |

**Supporting Infrastructure**:
- **MongoDB Atlas**: Cloud database for persistent storage
- **Redis**: In-memory cache for fast stock checks
- **RabbitMQ**: Message broker for async communication
- **Frontend**: React UI for students and admins

---

## 5. Key Success Criteria

### Must Achieve
✅ Student can login → browse menu → place order → see real-time status updates  
✅ Out-of-stock items rejected instantly (<10ms from cache)  
✅ Orders acknowledged in <2 seconds  
✅ System handles 100+ concurrent orders without overselling  
✅ Services can be killed and restarted without losing orders (RabbitMQ durability)  
✅ Admin dashboard shows real-time service health  
✅ All unit tests pass in CI pipeline  
✅ System starts with single `docker compose up -d` command

---

**Document Version**: 1.0  
**Last Updated**: March 2, 2026
