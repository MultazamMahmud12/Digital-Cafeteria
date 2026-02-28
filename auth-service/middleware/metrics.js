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

module.exports = {
  metricsMiddleware,
  incSuccessfulLogin,
  incFailedLogin,
  getMetrics
};
