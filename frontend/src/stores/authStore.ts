import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, AuthResponse } from '../types';
import { apiService } from '../services/api';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
  loginAsGuest: () => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  initialize: () => Promise<void>;
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
          const response: any = await apiService.login({ username, password });
          
          if (response.success) {
            // Store token
            apiService.setAuthToken(response.access_token);
            
            set({
              user: { ...response.user, is_guest: false },
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            return true;
          } else {
            set({
              isLoading: false,
              error: response.message || 'Login failed',
              isAuthenticated: false,
              user: null
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Login failed';
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null
          });
          return false;
        }
      },

      register: async (username: string, email: string, password: string) => {
        set({ isLoading: true, error: null });
        
        try {
          const response: any = await apiService.register({ username, email, password });
          
          if (response.success) {
            // Store token
            apiService.setAuthToken(response.access_token);
            
            set({
              user: { ...response.user, is_guest: false },
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            return true;
          } else {
            set({
              isLoading: false,
              error: response.message || 'Registration failed',
              isAuthenticated: false,
              user: null
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Registration failed';
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null
          });
          return false;
        }
      },

      loginAsGuest: async () => {
        set({ isLoading: true, error: null });
        
        try {
          const response: any = await apiService.createGuestUser();
          
          if (response.success) {
            // Store token
            apiService.setAuthToken(response.access_token);
            
            set({
              user: { ...response.user, is_guest: true },
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
            
            return true;
          } else {
            set({
              isLoading: false,
              error: response.message || 'Guest login failed',
              isAuthenticated: false,
              user: null
            });
            return false;
          }
        } catch (error: any) {
          const errorMessage = error.response?.data?.detail || 'Guest login failed';
          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null
          });
          return false;
        }
      },

      logout: () => {
        apiService.removeAuthToken();
        set({
          user: null,
          isAuthenticated: false,
          error: null
        });
      },

      clearError: () => {
        set({ error: null });
      },

      initialize: async () => {
        const token = apiService.getAuthToken();
        
        if (!token) {
          set({ isLoading: false });
          return;
        }

        set({ isLoading: true });
        
        try {
          const response: any = await apiService.getCurrentUser();
          
          if (response.success) {
            set({
              user: response.user,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } else {
            // Invalid response, clear token
            apiService.removeAuthToken();
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              error: null
            });
          }
        } catch (error) {
          // Token is invalid, clear it
          apiService.removeAuthToken();
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
            error: null
          });
        }
      }
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
); 