/**
 * Federated Learning — Admin Training Dashboard
 *
 * Shows FL model registry, training progress, participant stats,
 * privacy budget usage, and server health.
 *
 * @module app/admin/fl/page
 */

import { notFound, redirect } from 'next/navigation'
import { getServerSession } from 'next-auth'

import { AppShell } from "@/components/app-shell"
import { authOptions } from '@/lib/auth'
import { db } from '@/lib/db'
import { env } from '@/lib/env'
import { DEFAULT_FL_CONFIG } from '@/lib/fl/server-config'

export default async function AdminFLDashboardPage() {
  // Feature flag gate — ENABLE_FEDERATED_LEARNING defaults OFF
  if (env.ENABLE_FEDERATED_LEARNING !== 'true') {
    notFound()
  }

  const session = await getServerSession(authOptions)

  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const [
    models,
    totalParticipations,
    uniqueParticipants,
    recentParticipations,
    participationsByStatus,
    totalEpsilonSpent,
  ] = await Promise.all([
    db.federatedModel.findMany({
      orderBy: [{ taskType: 'asc' }, { version: 'desc' }],
      include: {
        _count: { select: { participations: true } },
      },
    }),
    db.fLParticipation.count(),
    db.fLParticipation.groupBy({
      by: ['userId'],
      _count: true,
    }),
    db.fLParticipation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, email: true, name: true } },
        model: { select: { id: true, version: true, taskType: true } },
      },
    }),
    db.fLParticipation.groupBy({
      by: ['status'],
      _count: true,
    }),
    db.fLParticipation.aggregate({
      _sum: { epsilonSpent: true },
    }),
  ])

  const statusCounts = Object.fromEntries(
    participationsByStatus.map((g) => [g.status, g._count]),
  )

  const publishedModels = models.filter((m) => m.status === 'published')
  const trainingModels = models.filter((m) => m.status === 'training')
  const latestModel = publishedModels[0] ?? trainingModels[0] ?? null
  const budgetUsed = totalEpsilonSpent._sum.epsilonSpent ?? 0
  const budgetTotal = DEFAULT_FL_CONFIG.totalEpsilonBudget
  const budgetPercent = budgetTotal > 0 ? Math.min((budgetUsed / budgetTotal) * 100, 100) : 0

  return (
    <AppShell>
      <div className="min-h-full bg-gray-900">
      <main className="mx-auto max-w-7xl px-4 py-10 text-white">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.2em] text-teal-400">
            Privacy-Preserving AI
          </p>
          <h1 className="mt-3 text-4xl font-bold">Federated Learning Dashboard</h1>
          <p className="mt-3 max-w-2xl text-gray-400">
            Monitor FL model training, participant contributions, and privacy budget consumption.
          </p>
        </div>

        {/* Key Metrics */}
        <section className="mb-10">
          <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
            {[
              { label: 'Models registered', value: models.length },
              { label: 'Published models', value: publishedModels.length },
              { label: 'Total participations', value: totalParticipations },
              { label: 'Unique participants', value: uniqueParticipants.length },
              { label: 'Completed rounds', value: statusCounts['completed'] ?? 0 },
              { label: 'Failed rounds', value: statusCounts['failed'] ?? 0 },
              {
                label: 'Privacy budget used',
                value: `${budgetUsed.toFixed(2)} / ${budgetTotal}`,
              },
              {
                label: 'Latest model version',
                value: latestModel ? `v${latestModel.version}` : 'None',
              },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-gray-800 bg-gray-950 p-4">
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Privacy Budget Bar */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Privacy Budget (ε)</h2>
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <div className="flex items-center justify-between text-sm text-gray-400 mb-2">
              <span>ε used: {budgetUsed.toFixed(2)}</span>
              <span>ε total: {budgetTotal}</span>
            </div>
            <div className="h-4 w-full rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPercent > 80
                    ? 'bg-red-500'
                    : budgetPercent > 50
                      ? 'bg-amber-500'
                      : 'bg-teal-500'
                }`}
                style={{ width: `${budgetPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {budgetPercent > 80
                ? '⚠ Privacy budget nearly exhausted. Consider pausing training.'
                : `${(100 - budgetPercent).toFixed(1)}% budget remaining`}
            </p>
          </div>
        </section>

        {/* Model Registry */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Model Registry</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="p-3">Version</th>
                  <th className="p-3">Task</th>
                  <th className="p-3">Architecture</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Rounds</th>
                  <th className="p-3">Clients</th>
                  <th className="p-3">Accuracy</th>
                  <th className="p-3">Loss</th>
                  <th className="p-3">ε</th>
                  <th className="p-3">Participations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {models.map((model) => (
                  <tr key={model.id} className="bg-gray-900 hover:bg-gray-800/50">
                    <td className="p-3 font-mono">v{model.version}</td>
                    <td className="p-3">{model.taskType}</td>
                    <td className="p-3 font-mono text-xs">{model.architecture}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          model.status === 'published'
                            ? 'bg-green-900 text-green-300'
                            : model.status === 'training'
                              ? 'bg-blue-900 text-blue-300'
                              : 'bg-gray-800 text-gray-400'
                        }`}
                      >
                        {model.status}
                      </span>
                    </td>
                    <td className="p-3">{model.roundsCompleted}</td>
                    <td className="p-3">{model.aggregatedFromN}</td>
                    <td className="p-3">
                      {model.accuracy !== null ? `${(model.accuracy * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-3">
                      {model.loss !== null ? model.loss.toFixed(4) : '—'}
                    </td>
                    <td className="p-3">{(model.epsilon ?? 0).toFixed(2)}</td>
                    <td className="p-3">{model._count.participations}</td>
                  </tr>
                ))}
                {models.length === 0 && (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-gray-500">
                      No models registered yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Recent Participations */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Recent Participations</h2>
          <div className="overflow-x-auto rounded-xl border border-gray-800">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-950 text-gray-400">
                <tr>
                  <th className="p-3">Participant</th>
                  <th className="p-3">Model</th>
                  <th className="p-3">Round</th>
                  <th className="p-3">Samples</th>
                  <th className="p-3">Loss</th>
                  <th className="p-3">ε spent</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {recentParticipations.map((p) => (
                  <tr key={p.id} className="bg-gray-900 hover:bg-gray-800/50">
                    <td className="p-3 text-xs">{p.user.email ?? p.user.name ?? p.userId}</td>
                    <td className="p-3 font-mono text-xs">
                      v{p.model.version} ({p.model.taskType})
                    </td>
                    <td className="p-3">{p.round}</td>
                    <td className="p-3">{p.localSampleSize}</td>
                    <td className="p-3">
                      {p.localLoss !== null ? p.localLoss.toFixed(4) : '—'}
                    </td>
                    <td className="p-3">
                      {p.epsilonSpent !== null ? p.epsilonSpent.toFixed(3) : '—'}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                          p.status === 'completed'
                            ? 'bg-green-900 text-green-300'
                            : p.status === 'failed'
                              ? 'bg-red-900 text-red-300'
                              : 'bg-amber-900 text-amber-300'
                        }`}
                      >
                        {p.status}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-gray-400">
                      {p.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                    </td>
                  </tr>
                ))}
                {recentParticipations.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-gray-500">
                      No participations recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Server Configuration */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold mb-3">Server Configuration</h2>
          <div className="rounded-xl border border-gray-800 bg-gray-950 p-6">
            <dl className="grid gap-4 md:grid-cols-3 text-sm">
              {[
                { label: 'Strategy', value: DEFAULT_FL_CONFIG.strategy },
                { label: 'Min clients per round', value: DEFAULT_FL_CONFIG.minClients },
                { label: 'Max clients', value: DEFAULT_FL_CONFIG.maxClients },
                { label: 'Total rounds', value: DEFAULT_FL_CONFIG.totalRounds },
                { label: 'Round timeout', value: `${DEFAULT_FL_CONFIG.roundTimeoutSeconds}s` },
                { label: 'Total ε budget', value: DEFAULT_FL_CONFIG.totalEpsilonBudget },
                { label: 'Per-round ε', value: DEFAULT_FL_CONFIG.perRoundEpsilon.toFixed(4) },
                { label: 'Learning rate', value: DEFAULT_FL_CONFIG.hyperparams.learningRate },
                { label: 'Local epochs', value: DEFAULT_FL_CONFIG.hyperparams.localEpochs },
              ].map((item) => (
                <div key={item.label}>
                  <dt className="text-gray-400">{item.label}</dt>
                  <dd className="mt-1 font-mono text-white">{item.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </main>
    </div>
    </AppShell>
  )
}
