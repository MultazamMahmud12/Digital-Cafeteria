const STATUS_ORDER = {
  PENDING: 0,
  STOCK_VERIFIED: 1,
  IN_KITCHEN: 2,
  READY: 3
};

let config = null;
let token = null;
let activeOrderId = null;
let currentStatus = null;
let ws = null;

const loginForm = document.getElementById('loginForm');
const orderForm = document.getElementById('orderForm');
const authInfo = document.getElementById('authInfo');
const orderInfo = document.getElementById('orderInfo');
const trackerItems = Array.from(document.querySelectorAll('#statusTracker li'));

function setTrackerStatus(nextStatus) {
  if (!STATUS_ORDER[nextStatus] && nextStatus !== 'PENDING') {
    return;
  }

  if (currentStatus && STATUS_ORDER[nextStatus] <= STATUS_ORDER[currentStatus]) {
    return;
  }

  currentStatus = nextStatus;

  trackerItems.forEach((item) => {
    const itemStatus = item.dataset.status;
    item.classList.remove('active', 'done');

    if (STATUS_ORDER[itemStatus] < STATUS_ORDER[nextStatus]) {
      item.classList.add('done');
    } else if (itemStatus === nextStatus) {
      item.classList.add('active');
    }
  });
}

function resetTracker() {
  currentStatus = null;
  trackerItems.forEach((item) => item.classList.remove('active', 'done'));
}

function getTokenFromResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload.token || payload.accessToken || payload.jwt || null;
}

function getOrderIdFromResponse(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload.orderId || payload.id || null;
}

function closeWs() {
  if (ws) {
    try {
      ws.close();
    } catch (error) {
      // ignore
    }
    ws = null;
  }
}

function connectWs(orderId) {
  closeWs();

  ws = new WebSocket(config.notificationWsUrl);

  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'subscribe', orderId }));
  });

  ws.addEventListener('message', (event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      return;
    }

    if (!message || message.type !== 'order_status') {
      return;
    }

    if (message.orderId !== activeOrderId) {
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(STATUS_ORDER, message.status)) {
      return;
    }

    setTrackerStatus(message.status);
    orderInfo.textContent = `Order ${activeOrderId}: ${message.status}`;
  });
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const studentId = document.getElementById('studentId').value.trim();
  const password = document.getElementById('password').value;

  authInfo.textContent = 'Signing in...';

  try {
    const response = await fetch(`${config.identityBaseUrl}${config.identityLoginPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password })
    });

    if (!response.ok) {
      throw new Error(`Login failed (${response.status})`);
    }

    const payload = await response.json();
    const extractedToken = getTokenFromResponse(payload);

    if (!extractedToken) {
      throw new Error('Token not found in login response');
    }

    token = extractedToken;
    authInfo.textContent = `Signed in as ${studentId}`;
  } catch (error) {
    token = null;
    authInfo.textContent = error.message;
  }
});

orderForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!token) {
    orderInfo.textContent = 'Sign in first';
    return;
  }

  const sku = document.getElementById('sku').value.trim();
  const qty = Number(document.getElementById('qty').value);

  if (!sku || !Number.isInteger(qty) || qty <= 0) {
    orderInfo.textContent = 'Provide valid SKU and quantity';
    return;
  }

  resetTracker();
  setTrackerStatus('PENDING');
  orderInfo.textContent = 'Submitting order...';

  try {
    const idempotencyKey = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;

    const response = await fetch(`${config.gatewayBaseUrl}${config.gatewayOrderPath}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey
      },
      body: JSON.stringify({ items: [{ sku, qty }] })
    });

    if (!response.ok) {
      throw new Error(`Order failed (${response.status})`);
    }

    const payload = await response.json();
    const orderId = getOrderIdFromResponse(payload);

    if (!orderId) {
      throw new Error('orderId missing in gateway response');
    }

    activeOrderId = orderId;
    orderInfo.textContent = `Order ${activeOrderId}: PENDING`;
    connectWs(activeOrderId);
  } catch (error) {
    orderInfo.textContent = error.message;
  }
});

async function init() {
  const response = await fetch('/config');
  config = await response.json();
}

init().catch((error) => {
  authInfo.textContent = `Config load failed: ${error.message}`;
});
