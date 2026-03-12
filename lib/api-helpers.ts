import { NextResponse } from 'next/server'

export function apiResponse<T>(data: T, meta?: { total?: number; page?: number; perPage?: number }) {
  return NextResponse.json({ data, error: null, meta })
}

export function apiError(message: string, status: number = 400) {
  return NextResponse.json({ data: null, error: message }, { status })
}

export function handleApiError(error: unknown) {
  console.error('[API Error]', error)
  if (error instanceof Error) {
    if (error.message === 'UNAUTHORIZED') {
      return apiError('Unauthorized', 401)
    }
    return apiError(error.message, 500)
  }
  return apiError('An unexpected error occurred', 500)
}
