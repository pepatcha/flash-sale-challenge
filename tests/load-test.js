import http from "k6/http";
import { check } from "k6";
import { Counter } from "k6/metrics";

const successfulPurchases = new Counter("successful_purchases");
const soldOutResponses = new Counter("sold_out_responses");
const errorResponses = new Counter("error_responses");

const VUS = parseInt(__ENV.LOAD_VUS || "1000");
const ITERATIONS = parseInt(__ENV.LOAD_ITERATIONS || "100000");
const ERROR_THRESHOLD = Math.ceil(ITERATIONS * 0.01); // 1%

export const options = {
    scenarios: {
        flash_sale: {
            executor: "shared-iterations",
            vus: VUS,
            iterations: ITERATIONS,
            maxDuration: "300s",
        },
    },
    thresholds: {
        http_req_duration: ["p(95)<5000", "p(99)<10000"],
        error_responses: [`count<${ERROR_THRESHOLD}`],
    },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const STOCK = parseInt(__ENV.INITIAL_STOCK || "10");

export default function () {
    const payload = JSON.stringify({
        productID: 1,
        userID: `load-user-${__VU}-${__ITER}`,
    });

    const params = {
        headers: { "Content-Type": "application/json" },
    };

    const res = http.post(`${BASE_URL}/api/purchase`, payload, params);

    check(res, {
        "status is 200 or 409": (r) => r.status === 200 || r.status === 409,
    });

    if (res.status === 200) {
        successfulPurchases.add(1);
    } else if (res.status === 409) {
        soldOutResponses.add(1);
    } else {
        errorResponses.add(1);
    }
}

export function handleSummary(data) {
    const successCount = data.metrics.successful_purchases?.values?.count || 0;
    const soldOutCount = data.metrics.sold_out_responses?.values?.count || 0;
    const errorCount = data.metrics.error_responses?.values?.count || 0;
    const totalRequests = data.metrics.http_reqs?.values?.count || 0;
    const avgDuration = data.metrics.http_req_duration?.values?.avg?.toFixed(2) || 0;
    const p95Duration = data.metrics.http_req_duration?.values["p(95)"]?.toFixed(2) || 0;
    const p99Duration = data.metrics.http_req_duration?.values["p(99)"]?.toFixed(2) || 0;

    const summary = `
        ====================================
        === FLASH SALE LOAD TEST RESULTS ===
        ====================================
        Total Requests:          ${totalRequests}
        Successful Purchases:    ${successCount}
        Sold Out Responses:      ${soldOutCount}
        Error Responses:         ${errorCount}

        Response Time (avg):     ${avgDuration}ms
        Response Time (p95):     ${p95Duration}ms
        Response Time (p99):     ${p99Duration}ms

        OVERSELL CHECK: ${successCount <= STOCK ? "✅ PASS — No overselling detected" : "❌ FAIL — OVERSELLING DETECTED!"}
        Expected max purchases:  ${STOCK}
        Actual purchases:        ${successCount}
        ====================================
    `;

    return {
        stdout: summary,
        "tests/load-test-results.json": JSON.stringify(data, null, 2),
    };
}
