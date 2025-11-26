import { api, apiWithHousehold, handleApiResponse } from "@/lib/api";
import { useHousehold } from "@/contexts/HouseholdContext";

// Account services
export const accountService = {
  getAll: async () => {
    const response = await api.get("/accounts");
    return handleApiResponse(response);
  },
  
  create: async (data: any) => {
    const response = await api.post("/accounts", data);
    return handleApiResponse(response);
  },
  
  update: async (id: string, data: any) => {
    const response = await api.put(`/accounts/${id}`, data);
    return handleApiResponse(response);
  },
  
  delete: async (id: string) => {
    const response = await api.delete(`/accounts/${id}`);
    return handleApiResponse(response);
  },
};

// Transaction services
export const transactionService = {
  getAll: async (householdId: string | null) => {
    const response = await apiWithHousehold.get("/transactions", householdId);
    return handleApiResponse(response);
  },
  
  create: async (householdId: string | null, data: any) => {
    const response = await apiWithHousehold.post("/transactions", householdId, data);
    return handleApiResponse(response);
  },
  
  update: async (householdId: string | null, id: string, data: any) => {
    const response = await apiWithHousehold.put(`/transactions/${id}`, householdId, data);
    return handleApiResponse(response);
  },
  
  delete: async (householdId: string | null, id: string) => {
    const response = await apiWithHousehold.delete(`/transactions/${id}`, householdId);
    return handleApiResponse(response);
  },
};

// Category services
export const categoryService = {
  getAll: async (householdId: string | null) => {
    const response = await apiWithHousehold.get("/categories", householdId);
    return handleApiResponse(response);
  },
  
  create: async (householdId: string | null, data: any) => {
    const response = await apiWithHousehold.post("/categories", householdId, data);
    return handleApiResponse(response);
  },
  
  update: async (householdId: string | null, id: string, data: any) => {
    const response = await apiWithHousehold.put(`/categories/${id}`, householdId, data);
    return handleApiResponse(response);
  },
  
  delete: async (householdId: string | null, id: string) => {
    const response = await apiWithHousehold.delete(`/categories/${id}`, householdId);
    return handleApiResponse(response);
  },
};

// Account Group services
export const accountGroupService = {
  getAll: async (householdId: string | null) => {
    const response = await apiWithHousehold.get("/account-groups", householdId);
    return handleApiResponse(response);
  },
  
  create: async (householdId: string | null, data: any) => {
    const response = await apiWithHousehold.post("/account-groups", householdId, data);
    return handleApiResponse(response);
  },
  
  update: async (householdId: string | null, id: string, data: any) => {
    const response = await apiWithHousehold.put(`/account-groups/${id}`, householdId, data);
    return handleApiResponse(response);
  },
  
  delete: async (householdId: string | null, id: string) => {
    const response = await apiWithHousehold.delete(`/account-groups/${id}`, householdId);
    return handleApiResponse(response);
  },
};

// Transfer services
export const transferService = {
  create: async (householdId: string | null, data: any) => {
    const response = await apiWithHousehold.post("/transfers", householdId, data);
    return handleApiResponse(response);
  },
};
