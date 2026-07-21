export default function Loading() {
  return (
    <div className="min-h-screen bg-background">
      <div className="h-16 border-b border-border bg-background" />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <div className="mb-8 space-y-3">
          <div className="h-4 w-24 animate-pulse rounded bg-card" />
          <div className="h-10 w-48 animate-pulse rounded bg-card" />
        </div>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-background p-5">
              <div className="flex items-start justify-between">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-20 animate-pulse rounded bg-card" />
                  <div className="h-5 w-48 animate-pulse rounded bg-card" />
                  <div className="h-3 w-full animate-pulse rounded bg-card" />
                  <div className="h-3 w-3/4 animate-pulse rounded bg-card" />
                </div>
                <div className="h-6 w-16 animate-pulse rounded bg-card" />
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
