const POLL_MS = 2000;
const GATEWAY_ALERT_MS = 30000;

const healthGrid = document.getElementById('healthGrid');
const metricsGrid = document.getElementById('metricsGrid');
const gatewayAlert = document.getElementById('gatewayAlert');

const serviceViews = new Map();
const gatewaySamples = [];

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

  const chaosButton = document.createElement('button');
  chaosButton.textContent = 'Chaos Kill';
  chaosButton.addEventListener('click', async () => {
    try {
      await fetch(`${service.url}/chaos/kill`, { method: 'POST' });
    } catch (error) {
      // ignore
    }
  });

  statusRow.appendChild(dot);
  statusRow.appendChild(text);
  healthCard.appendChild(title);
  healthCard.appendChild(statusRow);
  healthCard.appendChild(chaosButton);

  const metricsCard = document.createElement('div');
  metricsCard.className = 'service-card';

  const metricsTitle = document.createElement('h3');
  metricsTitle.textContent = `${service.name} Metrics`;

  const metricsPre = document.createElement('pre');
  metricsPre.textContent = '{}';

  metricsCard.appendChild(metricsTitle);
  metricsCard.appendChild(metricsPre);

  healthGrid.appendChild(healthCard);
  metricsGrid.appendChild(metricsCard);

  serviceViews.set(service.name, {
    service,
    healthDot: dot,
    healthText: text,
    metricsPre
  });
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
  const { service, healthDot, healthText, metricsPre } = view;

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
}

async function init() {
  const configResponse = await fetch('/config');
  const config = await configResponse.json();

  config.services.forEach((service) => createServiceCard(service));

  await pollAll();
  setInterval(pollAll, POLL_MS);
}

init().catch(() => {
  gatewayAlert.textContent = 'Failed to load frontend config';
  gatewayAlert.classList.remove('hidden');
});
