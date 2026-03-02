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

async function getMetricsJson(req, res) {
    const metrics = await client.register.getMetricsAsJSON();
    const result = {
        http_requests_total: 0,
        http_failures_total: 0,
        avg_http_latency_ms: 0
    };
    
    metrics.forEach(metric => {
        if (metric.name === 'gateway_http_request_duration_ms' && metric.values.length > 0) {
            const sum = metric.values.find(v => v.metricName === 'gateway_http_request_duration_ms_sum');
            const count = metric.values.find(v => v.metricName === 'gateway_http_request_duration_ms_count');
            if (sum && count && count.value > 0) {
                result.http_requests_total = count.value;
                result.avg_http_latency_ms = Number((sum.value / count.value).toFixed(2));
            }
        } else if (metric.name === 'gateway_request_total' && metric.values.length > 0) {
            result.http_requests_total = metric.values[0].value;
        } else if (metric.name === 'gateway_request_failures_total' && metric.values.length > 0) {
            result.http_failures_total = metric.values[0].value;
        }
    });
    
    res.json(result);
}

module.exports = {
    metricsMiddleware,
    getMetrics,
    getMetricsJson,
    requestCount,
    failureCount
};