export class HttpError extends Error {
  status: number
  field?: string

  constructor(status: number, message: string, field?: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.field = field
  }
}
