import type { FastifyInstance, FastifyReply } from 'fastify'
import type { ApiError, ErrorCode } from '@aiot/shared'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'

export function sendError(reply: FastifyReply, status: number, code: ErrorCode, message: string) {
  const body: ApiError = { error: { code, message } }
  return reply.status(status).send(body)
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      const message = error.validation
        .map((v) => {
          const path = v.instancePath.replace(/^\//, '').replaceAll('/', '.')
          return path ? `${path}: ${v.message}` : (v.message ?? '')
        })
        .join('; ')
      return sendError(reply, 400, 'VALIDATION_ERROR', message)
    }
    const status = (error as { statusCode?: number }).statusCode
    if (status && status >= 400 && status < 500) {
      return sendError(reply, status, 'VALIDATION_ERROR', (error as Error).message)
    }
    request.log.error(error)
    return sendError(reply, 500, 'INTERNAL_ERROR', '伺服器發生錯誤')
  })

  app.setNotFoundHandler((request, reply) =>
    sendError(reply, 404, 'NOT_FOUND', `找不到 ${request.method} ${request.url}`),
  )
}
