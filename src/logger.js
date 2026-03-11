function maskPhone(value) {
  if (!value || value.length < 4) {
    return value || "";
  }

  return `***${value.slice(-4)}`;
}

export function createLogger(serviceName) {
  function log(level, message, fields = {}) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: serviceName,
      message,
      ...fields
    };

    if (payload.from) {
      payload.from = maskPhone(payload.from);
    }

    if (payload.to) {
      payload.to = maskPhone(payload.to);
    }

    console.log(JSON.stringify(payload));
  }

  return {
    info(message, fields) {
      log("info", message, fields);
    },
    warn(message, fields) {
      log("warn", message, fields);
    },
    error(message, fields) {
      log("error", message, fields);
    }
  };
}
