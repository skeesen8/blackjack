import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthResponse } from '../types/game';
import apiService from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string, email?: string) => Promise<boolean>;
  loginAsGuest: () => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  initialize: () => void;
  updateUser: (user: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (username: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response: AuthResponse = await apiService.login(username, password);
          
          if (response.success) {
            apiService.setAuthToken(response.access_token);
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              error: response.message || 'Login failed',
              isLoading: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Login failed';
          set({
            error: errorMessage,
            isLoading: false,
          });
          return false;
        }
      },

      register: async (username: string, password: string, email?: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response: AuthResponse = await apiService.register(username, password, email);
          
          if (response.success) {
            apiService.setAuthToken(response.access_token);
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              error: response.message || 'Registration failed',
              isLoading: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Registration failed';
          set({
            error: errorMessage,
            isLoading: false,
          });
          return false;
        }
      },

      loginAsGuest: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response: AuthResponse = await apiService.createGuestUser();
          
          if (response.success) {
            apiService.setAuthToken(response.access_token);
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({
              error: response.message || 'Guest login failed',
              isLoading: false,
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Guest login failed';
          set({
            error: errorMessage,
            isLoading: false,
          });
          return false;
        }
      },

      logout: () => {
        apiService.removeAuthToken();
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      initialize: () => {
        const token = apiService.getAuthToken();
        const storedUser = localStorage.getItem('user');
        
        if (token && storedUser) {
          try {
            const user = JSON.parse(storedUser);
            set({
              user,
              isAuthenticated: true,
            });
            
            // Verify token is still valid
            apiService.getCurrentUser().catch(() => {
              // Token is invalid, logout
              get().logout();
            });
          } catch (error) {
            // Invalid stored user data, logout
            get().logout();
          }
        }
      },

      updateUser: (userData: Partial<User>) => {
        const currentUser = get().user;
        if (currentUser) {
          const updatedUser = { ...currentUser, ...userData };
          set({ user: updatedUser });
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
); 