import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useApi = () => {
  const callApi = useCallback(async (action: string, data: Record<string, any> = {}) => {
    console.log(`API Call: ${action}`, data);
    
    const response = await supabase.functions.invoke('postgres-api', {
      body: { action, data }
    });
    
    if (response.error) {
      console.error('API Error:', response.error);
      throw new Error(response.error.message);
    }
    
    console.log(`API Response: ${action}`, response.data);
    return response.data;
  }, []);

  return { callApi };
};
