import pino from 'pino'

const isDevelopment = process.env.NODE_ENV === 'development'
const isServer = typeof window === 'undefined'

export const logger = pino({
  level: isDevelopment ? 'debug' : 'info',
  transport: isDevelopment && !isServer ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: 'SYS:standard'
    }
  } : undefined,
  formatters: {
    level(level) {
      return { level }
    }
  },
  // For server-side, use simple formatting
  ...(isServer && {
    transport: undefined,
    formatters: {
      level(level) {
        return { level }
      },
      log(object) {
        return object
      }
    }
  })
})

// Convenience methods
export const log = {
  debug: (msg: string, data?: any) => logger.debug(data, msg),
  info: (msg: string, data?: any) => logger.info(data, msg),
  warn: (msg: string, data?: any) => logger.warn(data, msg),
  error: (msg: string, error?: Error | any) => {
    if (error instanceof Error) {
      logger.error({ error: error.message, stack: error.stack }, msg)
    } else {
      logger.error({ error }, msg)
    }
  }
}

// Session-specific logging
export const sessionLogger = {
  created: (sessionId: string, name: string) => 
    log.info('Session created', { sessionId: sessionId.slice(0, 8), name }),
  
  updated: (sessionId: string, name: string) => 
    log.info('Session updated', { sessionId: sessionId.slice(0, 8), name }),
  
  deleted: (sessionId: string) => 
    log.info('Session deleted', { sessionId: sessionId.slice(0, 8) }),
  
  fetched: (count: number) => 
    log.info('Sessions fetched', { count }),
    
  syncRequested: () => 
    log.debug('Session sync requested by external event')
}