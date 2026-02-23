const onHeaders = require('on-headers');

let totalRequests = 0;
let successfulLogins = 0;
let failedLogins = 0;
let totalResponseTime = 0; // in ms

function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  // ensure we measure after headers are written
  onHeaders(res, function () {
    const diff = process.hrtime(start);
    const durationMs = diff[0] * 1e3 + diff[1] / 1e6;
    totalRequests += 1;
    totalResponseTime += durationMs;
  });

  next();
}

function incSuccessfulLogin() {
  successfulLogins += 1;
}

function incFailedLogin() {
  failedLogins += 1;
}

function getMetrics() {
  const averageResponseTime = totalRequests === 0 ? 0 : totalResponseTime / totalRequests;
  return {
    totalRequests,
    successfulLogins,
    failedLogins,
    averageResponseTime
  };
}

module.exports = {
  metricsMiddleware,
  incSuccessfulLogin,
  incFailedLogin,
  getMetrics
};
