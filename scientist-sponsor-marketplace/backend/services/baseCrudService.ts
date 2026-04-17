import { db } from "@/lib/db"
import { serializeForJson } from "@/scientist-sponsor-marketplace/shared/utils"

type ListOptions = {
  where?: Record<string, unknown>
  include?: Record<string, unknown>
  orderBy?: unknown
  take?: number
}

type CrudConfig = {
  modelName: string
  defaultOrderBy?: unknown
  include?: Record<string, unknown>
}

export class BaseCrudService<TCreate extends Record<string, unknown>, TUpdate extends Record<string, unknown>> {
  private readonly modelName: string
  private readonly defaultOrderBy?: unknown
  private readonly include?: Record<string, unknown>

  constructor(config: CrudConfig) {
    this.modelName = config.modelName
    this.defaultOrderBy = config.defaultOrderBy
    this.include = config.include
  }

  protected get delegate() {
    return (db as unknown as Record<string, any>)[this.modelName]
  }

  async list(options: ListOptions = {}) {
    const records = await this.delegate.findMany({
      where: options.where,
      include: options.include ?? this.include,
      orderBy: options.orderBy ?? this.defaultOrderBy,
      take: options.take,
    })

    return serializeForJson(records)
  }

  async getById(id: string, include?: Record<string, unknown>) {
    const record = await this.delegate.findUnique({
      where: { id },
      include: include ?? this.include,
    })

    return serializeForJson(record)
  }

  async create(data: TCreate) {
    const record = await this.delegate.create({
      data,
      include: this.include,
    })

    return serializeForJson(record)
  }

  async update(id: string, data: TUpdate) {
    const record = await this.delegate.update({
      where: { id },
      data,
      include: this.include,
    })

    return serializeForJson(record)
  }

  async delete(id: string) {
    const record = await this.delegate.delete({ where: { id } })
    return serializeForJson(record)
  }
}
