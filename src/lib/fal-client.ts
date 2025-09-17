import { fal } from '@fal-ai/client'
import { LocalStorage } from '@/lib/local-storage'

/**
 * Create a configured FAL client using localStorage API key
 * No authentication required - just needs FAL API key to be configured
 */
export async function createUserFalClient(): Promise<typeof fal> {
  try {
    // Try to get FAL API key from localStorage
    const userFalKey = LocalStorage.falKey.getKey()

    if (userFalKey) {
      // Configure FAL with the stored key
      const userFalClient = { ...fal }
      userFalClient.config({
        credentials: userFalKey,
      })
      
      return userFalClient
    } else {
      // No API key found
      throw new Error('FAL API key required. Please configure your API key in settings.')
    }

  } catch (error) {
    console.error('Failed to create FAL client:', error)
    throw error
  }
}

/**
 * Check if FAL API key is configured
 */
export async function userHasOwnFalKey(): Promise<boolean> {
  return LocalStorage.falKey.hasKey()
}

/**
 * Get FAL key status and metadata
 */
export async function getUserFalKeyStatus(): Promise<{
  hasKey: boolean
  keyCreatedAt?: string
  keyUpdatedAt?: string
} | null> {
  try {
    const metadata = LocalStorage.falKey.getKeyMetadata()
    
    return {
      hasKey: metadata.hasKey,
      keyCreatedAt: metadata.keyCreatedAt || undefined,
      keyUpdatedAt: metadata.keyUpdatedAt || undefined
    }
  } catch (error) {
    console.error('Error getting FAL key status:', error)
    return null
  }
}