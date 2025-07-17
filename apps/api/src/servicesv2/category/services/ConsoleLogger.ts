import { Logger } from "../types";

/**
 * Simple console logger implementation
 * 
 * Provides structured logging with JSON context serialization
 * and fallback handling for non-serializable data.
 */
export class ConsoleLogger implements Logger {
  error(message: string, context?: Record<string, unknown>): void {
    if (context) {
      try {
        console.error(message, JSON.stringify(context, null, 2));
      } catch {
        console.error(message, "[Context contains non-serializable data]");
      }
    } else {
      console.error(message);
    }
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      try {
        console.warn(message, JSON.stringify(context, null, 2));
      } catch {
        console.warn(message, "[Context contains non-serializable data]");
      }
    } else {
      console.warn(message);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (context) {
      try {
        console.info(message, JSON.stringify(context, null, 2));
      } catch {
        console.info(message, "[Context contains non-serializable data]");
      }
    } else {
      console.info(message);
    }
  }
}