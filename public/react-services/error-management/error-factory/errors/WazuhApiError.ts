import WazuhError from './WazuhError';

export class WazuhApiError extends WazuhError {
  constructor(error: Error, message: string, code?: number) {
    super(
      error,
      message,
      {
        error: {
          message: error.message,
          title: error.message,
          error: error,
        },
        level: 'ERROR',
        severity: 'BUSINESS',
        display: true,
        store: true,
      },
      code,
    );
  }
}
