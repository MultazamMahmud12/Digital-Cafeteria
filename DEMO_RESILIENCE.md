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

4. **Observe**:
   - Admin Dashboard shows "Notification service is restarting..."
   - Student Dashboard shows "Notification service restarting... reconnecting..."
   - Order processing continues (Kitchen still processes)
   - After ~2-3 seconds, notification service auto-restarts
   - Admin Dashboard shows "✅ Notification service recovered"
   - Student WebSocket auto-reconnects
   - Status updates resume

5. **Prove Auto-Restart**:
   ```powershell
   # Check restart count (should increment)
   docker inspect notification-service --format='{{.RestartCount}}'
   
   # Check uptime (resets after restart)
   docker compose ps notification-service
   
   # View restart in logs
   docker compose logs --tail=50 notification-service


   OR ,
   # Watch logs live (shows restart happening)
    docker compose logs -f notification-service

    # In another terminal, kill it
    Invoke-RestMethod -Method Post -Uri http://localhost:8084/chaos/kill

    # Check restart count (increments each restart)
    docker inspect notification-service --format='{{.RestartCount}}'

    # Check uptime (resets after restart)   
    docker compose ps notification-service
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

3. **Observe**:
   - Order is accepted immediately (<2s response)
   - Stock is deducted
   - RabbitMQ holds the message in `kitchen.q`
   - Kitchen service auto-restarts (~2-3s)
   - Kitchen picks up queued message
   - Order processing completes
   - Status updates to READY

4. **Prove Queue Persistence**:
   ```powershell
   # Check RabbitMQ queue has messages
   docker compose exec rabbitmq rabbitmqctl list_queues name messages_ready messages_unacknowledged
   
   # Check restart count
   docker inspect kitchen-service --format='{{.RestartCount}}'
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

3. **Observe**:
   - Order still accepted
   - Both services restart automatically
   - Order processing completes after recovery
   - All status updates delivered

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

# Verify Biryani Vegetarian has stock = 1
docker compose exec mongodb mongosh digital_cafeteria_stock --eval "db.fooditems.find({name: /biryani.*veg/i}, {name:1, stock:1})"
```
**Expected**: `{ name: 'Biryani_Veg', stock: 1 }`

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

# Reset Biryani_Veg stock to 1
docker compose exec mongodb mongosh digital_cafeteria_stock --eval "db.fooditems.updateOne({name: /biryani.*veg/i}, {\$set: {stock: 1}})"
```

---

## Key Observations for Judges

### ✅ Auto-Restart Proof
- **Docker Status**: Container never shows "Exited" - restarts too fast
- **Restart Count**: `docker inspect <service> --format='{{.RestartCount}}'`
- **Uptime Resets**: Check container "Status" - shows "Up X seconds" after restart
- **Logs**: Show process crash + restart messages

### ✅ Resilience Features
1. **Redis Fast Reject**: Out-of-stock items rejected in <10ms (90% faster than DB query)
2. **Auto-Restart**: Services recover in ~2-3 seconds using Docker restart policies
3. **Async Processing**: Kitchen decoupled via RabbitMQ (3-7s cooking time)
4. **Durable Queues**: Messages survive service restarts
5. **WebSocket Auto-Reconnect**: UI recovers without page refresh
6. **Health Monitoring**: Real-time service status in Admin Dashboard
7. **Database Protection**: Redis cache prevents DB overload during high traffic

### ✅ Why "Stopped" Never Shows
- Compose policy: `restart: unless-stopped`
- Restart happens in ~1-2 seconds
- Docker Desktop polls status every few seconds
- By the time UI updates, container is running again

---

## Commands Reference

```powershell
# Start everything
docker compose up -d

# View all logs
docker compose logs -f

# View specific service
docker compose logs -f notification-service

# Kill a service
Invoke-RestMethod -Method Post -Uri http://localhost:8084/chaos/kill

# Check restart count
docker inspect notification-service --format='{{.RestartCount}}'

# Check queue status
docker compose exec rabbitmq rabbitmqctl list_queues

# Stop without restarting (for comparison)
docker compose stop notification-service

# Start again
docker compose start notification-service

# Rebuild everything
docker compose down
docker compose build --no-cache
docker compose up -d
```
