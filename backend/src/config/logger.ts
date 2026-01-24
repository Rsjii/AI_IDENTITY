import pino from 'pino';
import { isDev } from './env';

const logger = pino({
  level: isDev ? 'debug' : 'info',
  transport: isDev ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
      singleLine: false,
      errorLikeObjectKeys: ['err', 'error'],
    },
  } : undefined,
  // ✅ Force all errors to console
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },
});

export { logger };
export default logger;
