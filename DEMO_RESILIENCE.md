# Resilience Demo Guide

## Prerequisites
All services must be running:
```powershell
cd "d:\Projects\Digital Cafeteria"
docker compose up -d
docker compose ps
```

---

## Demo 1: Notification Service Kill (Order Processing Continues)

### Steps:
1. **Open Admin Dashboard**: http://localhost:8085/admin
   - Watch health indicators (updates every 2s)

2. **Place an Order**: http://localhost:8085/student
   - Login with any credentials
   - Place an order
   - Watch live status updates via WebSocket

3. **Kill Notification Service**:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:8084/chaos/kill
   ```

4. **Observe** (Service Stays Down - No Auto-Restart):
   - Admin Dashboard shows notification service as "Unhealthy" (red)
   - Student Dashboard shows "Notification service down... reconnecting..."
   - **Service stays stopped** - this proves resilience!
   - You can take your time demonstrating to judges

5. **PROVE Order Processing Continues** (While Notification is Down):
   
   **Option A: Place a NEW order while service is down**
   ```powershell
   # In one terminal, watch kitchen logs
   docker compose logs -f kitchen-service
   
   # In another terminal, verify notification is DOWN
   docker ps -a | Select-String notification-service
   # Should show "Exited"
   ```
   
   Now place an order from Student Dashboard:
   - ✅ Order is **accepted immediately** (stock service works)
   - ✅ **Kitchen logs show** order received and processing
   - ✅ Order status changes: Pending → Verified → Cooking → Ready
   - ❌ **Only notifications are missing** (WebSocket down)
   
   **What to point out to judges:**
   ```powershell
   # Check kitchen is still processing
   docker compose logs --tail=20 kitchen-service
   # You'll see:
   # "📥 Received order ABC123 from queue"
   # "👨‍🍳 Order ABC123 moved to kitchen (status: IN_KITCHEN)"
   # "🔥 Cooking order ABC123... (5234ms)"
   # "✅ Order ABC123 is ready for pickup!"
   
   # Check RabbitMQ - messages flowing normally
   docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
   # kitchen.q shows messages being processed (messages_unacknowledged = 0)
   ```

   **Option B: Use an existing order's logs**
   ```powershell
   # Show the order was placed BEFORE notification died
   # Kitchen still processed it after notification went down
   docker compose logs kitchen-service | Select-String "Order.*processing"
   docker compose logs kitchen-service | Select-String "ready"
   ```

6. **Key Proof Points to Show Judges**:
   
   ```powershell
   # 1. Notification service is DOWN
   docker ps -a | Select-String notification-service
   # Shows: "Exited (137)" or "Exited (143)"
   
   # 2. Kitchen service is UP and working
   docker ps | Select-String kitchen-service
   # Shows: "Up X seconds"
   
   # 3. Kitchen processed orders (check recent logs)
   docker compose logs --tail=30 kitchen-service
   # Look for: 
   # "📥 Received order <ID> from queue"
   # "✅ Order <ID> is ready for pickup!"
   
   # 4. RabbitMQ queues are flowing
   docker compose exec rabbitmq rabbitmqctl list_queues
   # Shows messages in kitchen.q being consumed
   
   # 5. Gateway is still accepting orders
   docker compose logs --tail=20 gateway-service
   # Shows: "Order placed successfully"
   ```

   **Why this proves resilience:**
   - ✅ Critical path (Order → Stock → Kitchen) still works
   - ✅ Only notification delivery is affected
   - ✅ System degrades gracefully (no cascading failures)
   - ✅ Orders don't get lost or stuck

7. **Manually Restart Service** (When Ready to Show Recovery):
   ```powershell
   # Restart service
   docker start notification-service
   
   # Watch logs to see recovery
   docker logs -f notification-service
   ```

8. **Observe Recovery**:
   - Service starts accepting connections immediately
   - Admin Dashboard shows "✅ Notification service recovered" (green)
   - Student WebSocket auto-reconnects
   - Status updates resume

9. **Verify Manual Restart**:
   ```powershell
   # Check container is running
   docker ps | Select-String notification-service
   
   # Check uptime (shows "Up X seconds" since manual restart)
   docker compose ps notification-service
   
   # View startup logs
   docker compose logs --tail=30 notification-service
   ```

---

## Demo 2: Kitchen Service Kill (RabbitMQ Buffers Orders)

### Steps:
1. **Place an Order** (watch logs):
   ```powershell
   docker compose logs -f kitchen-service notification-service
   ```

2. **Kill Kitchen Service WHILE Order is Placed**:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:8083/chaos/kill
   ```

3. **Observe** (Service Stays Down):
   
   **Where to look for each proof:**
   
   ```powershell
   # 1. ORDER ACCEPTED - Gateway logs
   docker compose logs --tail=10 gateway-service
   # Look for: "Order placed successfully" or status 201
   ```
   
   ```powershell
   # 2. STOCK DEDUCTED - Stock service logs
   docker compose logs --tail=10 stock-service
   # Look for: "Stock deducted successfully" or "remainingStock: X"
   ```
   
   ```powershell
   # 3. MESSAGE IN QUEUE - RabbitMQ status
   docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
   # Look for: kitchen.q with messages_ready > 0 (message waiting!)
   ```
   
   ```powershell
   # 4. KITCHEN IS DOWN - Container status
   docker ps -a | Select-String kitchen-service
   # Shows: "Exited (137)" - service is DOWN but message is safe in queue!
   ```
   
   **Summary of observations:**
   - ✅ Order is accepted immediately (<2s response) - **Gateway logs**
   - ✅ Stock is deducted - **Stock service logs**
   - ✅ RabbitMQ holds the message in `kitchen.q` (durable queue!) - **RabbitMQ queue status**
   - ✅ **Kitchen service stays stopped** - message waits in queue - **docker ps -a**
   - ✅ This proves message durability!

4. **Manually Restart Kitchen** (When Ready):
   ```powershell
   # Restart service
   docker start kitchen-service
   
   # Watch it process the queued message
   docker logs -f kitchen-service
   ```
   
   **What you'll see in kitchen logs:**
   ```
   [2026-03-02T12:52:01.255Z] ✅ Connected to RabbitMQ successfully
   [2026-03-02T12:52:01.256Z] 🎧 Listening for orders on queue: kitchen.q
   [2026-03-02T12:52:01.300Z] 📥 Received order ABC123 from queue  <-- THE WAITING MESSAGE!
   [2026-03-02T12:52:01.301Z] 👨‍🍳 Order ABC123 moved to kitchen (status: IN_KITCHEN)
   [2026-03-02T12:52:01.302Z] 🔥 Cooking order ABC123... (4521ms)
   [2026-03-02T12:52:05.823Z] ✅ Order ABC123 is ready for pickup!
   ```

5. **Observe Recovery**:
   - Kitchen service starts immediately
   - Kitchen picks up queued message from RabbitMQ (**see logs above!**)
   - Order processing completes
   - Status updates to READY
   
   **Notification service logs will also show:**
   ```powershell
   docker compose logs --tail=10 notification-service
   # Look for:
   # "�‍🍳 Order ABC123: STOCK_VERIFIED → IN_KITCHEN"
   # "🎉 Order ABC123: IN_KITCHEN → READY"
   # "📤 Broadcasting to X WebSocket subscriber(s) for order ABC123"
   ```

6. **Prove Queue Persistence**:
   ```powershell
   # Before restart: Check RabbitMQ queue has messages waiting
   docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
   
   # After restart: Verify kitchen is running
   docker ps | Select-String kitchen-service
   ```

---

## Demo 3: Multiple Service Failures

### Steps:
1. Place an order
2. Kill both Kitchen and Notification:
   ```powershell
   Invoke-RestMethod -Method Post -Uri http://localhost:8083/chaos/kill
   Invoke-RestMethod -Method Post -Uri http://localhost:8084/chaos/kill
   ```

3. **Observe** (Both Services Stay Down):
   - Order still accepted (resilience!)
   - Both services stay stopped
   - RabbitMQ queues hold messages
   - Student sees "services down" but order was accepted
   
   **WHERE TO OBSERVE:**
   ```bash
   # Verify order was accepted
   docker compose logs --tail=5 gateway-service
   # Look for: "Order placed successfully"
   
   # Verify services are down
   Show from docker desktop 
   # Look for: No running containers (or status shows "Exited")
   
   # Check RabbitMQ queues
   docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
   # Look for: kitchen.q and notification.q with messages_ready > 0
   ```

4. **Manually Restart Both Services** (When Ready):
   ```powershell
   # Restart kitchen (processes queued order)
   docker start kitchen-service
   
   # Restart notification (delivers status updates)
   docker start notification-service
   
   # Watch both services recover
   docker compose logs -f kitchen-service notification-service
   ```

5. **Observe Recovery**:
   - Both services start immediately
   - Order processing completes after recovery
   
   **WHERE TO OBSERVE:**
   ```bash
   # Watch kitchen process queued orders
   docker compose logs --tail=20 kitchen-service
   # Look for:
   # [TIMESTAMP] 📥 Received order <ID> from queue
   # [TIMESTAMP] 👨‍🍳 Order <ID> moved to kitchen (status: IN_KITCHEN)
   # [TIMESTAMP] ✅ Order <ID> is ready for pickup!
   
   # Watch notification deliver status updates
   docker compose logs --tail=10 notification-service
   # Look for:
   # [TIMESTAMP] �‍🍳 Order <ID>: STOCK_VERIFIED → IN_KITCHEN
   # [TIMESTAMP] 🎉 Order <ID>: IN_KITCHEN → READY
   # [TIMESTAMP] 📤 Broadcasting to X WebSocket subscriber(s) for order <ID>
   ```
   - All status updates delivered
   - WebSocket reconnects automatically

---

## Demo 4: Redis Fast Reject Pattern (Cache-Based Stock Protection)

### What You're Proving
When an item runs out of stock, Redis caches `OUT_OF_STOCK` status. The **second order gets rejected in <10ms** from cache instead of querying the database (~80-120ms). This is the **Fast Reject Pattern**.

### The Demo Flow
**Item Used**: Biryani Vegetarian (stock = 1)  
**Goal**: Show first order depletes stock → Redis caches OUT_OF_STOCK → second order rejected instantly

---

### **STEP 1: Prepare the Demo**

```powershell
# Clear Redis cache for fresh demo
docker compose exec redis redis-cli FLUSHALL

# Verify Biryani Vegetarian has stock = 1 (MongoDB Atlas)
docker compose exec stock-service node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(async () => { const doc = await mongoose.connection.db.collection('fooditems').findOne({name: /biryani.*veg/i}); console.log('Stock:', doc.stock, '| Name:', doc.name); process.exit(0); });"
```
**Expected**: `Stock: 1 | Name: biryani_veg`

```powershell
# Start watching Gateway logs (keep this terminal open)
docker compose logs -f gateway-service
```

---

### **STEP 2: Place First Order (Stock Goes to Zero)**

1. Open Student Dashboard: http://localhost:8085/student
2. Login with any credentials
3. Place order for **"Biryani Vegetarian"** (quantity: 1)
4. Wait for order to process (status: Pending → Verified → Cooking → Ready)

**What to Tell Judges (pointing at Gateway logs)**:
- ✅ "See `[Redis] Stock status: NOT_CACHED` - no cache entry yet"
- ✅ "Gateway calls Stock Service database - this takes ~80-120ms"
- ✅ "Stock deducted successfully, **remainingStock: 0**"
- ✅ "Gateway caches `OUT_OF_STOCK` in Redis with 1-hour TTL"

**Expected Gateway Log Output**:
```
[Redis Check] Checking cache for item: biryani_veg
[Redis] Stock status for item biryani_veg: NOT_CACHED
[Stock Service] Calling POST http://stock-service:8082/order
[Stock Service] Response: 200 - Stock deducted successfully
[Cache Update] Item biryani_veg marked OUT_OF_STOCK (remainingStock: 0)
```

---

### **STEP 3: Verify Redis Cached the Status**

```powershell
# Check Redis has OUT_OF_STOCK status
docker compose exec redis redis-cli GET "stock_status_biryani_veg"
```
**Expected Output**: `OUT_OF_STOCK`

```powershell
# Check TTL (time to live in seconds)
docker compose exec redis redis-cli TTL "stock_status_biryani_veg"
```
**Expected Output**: `3598` (counts down from 3600 = 1 hour)

**What to Tell Judges**:
- ✅ "Redis now has the OUT_OF_STOCK status cached"
- ✅ "This cache entry will live for 1 hour (3600 seconds)"
- ✅ "Any future order for Biryani Veg will check Redis first"

---

### **STEP 4: Place Second Order (Fast Reject from Cache)**

1. Try placing **another order** for **"Biryani Vegetarian"**
2. **Order gets rejected INSTANTLY** (no loading spinner)

**What to Tell Judges (pointing at Gateway logs)**:
- ✅ "See `[Fast Reject] Item is OUT_OF_STOCK in cache` - no database call"
- ✅ "Response time: **~5-15ms** (just Redis lookup)"
- ✅ "Compare to first order: ~80-120ms (database + transaction)"
- ✅ "**90% faster** rejection for out-of-stock items"

**Expected Gateway Log Output**:
```
[Redis Check] Checking cache for item: biryani_veg
[Fast Reject] Item biryani_veg is OUT_OF_STOCK in cache
```

**Expected Browser Error**:
```
"Item biryani_veg is currently out of stock (cached)"
```

---

### **STEP 5: Show the Performance Difference**

| Order | Redis Status | Database Called? | Response Time |
|-------|-------------|------------------|---------------|
| **First Order** | NOT_CACHED | ✅ Yes (MongoDB transaction) | 80-120ms |
| **Second Order** | OUT_OF_STOCK | ❌ No (Redis only) | 5-15ms |

**Key Points for Judges**:
1. **Database Protection**: Prevents hundreds of unnecessary DB queries during high traffic
2. **Faster User Feedback**: Users get instant "out of stock" response
3. **Scalability**: Cache absorbs repeated requests for unavailable items
4. **Smart Caching**: Only caches OUT_OF_STOCK items (not all stock quantities)

---

### **Bonus: Inspect Redis Cache Details**

```powershell
# List all cached stock status keys
docker compose exec redis redis-cli KEYS "stock_status_*"

# Check memory usage
docker compose exec redis redis-cli INFO memory | Select-String "used_memory_human"
```

---

### **Reset for Next Demo**

```powershell
# Clear Redis cache
docker compose exec redis redis-cli FLUSHALL

# Reset Biryani_Veg stock to 1 (MongoDB Atlas)
docker compose exec stock-service node -e "const mongoose = require('mongoose'); mongoose.connect(process.env.MONGO_URI).then(async () => { await mongoose.connection.db.collection('fooditems').updateOne({name: /biryani.*veg/i}, {'\$set': {stock: 1}}); console.log('Stock reset to 1'); process.exit(0); });"
```

---

## Key Observations for Judges

### ✅ Manual Restart Control
- **No Auto-Restart**: Services stay down when killed (full control for demo)
- **Instant Startup**: Services start immediately after `docker start`
- **Full Demo Control**: Take your time showing resilience before restarting

### ✅ Resilience Features
1. **Redis Fast Reject**: Out-of-stock items rejected in <10ms (90% faster than DB query)
2. **Service Independence**: Orders accepted even when downstream services are down
3. **Async Processing**: Kitchen decoupled via RabbitMQ (3-7s cooking time)
4. **Durable Queues**: Messages survive service restarts (no data loss)
5. **WebSocket Auto-Reconnect**: UI recovers without page refresh
6. **Health Monitoring**: Real-time service status in Admin Dashboard
7. **Database Protection**: Redis cache prevents DB overload during high traffic
8. **Manual Control**: Full control over service restarts for demonstration

### ✅ Manual Restart Workflow
- **Kill**: `Invoke-RestMethod -Method Post -Uri http://localhost:PORT/chaos/kill`
- **Verify Stopped**: `docker ps -a` (shows "Exited" status)
- **Demo Resilience**: Take your time - service stays down!
- **Restart**: `docker start <service-name>` (starts immediately)
- **Verify Running**: `docker ps` (shows "Up X seconds")

---

## Commands Reference

```powershell
# Start everything
docker compose up -d

# View all logs
docker compose logs -f

# View specific service
docker compose logs -f notification-service

# ──── KILL SERVICES ────
# Kill notification service
Invoke-RestMethod -Method Post -Uri http://localhost:8084/chaos/kill

# Kill kitchen service
Invoke-RestMethod -Method Post -Uri http://localhost:8083/chaos/kill

# Kill stock service (for cache demo)
Invoke-RestMethod -Method Post -Uri http://localhost:8082/chaos/kill

# ──── CHECK SERVICE STATUS ────
# List all containers (including stopped)
docker ps -a

# Check specific service status
docker ps | Select-String notification-service

# ──── MANUALLY START SERVICES ────
# Start notification service
docker start notification-service

# Start kitchen service
docker start kitchen-service

# Start stock service
docker start stock-service

# Start all stopped services at once
docker compose start

# ──── WATCH SERVICE LOGS ────
# Watch service logs in real-time
docker logs -f notification-service

# ──── RABBITMQ QUEUE STATUS ────
# Check queue status (see messages waiting while service is down)
docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged

# ──── REDIS CACHE STATUS ────
# Check cached stock status
docker compose exec redis redis-cli KEYS "stock_status_*"
docker compose exec redis redis-cli GET "stock_status_biryani_veg"

# ──── REBUILD EVERYTHING ────
docker compose down
docker compose build --no-cache
docker compose up -d
```
