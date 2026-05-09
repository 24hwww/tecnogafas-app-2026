// DEPRECATED: This service has been replaced by unifiedAuthService.ts
// Please use unifiedAuthService for all authentication operations
// This file is kept for backward compatibility only

import type { Seller, User } from '../types';

// Re-export for backward compatibility
export const authService = {
  loginSeller: async (pin: string): Promise<Seller | null> => {
    const { unifiedAuthService } = await import('./unifiedAuthService');
    return unifiedAuthService.authenticateWithAPI(pin);
  },
  getUsers: async (sellerId?: string): Promise<User[]> => {
    const { unifiedAuthService } = await import('./unifiedAuthService');
    return unifiedAuthService.getUsers(sellerId);
  },
  syncSupabaseAuth: async (pin: string) => {
    const { unifiedAuthService } = await import('./unifiedAuthService');
    return unifiedAuthService.authenticateWithPin(pin);
  },
};
