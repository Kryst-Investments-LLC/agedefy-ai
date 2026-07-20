export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initOtelSdk } = await import("@/lib/observability/otel")
    const sdk = initOtelSdk()
    if (sdk) {
      const { registerJobQueueAgeGauge } = await import("@/lib/observability/job-queue-gauge")
      registerJobQueueAgeGauge()
      console.log(
        `[otel] OpenTelemetry initialized — service=${process.env.OTEL_SERVICE_NAME || "biozephyra-ai"} endpoint=${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}`,
      )
    }
  }
}
