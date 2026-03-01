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

## Key Observations for Judges

### ✅ Auto-Restart Proof
- **Docker Status**: Container never shows "Exited" - restarts too fast
- **Restart Count**: `docker inspect <service> --format='{{.RestartCount}}'`
- **Uptime Resets**: Check container "Status" - shows "Up X seconds" after restart
- **Logs**: Show process crash + restart messages

### ✅ Resilience Features
1. **Fast Cache Check**: Gateway rejects out-of-stock instantly
2. **JWT Validation**: Unauthorized requests rejected at gateway
3. **Async Processing**: Kitchen decoupled via RabbitMQ (3-7s cooking time)
4. **Durable Queues**: Messages survive service restarts
5. **WebSocket Auto-Reconnect**: UI recovers without page refresh
6. **Health Monitoring**: Real-time service status in Admin Dashboard

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
