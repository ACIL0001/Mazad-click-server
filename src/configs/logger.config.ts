import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';

export const winstonLoggerOptions: winston.LoggerOptions = {
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ all: true }),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:MM:SS' }),
        winston.format.json(),
        winston.format.label(),
        // winston.format.metadata(),
        winston.format.cli(),
        winston.format.printf((info) => {
          let response = `${info.timestamp} [${info.level}] - [${info.context}] \t ${info.message}`;
          if (info.stack) {
            response += `\n${info.stack}`;
          }
          return response;
        }),
      ),
    }),

    new DailyRotateFile({
      filename: 'logs/amigo-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
      ),
    }),
  ],
};
