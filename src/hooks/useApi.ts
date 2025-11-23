import { useState, useEffect } from "react";
import { api, apiWithHousehold, handleApiResponse } from "@/lib/api";
import { useHousehold } from "@/contexts/HouseholdContext";

// Generic hook for GET requests
export function useApi<T>(endpoint: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await api.get(endpoint);
      const result = await handleApiResponse(response);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}

// Generic hook for GET requests that require household ID
export function useApiWithHousehold<T>(endpoint: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { householdId } = useHousehold();

  const fetchData = async () => {
    if (!householdId) {
      // Don't set error, just keep loading until household is selected
      setLoading(true);
      return;
    }

    try {
      setLoading(true);
      setError(null); // Clear any previous errors
      const response = await apiWithHousehold.get(endpoint, householdId);
      const result = await handleApiResponse(response);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [householdId, ...dependencies]);

  return { data, loading, error, refetch: fetchData };
}

// Specific hooks for different resources
export function useAccounts() {
  return useApiWithHousehold<any[]>("/accounts");
}

export function useTransactions() {
  return useApiWithHousehold<any[]>("/transactions");
}

export function useCategories() {
  return useApiWithHousehold<any[]>("/categories");
}

export function useAccountGroups() {
  return useApiWithHousehold<any[]>("/account-groups");
}

// Hook to fetch user's households (doesn't require household ID)
export function useHouseholds() {
  return useApi<any[]>("/households");
}