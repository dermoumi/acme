import type { Transport, TransportMakeRequestResponse } from "@sentry/core";

const NOT_CONFIGURED = 404;

// A 404 means the server has no dsn, so every later send is a billed no-op.
export function stopWhenUnconfigured<Options>(
  makeTransport: (options: Options) => Transport,
): (options: Options) => Transport {
  return (options) => {
    const inner = makeTransport(options);
    let unconfigured = false;

    return {
      send: async (envelope): Promise<TransportMakeRequestResponse> => {
        if (unconfigured) return {};
        const response = await inner.send(envelope);
        unconfigured = response.statusCode === NOT_CONFIGURED;
        return response;
      },
      flush: async (timeout) => inner.flush(timeout),
    };
  };
}
