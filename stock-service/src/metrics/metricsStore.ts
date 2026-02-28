interface Metrics {
    totalDeductionRequests: number;
    totalSuccessfulDeductions: number;
    totalFailedDeductions: number;
    totalResponseTimeMs: number;
    responseCount: number;
}

class MetricsStore {
    private metrics: Metrics = {
        totalDeductionRequests: 0,
        totalSuccessfulDeductions: 0,
        totalFailedDeductions: 0,
        totalResponseTimeMs: 0,
        responseCount: 0,
    };

    incrementRequests(): void {
        this.metrics.totalDeductionRequests++;
    }

    incrementSuccessful(): void {
        this.metrics.totalSuccessfulDeductions++;
    }

    incrementFailed(): void {
        this.metrics.totalFailedDeductions++;
    }

    recordResponseTime(ms: number): void {
        this.metrics.totalResponseTimeMs += ms;
        this.metrics.responseCount++;
    }

    getMetrics(): {
        total_deduction_requests: number;
        total_successful_deductions: number;
        total_failed_deductions: number;
        average_response_time_ms: number;
    } {
        return {
            total_deduction_requests: this.metrics.totalDeductionRequests,
            total_successful_deductions: this.metrics.totalSuccessfulDeductions,
            total_failed_deductions: this.metrics.totalFailedDeductions,
            average_response_time_ms:
                this.metrics.responseCount > 0
                    ? Math.round(
                        (this.metrics.totalResponseTimeMs / this.metrics.responseCount) * 100
                    ) / 100
                    : 0,
        };
    }

    reset(): void {
        this.metrics = {
            totalDeductionRequests: 0,
            totalSuccessfulDeductions: 0,
            totalFailedDeductions: 0,
            totalResponseTimeMs: 0,
            responseCount: 0,
        };
    }
}

export const metricsStore = new MetricsStore();
