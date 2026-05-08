export const protocolEngineIntegration = {
  suggestMilestones(useOfFunds: string) {
    return [
      {
        milestone: "Replication package",
        targetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        deliverable: `Finalize experimental protocol for ${useOfFunds}`,
      },
      {
        milestone: "Validation readout",
        targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        deliverable: "Deliver pre-specified biomarker and mechanistic endpoints.",
      },
    ]
  },
}
