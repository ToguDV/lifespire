import { createAuthStore } from '@lifespire/app-core/sync/authStore'

export * from '@lifespire/app-core/sync/authStore'

/** Web singleton; the API client configures it once the app boots. */
export const useAuthStore = createAuthStore()
