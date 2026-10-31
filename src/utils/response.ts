export interface Metadata {
  currentPage: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export function successBody<T>(message: string, data: T, metadata?: Metadata) {
  return metadata
    ? { status: true, message, data, metadata }
    : { status: true, message, data };
}

export function failBody(message: string) {
  return { status: false, message };
}
