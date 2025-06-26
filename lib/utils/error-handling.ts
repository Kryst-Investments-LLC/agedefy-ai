import { NextResponse } from 'next/server';

export interface APIError {
  message: string;
  status: number;
  code?: string;
}

export const createErrorResponse = (message: string, status: number, code?: string) => {
  const timestamp = new Date().toISOString();
  const codeText = code ? ` [${code}]` : '';
  // eslint-disable-next-line no-console
  console.error(`[${timestamp}] API Error (${status}): ${message}${codeText}`);
  
  return NextResponse.json(
    { 
      error: message,
      ...(code && { code }),
      timestamp 
    }, 
    { status }
  );
};

export const handleAPIError = (error: unknown, context: string) => {
  // eslint-disable-next-line no-console
  console.error(`[${new Date().toISOString()}] ${context} error:`, error);
  
  if (error instanceof Error) {
    return createErrorResponse('Internal server error', 500, 'INTERNAL_ERROR');
  }
  
  return createErrorResponse('Unknown error occurred', 500, 'UNKNOWN_ERROR');
};

export const createValidationErrorResponse = (errors: string[]) => {
  return createErrorResponse(
    `Validation failed: ${errors.join(', ')}`,
    400,
    'VALIDATION_ERROR'
  );
};
