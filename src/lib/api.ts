import { getSession } from "next-auth/react";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

// Generic API request function
async function apiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getSession();
  
  const headers = {
    "Content-Type": "application/json",
    ...(session && { Authorization: `Bearer ${session.user?.email}` }),
    ...options.headers,
  };

  const url = `${API_BASE_URL}/api${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers,
  });
}

// API request function that includes household ID
async function apiRequestWithHousehold(
  endpoint: string,
  householdId: string | null,
  options: RequestInit = {}
): Promise<Response> {
  const session = await getSession();
  
  const headers = {
    "Content-Type": "application/json",
    ...(session && { Authorization: `Bearer ${session.user?.email}` }),
    ...(householdId && { "X-Household-ID": householdId }),
    ...options.headers,
  };

  const url = `${API_BASE_URL}/api${endpoint}`;
  
  return fetch(url, {
    ...options,
    headers,
  });
}

// Typed API methods
export const api = {
  get: (endpoint: string) => apiRequest(endpoint),
  post: (endpoint: string, data: any) =>
    apiRequest(endpoint, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  put: (endpoint: string, data: any) =>
    apiRequest(endpoint, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (endpoint: string) =>
    apiRequest(endpoint, {
      method: "DELETE",
    }),
};

// API methods that include household ID
export const apiWithHousehold = {
  get: (endpoint: string, householdId: string | null) =>
    apiRequestWithHousehold(endpoint, householdId),
  post: (endpoint: string, householdId: string | null, data: any) =>
    apiRequestWithHousehold(endpoint, householdId, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  put: (endpoint: string, householdId: string | null, data: any) =>
    apiRequestWithHousehold(endpoint, householdId, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (endpoint: string, householdId: string | null) =>
    apiRequestWithHousehold(endpoint, householdId, {
      method: "DELETE",
    }),
};

// Error handling utility
export async function handleApiResponse(response: Response) {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Request failed with status ${response.status}`);
  }
  return response.json();
}