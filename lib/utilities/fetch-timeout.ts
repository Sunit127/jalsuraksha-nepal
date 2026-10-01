/** fetch() that gives up after `ms` so emergency screens never spin forever. */
export class RequestTimeoutError extends Error {
  constructor() {
    super("Request timed out");
    this.name = "RequestTimeoutError";
  }
}

export async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, ms = 20_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new RequestTimeoutError();
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
