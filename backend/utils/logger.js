// Production-safe logger utility

const isDevelopment = process.env.NODE_ENV !== 'production';

const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  
  error: (...args) => {
    // Always log errors
    console.error(...args);
  },
  
  warn: (...args) => {
    if (isDevelopment) {
      console.warn(...args);
    }
  },
  
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  
  debug: (...args) => {
    if (isDevelopment || process.env.DEBUG === 'true') {
      console.debug(...args);
    }
  },
  
  // Production logger for important events
  production: (...args) => {
    if (process.env.NODE_ENV === 'production') {
      // In production, you'd send this to a logging service
      console.log('[PROD]', new Date().toISOString(), ...args);
    }
  }
};

module.exports = logger;
