# Admin Dashboard Enhanced Features

**Last Updated**: March 3, 2026

## Overview

The admin dashboard has been significantly enhanced with four major features to provide comprehensive system monitoring and management capabilities.

---

## 🎯 New Features

### 1. **Service Start/Restart Functionality**

#### What It Does
- Each service now has both "Chaos Kill" and "Start Service" buttons
- Allows you to restart services that have been killed or have crashed
- Provides real-time feedback on service startup status

#### How It Works
- When you click "Start Service", the frontend makes a request to the backend
- The backend uses Docker CLI to start the stopped container
- The health check automatically updates after 2 seconds to show the new status

#### Usage
1. Kill a service using the "Chaos Kill" button
2. Observe the service status turning red (Unreachable)
3. Click "Start Service" to bring the service back online
4. Watch the status update to green (Healthy) after a few seconds

#### Technical Implementation
- **Backend Endpoint**: `POST /api/docker/start/:serviceName`
- **Docker Command**: `docker start <container-name>`
- **Container Mapping**: Identity/Gateway/Stock/Kitchen/Notification → corresponding container names

---

### 2. **Live Log Streaming**

#### What It Does
- Displays real-time logs from each microservice
- Updates every 2 seconds with the latest log entries
- Shows logs in a terminal-like viewer with dark theme

#### How It Works
- Frontend polls the backend for Docker container logs
- Backend executes `docker logs <container> --tail <count>` command
- Logs are displayed in chronological order with auto-scroll

#### Features
- **Dark Theme**: Easy-to-read terminal-style display
- **Auto-Scroll**: Automatically scrolls to latest logs
- **Tail Limit**: Shows last 50 log entries (configurable)
- **Error Handling**: Gracefully handles unavailable logs

#### Usage
1. Navigate to the "Service Logs" section on the admin dashboard
2. View logs for each service in separate panels
3. Logs automatically refresh every 2 seconds
4. Monitor service activities, errors, and processing in real-time

#### Technical Implementation
- **Backend Endpoint**: `GET /api/docker/logs/:serviceName?tail=<count>`
- **Default Tail**: 50 lines
- **Update Frequency**: 2000ms (every 2 seconds)

---

### 3. **RabbitMQ Queue Monitoring**

#### What It Does
- Shows real-time status of RabbitMQ message queues
- Displays queue depth, ready messages, unacknowledged messages
- Monitors consumer count and queue state

#### Queues Monitored
- **kitchen.q**: Orders waiting to be processed by Kitchen Service
- **notify.q**: Status updates waiting to be sent by Notification Service

#### Metrics Displayed
For each queue:
- **Total Messages**: Total number of messages in queue
- **Ready**: Messages ready to be consumed
- **Unacknowledged**: Messages being processed but not yet acknowledged
- **Consumers**: Number of active consumers connected
- **State**: Queue state (running/idle/error)

#### How It Works
- Frontend queries the backend every 2 seconds
- Backend connects to RabbitMQ Management API (port 15672)
- Uses default credentials (guest/guest) to fetch queue stats
- Filters and formats data for display

#### Usage
1. View the "RabbitMQ Queue Status" section
2. Monitor message accumulation during peak traffic
3. Identify bottlenecks when messages pile up
4. Verify consumer connectivity

#### Technical Implementation
- **Backend Endpoint**: `GET /api/rabbitmq/queues`
- **RabbitMQ API**: `http://rabbitmq:15672/api/queues`
- **Authentication**: Basic Auth (guest:guest)
- **Update Frequency**: 2000ms

---

### 4. **Enhanced Metrics with Graphs**

#### What It Does
- Visualizes service performance metrics using interactive line charts
- Tracks average latency over time
- Provides both graphical and JSON metric views

#### Features
- **Real-Time Charts**: Line graphs showing latency trends
- **20-Point History**: Keeps last 20 data points for trend analysis
- **Auto-Scaling**: Chart y-axis adjusts to data range
- **Detailed JSON View**: Complete metrics data below each chart

#### Metrics Tracked
For each service:
- **HTTP Services**: Average HTTP request latency
- **Job Processors**: Average job processing latency
- **Request Counts**: Total requests/jobs processed
- **Failure Counts**: Failed requests/jobs
- **Success Rates**: Calculated from success/failure ratios

#### Chart Library
- Uses **Chart.js 4.4.0** for rendering
- Responsive canvas-based charts
- Smooth animations and transitions

#### Usage
1. View the "Live Metrics" section
2. Each service displays a line chart at the top
3. Charts update every 2 seconds with new data
4. JSON metrics displayed below for detailed inspection

#### Technical Implementation
- **Chart Type**: Line chart with single dataset
- **Data Points**: Last 20 readings
- **Update Mode**: Non-animated updates for performance
- **Color Scheme**: Blue (`rgb(59, 130, 246)`)

---

## 🛠 System Requirements

### Docker Access
The frontend container requires access to the Docker daemon to:
- Start/stop containers
- Fetch container logs

This is achieved by mounting the Docker socket:
```yaml
volumes:
  - /var/run/docker.sock:/var/run/docker.sock
```

### RabbitMQ Management Plugin
- Management plugin must be enabled (default with `rabbitmq:3-management` image)
- Port 15672 must be accessible from the frontend container
- Default credentials: `guest/guest`

### CDN Dependencies
- **Chart.js**: Loaded from CDN in admin.html
  ```html
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  ```

---

## 📊 Dashboard Sections Layout

### 1. Service Health (Top Section)
- Grid of service health cards
- Each card shows: Name, Status Dot, Status Text, Two Buttons
- Buttons: "Chaos Kill" (red) and "Start Service" (green)

### 2. RabbitMQ Queue Status (New Section)
- Grid showing active message queues
- Real-time queue metrics
- Visual indicators for queue state

### 3. Live Metrics (Enhanced Section)
- Each service has a card with:
  - Title: Service name + "Metrics"
  - Line chart: 200px height, auto-responsive
  - JSON display: Scrollable metrics data

### 4. Service Logs (New Section)
- Full-width log panels for each service
- Dark terminal theme
- Auto-scrolling log viewer

---

## 🔧 Configuration

### Backend Environment Variables
```bash
# RabbitMQ Management URL (internal Docker network)
RABBITMQ_MANAGEMENT_URL=http://rabbitmq:15672

# Service URLs (for health checks and metrics)
PUBLIC_IDENTITY_URL=http://localhost:8081
PUBLIC_GATEWAY_URL=http://localhost:8090
PUBLIC_STOCK_URL=http://localhost:8082
PUBLIC_KITCHEN_URL=http://localhost:8083
PUBLIC_NOTIFICATION_URL=http://localhost:8084
```

### Frontend Constants (admin.js)
```javascript
const POLL_MS = 2000;           // Poll interval for all updates
const LOG_TAIL = 50;            // Number of log lines to fetch
const GATEWAY_ALERT_MS = 30000; // Gateway latency alert window
```

---

## 🚀 Usage Examples

### Scenario 1: Demonstrating Resilience
1. Kill Kitchen Service using "Chaos Kill"
2. Place orders from student dashboard
3. Observe orders queuing in RabbitMQ (kitchen.q grows)
4. Monitor Gateway logs showing successful order acceptance
5. Start Kitchen Service using "Start Service"
6. Watch kitchen.q drain as orders are processed
7. View Kitchen logs showing order processing

### Scenario 2: Performance Monitoring
1. Open admin dashboard
2. Monitor Gateway metrics chart
3. Place 10+ orders rapidly
4. Observe latency spikes in real-time chart
5. Check if latency exceeds 1000ms (triggers alert banner)
6. Review JSON metrics for detailed breakdown

### Scenario 3: Queue Management
1. Kill Notification Service
2. Place several orders
3. Watch notify.q message count increase
4. Observe consumers = 0 in queue status
5. Start Notification Service
6. Watch consumers = 1 appear
7. See messages drain from queue

---

## 🎨 Styling

### New CSS Classes
```css
.log-viewer {
  /* Dark terminal theme for logs */
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Courier New', monospace;
}

.logs-container {
  /* Container for log panels */
  display: grid;
  grid-template-columns: 1fr;
}
```

### Button Styling
- **Start Button**: Green background (#10b981)
- **Kill Button**: Red/Default theme
- **Disabled State**: Gray background, no hover effect
- **Hover Effect**: Darker shade on hover

---

## 📝 API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | Service configuration |
| POST | `/api/docker/start/:serviceName` | Start a Docker container |
| GET | `/api/docker/logs/:serviceName?tail=<n>` | Get container logs |
| GET | `/api/rabbitmq/queues` | Get RabbitMQ queue status |

---

## ⚠️ Known Limitations

1. **Docker Socket Access**: Requires Docker socket mount (Windows/Mac may need adjustments)
2. **Logs Performance**: Fetching logs every 2 seconds can be resource-intensive for many containers
3. **RabbitMQ Auth**: Uses default credentials; should be configured for production
4. **Chart History**: Limited to 20 data points; older data is discarded
5. **No Restart on Failure**: Services must be manually restarted (as per demo requirement)

---

## 🔐 Security Considerations

### For Production
- [ ] Secure RabbitMQ with custom credentials
- [ ] Implement authentication for admin dashboard
- [ ] Restrict Docker socket access with proper permissions
- [ ] Use TLS for RabbitMQ Management API
- [ ] Rate-limit admin API endpoints
- [ ] Implement audit logging for container operations

---

## 📦 Dependencies Added

### Frontend Server
```javascript
import { exec } from 'child_process';
import { promisify } from 'util';
```

### Dockerfile
```dockerfile
RUN apk add --no-cache docker-cli
```

### HTML
```html
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
```

---

## 🧪 Testing

### Manual Testing Checklist
- [ ] Start all services with `docker compose up -d`
- [ ] Access admin dashboard at `http://localhost:8085/admin.html`
- [ ] Verify all 5 services show green (Healthy)
- [ ] Kill a service and verify red status
- [ ] Start the service and verify it returns to green
- [ ] Check logs are displaying and updating
- [ ] Verify RabbitMQ queues show correct metrics
- [ ] Place orders and watch charts update
- [ ] Verify Gateway latency alert triggers above 1000ms

---

## 🎓 Learning Outcomes

By using the enhanced admin dashboard, students/judges can observe:

1. **Resilience**: Services can be killed and restarted without losing data
2. **Async Communication**: Orders queue up when Kitchen is down
3. **Performance Monitoring**: Real-time latency visualization
4. **Message Durability**: RabbitMQ persists messages through crashes
5. **System Observability**: Complete visibility into system behavior

---

**Document Version**: 1.0  
**Author**: GitHub Copilot  
**Date**: March 3, 2026
