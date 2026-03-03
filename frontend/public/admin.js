const POLL_MS = 2000;
const GATEWAY_ALERT_MS = 30000;
const LOG_TAIL = 50;

const healthGrid = document.getElementById('healthGrid');
const metricsGrid = document.getElementById('metricsGrid');
const gatewayAlert = document.getElementById('gatewayAlert');
const queueGrid = document.getElementById('queueGrid');
const logsContainer = document.getElementById('logsContainer');

const serviceViews = new Map();
const gatewaySamples = [];
const metricsHistory = new Map();
const chartInstances = new Map();

function createServiceCard(service) {
  const healthCard = document.createElement('div');
  healthCard.className = 'service-card';

  const title = document.createElement('h3');
  title.textContent = service.name;

  const statusRow = document.createElement('div');
  statusRow.className = 'status-row';

  const dot = document.createElement('span');
  dot.className = 'dot dot-red';

  const text = document.createElement('span');
  text.textContent = 'Unknown';

  const buttonContainer = document.createElement('div');
  buttonContainer.style.display = 'flex';
  buttonContainer.style.gap = '8px';
  buttonContainer.style.marginTop = '8px';

  const chaosButton = document.createElement('button');
  chaosButton.textContent = 'Chaos Kill';
  chaosButton.style.flex = '1';
  const chaosSupported = !['Identity', 'Gateway'].includes(service.name);
  if (!chaosSupported) {
    chaosButton.disabled = true;
    chaosButton.title = 'Chaos Kill is not implemented for this service';
  }
  chaosButton.addEventListener('click', async () => {
    if (!chaosSupported) {
      return;
    }

    chaosButton.disabled = true;
    const originalText = chaosButton.textContent;
    chaosButton.textContent = 'Killing...';

    try {
      const response = await fetch(`${service.url}/chaos/kill`, { method: 'POST' });
      if (!response.ok) {
        let message = `Chaos kill failed (${response.status})`;
        try {
          const body = await response.json();
          if (body && body.error) {
            message = body.error;
          }
        } catch (error) {
          // ignore parse errors
        }
        dot.className = 'dot dot-red';
        text.textContent = message;
      } else {
        dot.className = 'dot dot-red';
        text.textContent = 'Chaos kill triggered';
      }
    } catch (error) {
      dot.className = 'dot dot-red';
      text.textContent = 'Chaos kill request failed';
    } finally {
      chaosButton.textContent = originalText;
      setTimeout(() => {
        chaosButton.disabled = false;
      }, 1500);
    }
  });

  const startButton = document.createElement('button');
  startButton.textContent = 'Start Service';
  startButton.style.flex = '1';
  startButton.style.backgroundColor = '#10b981';
  startButton.addEventListener('click', async () => {
    startButton.disabled = true;
    const originalText = startButton.textContent;
    startButton.textContent = 'Starting...';

    try {
      const response = await fetch(`/api/docker/start/${service.name}`, { method: 'POST' });
      if (!response.ok) {
        const body = await response.json();
        text.textContent = `Start failed: ${body.error}`;
      } else {
        text.textContent = 'Starting...';
        setTimeout(() => pollService(serviceViews.get(service.name)), 2000);
      }
    } catch (error) {
      text.textContent = 'Start request failed';
    } finally {
      startButton.textContent = originalText;
      setTimeout(() => {
        startButton.disabled = false;
      }, 1500);
    }
  });

  buttonContainer.appendChild(chaosButton);
  buttonContainer.appendChild(startButton);

  statusRow.appendChild(dot);
  statusRow.appendChild(text);
  healthCard.appendChild(title);
  healthCard.appendChild(statusRow);
  healthCard.appendChild(buttonContainer);

  // Metrics card with canvas for chart
  const metricsCard = document.createElement('div');
  metricsCard.className = 'service-card';

  const metricsTitle = document.createElement('h3');
  metricsTitle.textContent = `${service.name} Metrics`;

  const canvasContainer = document.createElement('div');
  canvasContainer.style.position = 'relative';
  canvasContainer.style.height = '200px';
  canvasContainer.style.marginBottom = '10px';

  const canvas = document.createElement('canvas');
  canvas.id = `chart-${service.name}`;
  canvasContainer.appendChild(canvas);

  const metricsPre = document.createElement('pre');
  metricsPre.textContent = '{}';
  metricsPre.style.fontSize = '12px';
  metricsPre.style.maxHeight = '150px';
  metricsPre.style.overflow = 'auto';

  metricsCard.appendChild(metricsTitle);
  metricsCard.appendChild(canvasContainer);
  metricsCard.appendChild(metricsPre);

  healthGrid.appendChild(healthCard);
  metricsGrid.appendChild(metricsCard);

  // Initialize chart
  const ctx = canvas.getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Avg Latency (ms)',
        data: [],
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top'
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });

  chartInstances.set(service.name, chart);
  metricsHistory.set(service.name, []);

  // Create log viewer
  const logCard = document.createElement('div');
  logCard.className = 'service-card';
  logCard.style.gridColumn = 'span 2';

  const logTitle = document.createElement('h3');
  logTitle.textContent = `${service.name} Logs`;

  const logPre = document.createElement('pre');
  logPre.className = 'log-viewer';
  logPre.textContent = 'Loading logs...';

  logCard.appendChild(logTitle);
  logCard.appendChild(logPre);
  logsContainer.appendChild(logCard);

  serviceViews.set(service.name, {
    service,
    healthDot: dot,
    healthText: text,
    metricsPre,
    logPre,
    canvas
  });
}

function updateChart(serviceName, latency) {
  const chart = chartInstances.get(serviceName);
  const history = metricsHistory.get(serviceName);
  
  if (!chart || !history) return;

  const now = new Date().toLocaleTimeString();
  history.push({ time: now, latency });

  // Keep only last 20 data points
  if (history.length > 20) {
    history.shift();
  }

  chart.data.labels = history.map(h => h.time);
  chart.data.datasets[0].data = history.map(h => h.latency);
  chart.update('none');
}

function updateGatewayAlert(metrics) {
  const sample = Number(metrics.avg_http_latency_ms);
  if (!Number.isFinite(sample)) {
    return;
  }

  gatewaySamples.push({ value: sample, at: Date.now() });

  const cutoff = Date.now() - GATEWAY_ALERT_MS;
  while (gatewaySamples.length > 0 && gatewaySamples[0].at < cutoff) {
    gatewaySamples.shift();
  }

  if (gatewaySamples.length === 0) {
    gatewayAlert.classList.add('hidden');
    return;
  }

  const avg = gatewaySamples.reduce((sum, item) => sum + item.value, 0) / gatewaySamples.length;
  if (avg > 1000) {
    gatewayAlert.classList.remove('hidden');
  } else {
    gatewayAlert.classList.add('hidden');
  }
}

async function pollService(view) {
  const { service, healthDot, healthText, metricsPre, logPre } = view;

  try {
    const healthResponse = await fetch(`${service.url}/health`);
    const healthy = healthResponse.status === 200;
    healthDot.className = healthy ? 'dot dot-green' : 'dot dot-red';
    healthText.textContent = healthy ? 'Healthy' : `Unhealthy (${healthResponse.status})`;
  } catch (error) {
    healthDot.className = 'dot dot-red';
    healthText.textContent = 'Unreachable';
  }

  try {
    const metricsUrl = (service.name === 'Identity' || service.name === 'Gateway') 
      ? `${service.url}/metrics/json` 
      : `${service.url}/metrics`;
    const metricsResponse = await fetch(metricsUrl);
    if (!metricsResponse.ok) {
      throw new Error(String(metricsResponse.status));
    }

    const metrics = await metricsResponse.json();
    metricsPre.textContent = JSON.stringify(metrics, null, 2);

    // Update chart with latency data
    const latency = metrics.avg_http_latency_ms || metrics.avg_job_latency_ms || 0;
    updateChart(service.name, latency);

    if (service.name === 'Gateway') {
      updateGatewayAlert(metrics);
    }
  } catch (error) {
    metricsPre.textContent = JSON.stringify({ error: 'metrics unavailable' }, null, 2);
  }

  // Fetch logs
  try {
    const logsResponse = await fetch(`/api/docker/logs/${service.name}?tail=${LOG_TAIL}`);
    if (logsResponse.ok) {
      const logsData = await logsResponse.json();
      logPre.textContent = logsData.logs || 'No logs available';
      logPre.scrollTop = logPre.scrollHeight;
    }
  } catch (error) {
    // Silently fail for logs
  }
}

async function pollQueues() {
  try {
    const response = await fetch('/api/rabbitmq/queues');
    if (!response.ok) {
      throw new Error('Failed to fetch queue status');
    }

    const data = await response.json();
    
    queueGrid.innerHTML = '';
    
    if (data.queues && data.queues.length > 0) {
      data.queues.forEach(queue => {
        const queueCard = document.createElement('div');
        queueCard.className = 'service-card';

        const title = document.createElement('h3');
        title.textContent = queue.name;

        const stats = document.createElement('div');
        stats.innerHTML = `
          <div style="margin: 8px 0;">
            <strong>Total Messages:</strong> ${queue.messages}
          </div>
          <div style="margin: 8px 0;">
            <strong>Ready:</strong> ${queue.messages_ready}
          </div>
          <div style="margin: 8px 0;">
            <strong>Unacknowledged:</strong> ${queue.messages_unacknowledged}
          </div>
          <div style="margin: 8px 0;">
            <strong>Consumers:</strong> ${queue.consumers}
          </div>
          <div style="margin: 8px 0;">
            <strong>State:</strong> <span class="dot ${queue.state === 'running' ? 'dot-green' : 'dot-red'}"></span> ${queue.state}
          </div>
        `;

        queueCard.appendChild(title);
        queueCard.appendChild(stats);
        queueGrid.appendChild(queueCard);
      });
    } else {
      queueGrid.innerHTML = '<div style="padding: 20px; text-align: center;">Unable to fetch queue data</div>';
    }
  } catch (error) {
    queueGrid.innerHTML = `<div style="padding: 20px; text-align: center; color: #ef4444;">Error: ${error.message}</div>`;
  }
}

    if (service.name === 'Gateway') {
      updateGatewayAlert(metrics);
    }
  } catch (error) {
    metricsPre.textContent = JSON.stringify({ error: 'metrics unavailable' }, null, 2);
  }
}


async function pollAll() {
  const views = Array.from(serviceViews.values());
  await Promise.all(views.map((view) => pollService(view)));
  await pollQueues();
}

async function init() {
  const configResponse = await fetch('/api/config');
  const config = await configResponse.json();

  config.services.forEach((service) => createServiceCard(service));

  await pollAll();
  setInterval(pollAll, POLL_MS);
}

init().catch(() => {
  gatewayAlert.textContent = 'Failed to load frontend config';
  gatewayAlert.classList.remove('hidden');
});
