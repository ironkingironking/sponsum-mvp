export class HttpError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
  }
}

export function errorResponse(error: unknown, fallbackMessage: string, fallbackStatus = 400) {
  if (error instanceof HttpError) {
    return {
      statusCode: error.statusCode,
      body: { error: error.message }
    };
  }

  return {
    statusCode: fallbackStatus,
    body: { error: error instanceof Error ? error.message : fallbackMessage }
  };
}
