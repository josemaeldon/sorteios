// API Client that works in both modes:
// 1. Lovable Cloud (Supabase Edge Functions)
// 2. Selfhosted (direct HTTP to backend API)

interface ApiConfig {
  mode: 'cloud' | 'selfhosted';
  baseUrl: string;
  basicAuth?: { username: string; password: string };
}

// Detect mode based on environment variables
const getApiConfig = (): ApiConfig => {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '';
  const basicAuthUser = import.meta.env.VITE_BASIC_AUTH_USER || '';
  const basicAuthPass = import.meta.env.VITE_BASIC_AUTH_PASS || '';
  
  // If API_BASE_URL is set, we're in selfhosted mode
  if (apiBaseUrl) {
    return {
      mode: 'selfhosted',
      baseUrl: apiBaseUrl,
      basicAuth: basicAuthUser ? { username: basicAuthUser, password: basicAuthPass } : undefined,
    };
  }
  
  // Otherwise, use Supabase
  return {
    mode: 'cloud',
    baseUrl: supabaseUrl,
  };
};

export const apiConfig = getApiConfig();

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
  
  // Add Basic Auth for selfhosted mode if configured
  if (apiConfig.mode === 'selfhosted' && apiConfig.basicAuth) {
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

// API call function that works in both modes
export const callApi = async (action: string, data: Record<string, any> = {}): Promise<any> => {
  console.log(`API Call [${apiConfig.mode}]: ${action}`, data);
  
  if (apiConfig.mode === 'selfhosted') {
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
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    return response.json();
  } else {
    // Supabase Edge Function call
    const { supabase } = await import('@/integrations/supabase/client');
    
    if (!supabase) {
      throw new Error('Supabase client não está configurado. Verifique as variáveis de ambiente.');
    }
    
    const response = await supabase.functions.invoke('postgres-api', {
      body: { action, data },
    });
    
    if (response.error) {
      console.error('API Error:', response.error);
      if (response.error.message?.includes('401') || response.error.message?.includes('Não autorizado')) {
        clearStoredToken();
      }
      throw new Error(response.error.message);
    }
    
    return response.data;
  }
};

export const isCloudMode = (): boolean => apiConfig.mode === 'cloud';
export const isSelfhostedMode = (): boolean => apiConfig.mode === 'selfhosted';
