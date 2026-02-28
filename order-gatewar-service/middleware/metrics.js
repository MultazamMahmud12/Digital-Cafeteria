const client = require('prom-client');
const onHeaders = require('on-headers');

// collect default system metrics (heap, cpu, etc.)
client.collectDefaultMetrics();

// custom HTTP metrics
const httpRequestDuration = new client.Histogram({
    name: 'gateway_http_request_duration_ms',
    help: 'HTTP request duration in ms',
    buckets: [50, 100, 200, 500, 1000, 2000]
});
const requestCount = new client.Counter({
    name: 'gateway_request_total',
    help: 'Total number of HTTP requests received'
});
const failureCount = new client.Counter({
    name: 'gateway_request_failures_total',
    help: 'Total number of failed (status >=400) HTTP requests'
});

function metricsMiddleware(req, res, next) {
    const end = httpRequestDuration.startTimer();
    onHeaders(res, () => {
        end();
        requestCount.inc();
        if (res.statusCode >= 400) {
            failureCount.inc();
        }
    });
    next();
}

function getMetrics(req, res) {
    res.set('Content-Type', client.register.contentType);
    res.end(client.register.metrics());
}

module.exports = {
    metricsMiddleware,
    getMetrics,
    requestCount,
    failureCount
};