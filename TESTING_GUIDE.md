# Quick Start Guide: Testing Enhanced Admin Dashboard

## 🚀 Setup & Launch

### Step 1: Start the System
```bash
# Navigate to project root
cd "D:\Projects\Digital Cafeteria"

# Build and start all services
docker compose up --build -d

# Wait for all services to be healthy (30-60 seconds)
docker compose ps
```

### Step 2: Access the Admin Dashboard
Open your browser and navigate to:
```
http://localhost:8085/admin.html
```

---

## ✅ Feature Testing Guide

### Feature 1: Start/Restart Services

**Test Steps:**
1. ✅ Verify all 5 services show green "Healthy" status
2. ✅ Click "Chaos Kill" on Kitchen Service
3. ✅ Observe status changes to red "Unreachable"
4. ✅ Click "Start Service" button (green)
5. ✅ Wait 2-3 seconds, status should return to green

**Expected Behavior:**
- Button shows "Starting..." during operation
- Status dot changes: Green → Red → Green
- Service becomes accessible again

---

### Feature 2: Live Log Streaming

**Test Steps:**
1. ✅ Scroll down to "Service Logs" section
2. ✅ Verify logs are displayed for all 5 services
3. ✅ Logs should have dark terminal theme
4. ✅ Perform an action (like login or place order)
5. ✅ Watch logs update within 2 seconds

**Expected Behavior:**
- Logs appear in dark terminal-style viewer
- New entries appear at bottom
- Auto-scrolls to latest logs
- Updates every 2 seconds

**Sample Log Output:**
```
[2026-03-03T10:30:45.123Z] ✅ Connected to RabbitMQ successfully
[2026-03-03T10:30:47.456Z] 📥 Received order abc123 from queue
[2026-03-03T10:30:50.789Z] ✅ Order abc123 is ready for pickup!
```

---

### Feature 3: RabbitMQ Queue Monitoring

**Test Steps:**
1. ✅ Find "RabbitMQ Queue Status" section
2. ✅ Should see two queues: kitchen.q and notify.q
3. ✅ Kill Kitchen Service using "Chaos Kill"
4. ✅ Place 3-5 orders from student dashboard
5. ✅ Watch kitchen.q "Total Messages" increase
6. ✅ Verify "Consumers" shows 0 (service is down)
7. ✅ Click "Start Service" for Kitchen
8. ✅ Watch "Consumers" change to 1
9. ✅ Observe "Total Messages" decrease to 0

**Expected Behavior:**
- kitchen.q shows message accumulation when service is down
- Consumer count reflects service availability
- Messages drain when service restarts
- State shows "running" for healthy queues

**Sample Queue Display:**
```
kitchen.q
Total Messages: 5
Ready: 5
Unacknowledged: 0
Consumers: 0
State: ● running
```

---

### Feature 4: Enhanced Metrics with Graphs

**Test Steps:**
1. ✅ Locate "Live Metrics" section
2. ✅ Each service should have a line chart
3. ✅ Charts should show "Avg Latency (ms)"
4. ✅ Place 10 orders rapidly
5. ✅ Watch Gateway chart spike upward
6. ✅ Observe trend over 20 data points
7. ✅ Check JSON metrics below chart for details

**Expected Behavior:**
- Blue line chart displays latency trends
- Chart updates every 2 seconds
- X-axis shows timestamps
- Y-axis shows latency in milliseconds
- JSON shows detailed metrics

**Sample Metrics JSON:**
```json
{
  "http_requests_total": 42,
  "http_failures_total": 0,
  "avg_http_latency_ms": 156.7
}
```

---

## 🎯 Complete Test Scenario

### Scenario: Resilience Demonstration

**Objective:** Show system handles service failures gracefully

**Steps:**
1. **Initial State**
   - ✅ All services green (Healthy)
   - ✅ kitchen.q shows 0 messages
   - ✅ Logs showing normal activity

2. **Kill Kitchen Service**
   - ✅ Click "Chaos Kill" on Kitchen
   - ✅ Kitchen turns red
   - ✅ Kitchen logs stop updating

3. **Place Orders**
   - ✅ Open student dashboard: `http://localhost:8085/student.html`
   - ✅ Login with credentials
   - ✅ Place 5 orders for different items
   - ✅ Orders should be ACCEPTED (Gateway still works)

4. **Monitor Queues**
   - ✅ Switch back to admin dashboard
   - ✅ kitchen.q should show 5 messages
   - ✅ Consumers: 0 (service is down)
   - ✅ Gateway logs show "Order accepted" messages
   - ✅ Notification service shows orders stuck in PENDING

5. **Restart Kitchen**
   - ✅ Click "Start Service" for Kitchen
   - ✅ Wait 3-5 seconds
   - ✅ Kitchen turns green
   - ✅ Kitchen logs show processing starting

6. **Verify Recovery**
   - ✅ kitchen.q drains to 0 messages
   - ✅ Kitchen logs show "Order ready" messages
   - ✅ notify.q receives status updates
   - ✅ Student dashboard shows orders as READY
   - ✅ Metrics charts show activity spike

**Success Criteria:**
- ✅ No orders were lost during Kitchen downtime
- ✅ All orders processed after service restart
- ✅ System remained responsive throughout
- ✅ Logs clearly show order flow
- ✅ Queues accurately reflected system state

---

## 📊 Expected Dashboard Appearance

### Service Health Cards (Top)
```
┌─────────────────────────┐  ┌─────────────────────────┐
│ Identity                │  │ Gateway                 │
│ ● Healthy               │  │ ● Healthy               │
│ [Chaos Kill (disabled)] │  │ [Chaos Kill (disabled)] │
│ [Start Service]         │  │ [Start Service]         │
└─────────────────────────┘  └─────────────────────────┘

┌─────────────────────────┐  ┌─────────────────────────┐
│ Stock                   │  │ Kitchen                 │
│ ● Healthy               │  │ ● Unreachable           │
│ [Chaos Kill]            │  │ [Chaos Kill]            │
│ [Start Service]         │  │ [Start Service]         │
└─────────────────────────┘  └─────────────────────────┘
```

### RabbitMQ Queue Status
```
┌─────────────────────────┐  ┌─────────────────────────┐
│ kitchen.q               │  │ notify.q                │
│ Total Messages: 5       │  │ Total Messages: 0       │
│ Ready: 5                │  │ Ready: 0                │
│ Unacknowledged: 0       │  │ Unacknowledged: 0       │
│ Consumers: 0            │  │ Consumers: 1            │
│ State: ● running        │  │ State: ● running        │
└─────────────────────────┘  └─────────────────────────┘
```

### Live Metrics (with Chart)
```
┌─────────────────────────────────────────────┐
│ Gateway Metrics                             │
│ ┌─────────────────────────────────────────┐ │
│ │    Avg Latency (ms)                     │ │
│ │ 300│         ╱╲                         │ │
│ │ 200│      ╱─╯  ╲                        │ │
│ │ 100│   ╱─╯      ╲─╮                     │ │
│ │   0└──────────────────────────────────  │ │
│ └─────────────────────────────────────────┘ │
│                                             │
│ {                                           │
│   "http_requests_total": 42,                │
│   "avg_http_latency_ms": 156.7              │
│ }                                           │
└─────────────────────────────────────────────┘
```

### Service Logs
```
┌─────────────────────────────────────────────┐
│ Kitchen Logs                                │
│ ┌─────────────────────────────────────────┐ │
│ │ [2026-03-03T10:30:45] ✅ Connected to RMQ│ │
│ │ [2026-03-03T10:30:47] 📥 Order abc123    │ │
│ │ [2026-03-03T10:30:50] 🔥 Cooking...      │ │
│ │ [2026-03-03T10:30:57] ✅ Order ready!    │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Issue: Cannot start services

**Symptoms:**
- "Start Service" button shows error
- Logs show "Failed to start container"

**Solution:**
```bash
# Check Docker daemon is running
docker ps

# Check frontend container has Docker access
docker exec frontend docker ps

# Restart frontend if needed
docker restart frontend
```

---

### Issue: Logs not showing

**Symptoms:**
- Log viewer shows "Loading logs..."
- No log updates

**Solution:**
```bash
# Check container names match
docker ps --format "table {{.Names}}\t{{.Status}}"

# Verify Docker socket mount
docker inspect frontend | grep docker.sock

# Check backend logs
docker logs frontend
```

---

### Issue: Queue data not available

**Symptoms:**
- "Unable to fetch queue data" message
- Queue section empty

**Solution:**
```bash
# Check RabbitMQ management API
curl http://localhost:15672/api/queues -u guest:guest

# Verify RabbitMQ is running
docker ps | grep rabbitmq

# Check frontend can reach RabbitMQ
docker exec frontend wget -O- http://rabbitmq:15672/api/queues
```

---

### Issue: Charts not rendering

**Symptoms:**
- Canvas appears blank
- No line chart visible

**Solution:**
- ✅ Check browser console for JavaScript errors
- ✅ Verify Chart.js CDN is accessible
- ✅ Clear browser cache and reload
- ✅ Try different browser

---

## 📱 Browser Compatibility

### Tested Browsers
- ✅ Chrome/Edge 90+
- ✅ Firefox 85+
- ✅ Safari 14+

### Required Features
- ✅ ES6 JavaScript support
- ✅ Fetch API
- ✅ Canvas API (for Chart.js)
- ✅ CSS Grid

---

## 🎥 Demo Script for Presentation

**Duration:** 3-5 minutes

1. **Introduction (30 seconds)**
   - "Let me show you the enhanced admin dashboard with four new features"

2. **Feature Showcase (2 minutes)**
   - Show all services healthy
   - Demonstrate service kill/start
   - Point out live logs updating
   - Show queue monitoring
   - Highlight metric graphs

3. **Resilience Demo (1.5 minutes)**
   - Kill kitchen service
   - Place orders
   - Show queue growing
   - Restart service
   - Watch queue drain

4. **Metrics Analysis (1 minute)**
   - Explain graph trends
   - Show JSON details
   - Point out performance metrics

**Key Talking Points:**
- "System handles failures gracefully"
- "Full observability without terminal access"
- "Real-time monitoring of all components"
- "Docker integration for service management"

---

## ✨ Summary

You now have a fully-featured admin dashboard with:
- ✅ Service start/restart capabilities
- ✅ Live log streaming (50 lines, 2-second updates)
- ✅ RabbitMQ queue monitoring
- ✅ Interactive performance graphs (20-point history)

**Ready to test? Start at the top and work through each feature!**

---

**Document Version**: 1.0  
**Last Updated**: March 3, 2026
