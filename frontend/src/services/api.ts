import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  AuthResponse,
  TableListResponse,
  TableResponse,
  PlayerResponse,
  ApiResponse,
  GameTable,
  PlayerAction
} from '../types/game';

class ApiService {
  private api: AxiosInstance;
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
    
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
        if (token) {
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
  async register(username: string, password: string, email?: string): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/auth/register', {
      username,
      password,
      email,
    });
    return response.data;
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/auth/login', {
      username,
      password,
    });
    return response.data;
  }

  async createGuestUser(): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/auth/guest');
    return response.data;
  }

  async getCurrentUser(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/api/auth/me');
    return response.data;
  }

  async refreshToken(): Promise<AuthResponse> {
    const response: AxiosResponse<AuthResponse> = await this.api.post('/api/auth/refresh');
    return response.data;
  }

  // Table endpoints
  async getAllTables(): Promise<TableListResponse> {
    const response: AxiosResponse<TableListResponse> = await this.api.get('/api/tables');
    return response.data;
  }

  async getAvailableTables(): Promise<TableListResponse> {
    const response: AxiosResponse<TableListResponse> = await this.api.get('/api/tables/available');
    return response.data;
  }

  async getActiveTables(): Promise<TableListResponse> {
    const response: AxiosResponse<TableListResponse> = await this.api.get('/api/tables/active');
    return response.data;
  }

  async getTable(tableId: string): Promise<TableResponse> {
    const response: AxiosResponse<TableResponse> = await this.api.get(`/api/tables/${tableId}`);
    return response.data;
  }

  async getTableState(tableId: string, playerId?: string): Promise<TableResponse> {
    const params = playerId ? { player_id: playerId } : {};
    const response: AxiosResponse<TableResponse> = await this.api.get(
      `/api/tables/${tableId}/state`,
      { params }
    );
    return response.data;
  }

  async spectateTable(tableId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get(`/api/tables/${tableId}/spectate`);
    return response.data;
  }

  async getTableStats(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/api/tables/stats');
    return response.data;
  }

  // Game endpoints
  async createTable(name: string, minBet: number = 10, maxBet: number = 500): Promise<TableResponse> {
    const response: AxiosResponse<TableResponse> = await this.api.post('/api/game/tables', {
      name,
      min_bet: minBet,
      max_bet: maxBet,
    });
    return response.data;
  }

  async joinTable(tableId: string, playerName: string): Promise<PlayerResponse> {
    const response: AxiosResponse<PlayerResponse> = await this.api.post(
      `/api/game/tables/${tableId}/join`,
      { player_name: playerName }
    );
    return response.data;
  }

  async leaveTable(tableId: string, playerId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(
      `/api/game/tables/${tableId}/leave`,
      null,
      { params: { player_id: playerId } }
    );
    return response.data;
  }

  async placeBet(tableId: string, playerId: string, amount: number): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(
      `/api/game/tables/${tableId}/bet`,
      { player_id: playerId, amount }
    );
    return response.data;
  }

  async startGame(tableId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(
      `/api/game/tables/${tableId}/start`
    );
    return response.data;
  }

  async playerAction(
    tableId: string,
    playerId: string,
    action: PlayerAction,
    handIndex: number = 0
  ): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(
      `/api/game/tables/${tableId}/action`,
      {
        player_id: playerId,
        action,
        hand_index: handIndex,
      }
    );
    return response.data;
  }

  async resetTable(tableId: string): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.post(
      `/api/game/tables/${tableId}/reset`
    );
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    const response: AxiosResponse<ApiResponse> = await this.api.get('/health');
    return response.data;
  }

  // WebSocket URL
  getWebSocketUrl(tableId: string): string {
    const wsProtocol = this.baseURL.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = this.baseURL.replace(/^https?/, wsProtocol);
    return `${wsBaseUrl}/ws/${tableId}`;
  }

  getChatWebSocketUrl(tableId: string): string {
    const wsProtocol = this.baseURL.startsWith('https') ? 'wss' : 'ws';
    const wsBaseUrl = this.baseURL.replace(/^https?/, wsProtocol);
    return `${wsBaseUrl}/ws/chat/${tableId}`;
  }

  // Utility methods
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

export const apiService = new ApiService();
export default apiService; 