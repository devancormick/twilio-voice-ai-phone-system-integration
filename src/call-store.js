export function createCallStore(maxEntries = 100) {
  const calls = [];

  function upsert(partial) {
    const callSid = partial.callSid || partial.CallSid;
    if (!callSid) {
      return;
    }

    const existing = calls.find((item) => item.callSid === callSid);
    if (existing) {
      Object.assign(existing, partial, { updatedAt: new Date().toISOString() });
      return;
    }

    calls.unshift({
      ...partial,
      callSid,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    if (calls.length > maxEntries) {
      calls.length = maxEntries;
    }
  }

  return {
    upsert,
    list() {
      return calls.map((call) => ({ ...call }));
    }
  };
}
