import { NodeSDK } from "@opentelemetry/sdk-node"
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node"
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http"
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http"
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics"
import { resourceFromAttributes } from "@opentelemetry/resources"
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from "@opentelemetry/semantic-conventions"
import { DiagConsoleLogger, DiagLogLevel, diag } from "@opentelemetry/api"

const serviceName = process.env.OTEL_SERVICE_NAME || "biozephyra-ai"
const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || ""
const appEnv = process.env.APP_ENV || "development"

export function isOtelConfigured(): boolean {
  return Boolean(otlpEndpoint)
}

export function initOtelSdk(): NodeSDK | null {
  if (!otlpEndpoint) {
    return null
  }

  if (process.env.OTEL_DEBUG === "true") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.INFO)
  }

  const resource = resourceFromAttributes({
    [ATTR_SERVICE_NAME]: serviceName,
    [ATTR_SERVICE_VERSION]: process.env.npm_package_version || "0.1.0",
    "deployment.environment.name": appEnv,
  })

  const traceExporter = new OTLPTraceExporter({
    url: `${otlpEndpoint}/v1/traces`,
  })

  const metricExporter = new OTLPMetricExporter({
    url: `${otlpEndpoint}/v1/metrics`,
  })

  const metricReader = new PeriodicExportingMetricReader({
    exporter: metricExporter,
    exportIntervalMillis: 30_000,
  })

  const sdk = new NodeSDK({
    resource,
    traceExporter,
    metricReader,
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-http": {
          ignoreIncomingRequestHook: (req) => {
            const url = req.url ?? ""
            // Don't trace health checks or static assets
            return url === "/api/health" || url.startsWith("/_next/")
          },
        },
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-dns": { enabled: false },
      }),
    ],
  })

  sdk.start()
  return sdk
}
