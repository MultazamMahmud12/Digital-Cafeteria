const onHeaders = require('on-headers');
const client = require('prom-client');

// collect default Node.js/HTTP metrics (gc, heap, cpu, etc.)
client.collectDefaultMetrics();

// custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'auth_http_request_duration_ms',
  help: 'HTTP request duration in ms',
  buckets: [50, 100, 200, 500, 1000, 2000]
});
const loginSuccess = new client.Counter({
  name: 'auth_login_success_total',
  help: 'Total number of successful login attempts'
});
const loginFailure = new client.Counter({
  name: 'auth_login_failure_total',
  help: 'Total number of failed login attempts'
});

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  onHeaders(res, () => end());
  next();
}

function incSuccessfulLogin() {
  loginSuccess.inc();
}

function incFailedLogin() {
  loginFailure.inc();
}

function getMetrics(req, res) {
  res.set('Content-Type', client.register.contentType);
  res.end(client.register.metrics());
}

async function getMetricsJson(req, res) {
  const metrics = await client.register.getMetricsAsJSON();
  const result = {
    http_requests_total: 0,
    http_failures_total: 0,
    avg_http_latency_ms: 0,
    login_success_total: 0,
    login_failure_total: 0
  };
  
  metrics.forEach(metric => {
    if (metric.name === 'auth_http_request_duration_ms' && metric.values.length > 0) {
      const sum = metric.values.find(v => v.metricName === 'auth_http_request_duration_ms_sum');
      const count = metric.values.find(v => v.metricName === 'auth_http_request_duration_ms_count');
      if (sum && count && count.value > 0) {
        result.http_requests_total = count.value;
        result.avg_http_latency_ms = Number((sum.value / count.value).toFixed(2));
      }
    } else if (metric.name === 'auth_login_success_total' && metric.values.length > 0) {
      result.login_success_total = metric.values[0].value;
    } else if (metric.name === 'auth_login_failure_total' && metric.values.length > 0) {
      result.login_failure_total = metric.values[0].value;
    }
  });
  
  res.json(result);
}

module.exports = {
  metricsMiddleware,
  incSuccessfulLogin,
  incFailedLogin,
  getMetrics,
  getMetricsJson
};
