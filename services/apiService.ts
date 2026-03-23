
import { apiUrl, getApiBaseUrl } from './runtimeBase';

const BASE_URL = getApiBaseUrl();
const API_URL = apiUrl('/api/system');

export const apiService = {
  async isServerOnline() {
    try {
      const response = await fetch(`${BASE_URL}/health`, { 
        method: 'GET',
        cache: 'no-store',
        mode: 'cors'
      });
      return response.ok;
    } catch (e) {
      return false;
    }
  },

  async fetchAllData() {
    try {
      const response = await fetch(`${API_URL}/data`, { cache: 'no-store' });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error("Erro ao buscar dados do servidor local:", error);
      return null;
    }
  },

  async syncData(payload: any) {
    try {
      const response = await fetch(`${API_URL}/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) return await response.json();
      throw new Error("Falha na sincronização com o HD");
    } catch (error) {
      console.error("O motor local está offline. Dados não salvos.");
      return { status: 'error', message: 'Motor Offline' };
    }
  }
};
