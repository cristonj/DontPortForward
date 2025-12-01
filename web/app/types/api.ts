export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export interface ApiEndpoint {
  path: string;
  method: HttpMethod;
  description: string;
  defaultBody?: string;
}

