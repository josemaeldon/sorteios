// API Client for selfhosted backend
// Connects directly to the backend API via HTTP

interface ApiConfig {
  baseUrl: string;
  basicAuth?: { username: string; password: string };
}

const isPlaceholder = (value: string): boolean => value.startsWith('__') && value.endsWith('__');

const getEnv = (key: string): string => {
  const v = (import.meta as any).env?.[key] ?? '';
  return typeof v === 'string' && !isPlaceholder(v) ? v : '';
};

// Get API configuration from environment or default to relative path
const getApiConfig = (): ApiConfig => {
  const apiBaseUrl = getEnv('VITE_API_BASE_URL');
  const basicAuthUser = getEnv('VITE_BASIC_AUTH_USER');
  const basicAuthPass = getEnv('VITE_BASIC_AUTH_PASS');

  // Use configured API base URL or default to empty (relative path)
  return {
    baseUrl: apiBaseUrl || '',
    basicAuth: basicAuthUser ? { username: basicAuthUser, password: basicAuthPass } : undefined,
  };
};

export const apiConfig = getApiConfig();

export const isSelfhostedMode = true;

// Token storage keys
const TOKEN_KEY = 'bingo_auth_token';

export const getStoredToken = (): string | null => {
  return localStorage.getItem(TOKEN_KEY);
};

export const setStoredToken = (token: string): void => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = (): void => {
  localStorage.removeItem(TOKEN_KEY);
};

// Build authorization header
const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  // Add Basic Auth if configured
  if (apiConfig.basicAuth) {
    const credentials = btoa(`${apiConfig.basicAuth.username}:${apiConfig.basicAuth.password}`);
    headers['X-Basic-Auth'] = `Basic ${credentials}`;
  }
  
  // Add JWT token if available
  const token = getStoredToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// API call function
export const callApi = async (action: string, data: Record<string, any> = {}): Promise<any> => {
  console.log(`API Call: ${action}`, data);
  
  // Direct HTTP call to backend API
  const response = await fetch(`${apiConfig.baseUrl}/api`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ action, data }),
  });
  
  if (!response.ok) {
    if (response.status === 401) {
      clearStoredToken();
      throw new Error('Não autorizado. Faça login novamente.');
    }
    const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }));
    const err = new Error(errorData.error || `HTTP ${response.status}`);
    if (errorData.code) (err as any).code = errorData.code;
    throw err;
  }
  
  return response.json();
};
