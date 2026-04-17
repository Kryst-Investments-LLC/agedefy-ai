import type { AgentClass, ScratchpadEntry } from './types'

export class Scratchpad {
  private entries: Map<string, ScratchpadEntry> = new Map()

  write(key: string, value: unknown, writtenBy: AgentClass, ttlMs?: number): void {
    this.entries.set(key, {
      key,
      value,
      writtenBy,
      timestamp: new Date().toISOString(),
      ttlMs,
    })
  }

  read(key: string): ScratchpadEntry | undefined {
    const entry = this.entries.get(key)
    if (!entry) return undefined
    if (this.isExpired(entry)) {
      this.entries.delete(key)
      return undefined
    }
    return entry
  }

  readAll(): Record<string, ScratchpadEntry> {
    const result: Record<string, ScratchpadEntry> = {}
    for (const [key, entry] of this.entries) {
      if (!this.isExpired(entry)) {
        result[key] = entry
      } else {
        this.entries.delete(key)
      }
    }
    return result
  }

  readByAgent(agentClass: AgentClass): Record<string, ScratchpadEntry> {
    const result: Record<string, ScratchpadEntry> = {}
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.entries.delete(key)
        continue
      }
      if (entry.writtenBy === agentClass) {
        result[key] = entry
      }
    }
    return result
  }

  has(key: string): boolean {
    const entry = this.entries.get(key)
    if (!entry) return false
    if (this.isExpired(entry)) {
      this.entries.delete(key)
      return false
    }
    return true
  }

  delete(key: string): boolean {
    return this.entries.delete(key)
  }

  clear(): void {
    this.entries.clear()
  }

  snapshot(): Record<string, ScratchpadEntry> {
    return this.readAll()
  }

  static fromSnapshot(data: Record<string, ScratchpadEntry>): Scratchpad {
    const pad = new Scratchpad()
    for (const [key, entry] of Object.entries(data)) {
      pad.entries.set(key, entry)
    }
    return pad
  }

  get size(): number {
    let count = 0
    for (const [key, entry] of this.entries) {
      if (this.isExpired(entry)) {
        this.entries.delete(key)
      } else {
        count++
      }
    }
    return count
  }

  private isExpired(entry: ScratchpadEntry): boolean {
    if (!entry.ttlMs) return false
    const written = new Date(entry.timestamp).getTime()
    return Date.now() - written > entry.ttlMs
  }
}
