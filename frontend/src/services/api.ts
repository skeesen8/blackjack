import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  User,
  Table,
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
  CreateTableRequest,
  TablesResponse
} from '../types';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    // Use window.ENV if available (for production), otherwise use process.env (for development)
    const windowEnv = (window as any)?.ENV;
    this.baseURL = windowEnv?.REACT_APP_API_URL || process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('access_token');
        // Only add auth header to endpoints that need it
        const authRequiredEndpoints = ['/api/auth/me'];
        const needsAuth = authRequiredEndpoints.some(endpoint => config.url?.includes(endpoint));
        
        if (token && needsAuth) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for error handling
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          localStorage.removeItem('access_token');
          localStorage.removeItem('user');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/auth/register', data);
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/auth/login', data);
    return response.data;
  }

  async createGuestUser(): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/auth/guest');
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse<User>> {
    const response: AxiosResponse<ApiResponse<User>> = await this.api.get('/api/auth/me');
    return response.data;
  }

  // Table endpoints
  async getTables(): Promise<TablesResponse> {
    const response: AxiosResponse<TablesResponse> = await this.api.get('/api/tables');
    return response.data;
  }

  async getTable(tableId: string): Promise<ApiResponse<Table>> {
    const response: AxiosResponse<ApiResponse<Table>> = await this.api.get(`/api/tables/${tableId}`);
    return response.data;
  }

  async createTable(data: CreateTableRequest): Promise<ApiResponse<Table>> {
    const response: AxiosResponse<ApiResponse<Table>> = await this.api.post('/api/tables', data);
    return response.data;
  }

  async joinTable(tableId: string, playerId: string, playerName: string): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.post(`/api/tables/${tableId}/join`, {
      player_id: playerId,
      player_name: playerName
    });
    return response.data;
  }

  async placeBet(tableId: string, playerId: string, amount: number): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.post(`/api/tables/${tableId}/bet`, {
      player_id: playerId,
      amount: amount
    });
    return response.data;
  }

  async playerAction(tableId: string, playerId: string, action: string, handIndex: number = 0): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.post(`/api/tables/${tableId}/action`, {
      player_id: playerId,
      action: action,
      hand_index: handIndex
    });
    return response.data;
  }

  async newRound(tableId: string): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.post(`/api/tables/${tableId}/new-round`);
    return response.data;
  }

  async leaveTable(tableId: string): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.post(`/api/tables/${tableId}/leave`);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.get('/health');
    return response.data;
  }

  // Admin endpoints
  async clearAllTables(): Promise<ApiResponse<any>> {
    const response: AxiosResponse<ApiResponse<any>> = await this.api.post('/api/admin/clear-tables');
    return response.data;
  }

  // WebSocket URL
  getWebSocketUrl(tableId: string): string {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = this.baseURL.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${wsHost}/ws/table/${tableId}`;
  }

  // Auth helpers
  setAuthToken(token: string): void {
    localStorage.setItem('access_token', token);
  }

  removeAuthToken(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  }

  getAuthToken(): string | null {
    return localStorage.getItem('access_token');
  }

  isAuthenticated(): boolean {
    return !!this.getAuthToken();
  }
}

// Create singleton instance
export const apiService = new ApiService();

// Create table service for easier imports
export const tableService = {
  getTables: () => apiService.getTables(),
  getTable: (id: string) => apiService.getTable(id),
  createTable: (data: CreateTableRequest) => apiService.createTable(data),
  joinTable: (id: string, playerId: string, playerName: string) => apiService.joinTable(id, playerId, playerName),
  placeBet: (tableId: string, playerId: string, amount: number) => apiService.placeBet(tableId, playerId, amount),
  playerAction: (tableId: string, playerId: string, action: string, handIndex?: number) => apiService.playerAction(tableId, playerId, action, handIndex),
  newRound: (tableId: string) => apiService.newRound(tableId),
  leaveTable: (id: string) => apiService.leaveTable(id),
};

export default apiService; 