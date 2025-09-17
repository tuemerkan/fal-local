'use client'

// Local storage service - no authentication required

export type LocalStorageKeys = {
  falApiKey: 'fal_local_api_key'
  generations: 'fal_local_generations'
  userBalance: 'fal_local_balance'
}

const STORAGE_KEYS: LocalStorageKeys = {
  falApiKey: 'fal_local_api_key',
  generations: 'fal_local_generations',
  userBalance: 'fal_local_balance'
}

// Helper function to safely get from localStorage
function getFromStorage<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue
  
  try {
    const item = localStorage.getItem(key)
    return item ? JSON.parse(item) : defaultValue
  } catch (error) {
    console.error(`Error reading from localStorage key ${key}:`, error)
    return defaultValue
  }
}

// Helper function to safely set to localStorage
function setToStorage<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch (error) {
    console.error(`Error writing to localStorage key ${key}:`, error)
  }
}

// FAL API Key Management
export class LocalFalKey {
  // Store FAL API key
  static setKey(apiKey: string): void {
    const keyData = {
      key: apiKey,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    
    setToStorage(STORAGE_KEYS.falApiKey, keyData)
  }

  // Get FAL API key
  static getKey(): string | null {
    const keyData = getFromStorage<{ key: string; created_at: string; updated_at: string } | null>(
      STORAGE_KEYS.falApiKey, 
      null
    )
    
    return keyData?.key?.trim() || null
  }

  // Check if user has FAL API key
  static hasKey(): boolean {
    return this.getKey() !== null
  }

  // Get key metadata
  static getKeyMetadata(): { hasKey: boolean; keyCreatedAt: string | null; keyUpdatedAt: string | null } {
    const keyData = getFromStorage<{ key: string; created_at: string; updated_at: string } | null>(
      STORAGE_KEYS.falApiKey, 
      null
    )
    
    return {
      hasKey: !!keyData,
      keyCreatedAt: keyData?.created_at || null,
      keyUpdatedAt: keyData?.updated_at || null
    }
  }

  // Remove FAL API key
  static removeKey(): void {
    localStorage.removeItem(STORAGE_KEYS.falApiKey)
  }
}

// Generation Management
export class LocalGenerations {
  // Add a new generation
  static addGeneration(generation: import('@/lib/types').Generation): void {
    const generations = this.getGenerations()
    generations.unshift(generation) // Add to beginning for newest first
    setToStorage(STORAGE_KEYS.generations, generations)
  }

  // Get all generations
  static getGenerations(): import('@/lib/types').Generation[] {
    return getFromStorage<import('@/lib/types').Generation[]>(STORAGE_KEYS.generations, [])
  }

  // Update a generation
  static updateGeneration(id: string, updates: Partial<import('@/lib/types').Generation>): void {
    const generations = this.getGenerations()
    const index = generations.findIndex(gen => gen.id === id)
    
    if (index !== -1) {
      generations[index] = { ...generations[index], ...updates, updated_at: new Date().toISOString() }
      setToStorage(STORAGE_KEYS.generations, generations)
    }
  }

  // Delete a generation
  static deleteGeneration(id: string): void {
    const generations = this.getGenerations()
    const filtered = generations.filter(gen => gen.id !== id)
    setToStorage(STORAGE_KEYS.generations, filtered)
  }

}

// Balance Management (cache balance from FAL API)
export class LocalBalance {
  // Set balance data
  static setBalance(balance: import('@/lib/types').FalBalance | number): void {
    setToStorage(STORAGE_KEYS.userBalance, {
      balance,
      updated_at: new Date().toISOString()
    })
  }

  // Get balance data
  static getBalance(): import('@/lib/types').FalBalance | number | null {
    const balanceData = getFromStorage<{ balance: import('@/lib/types').FalBalance | number; updated_at: string } | null>(
      STORAGE_KEYS.userBalance, 
      null
    )
    return balanceData?.balance || null
  }

  // Clear balance
  static clearBalance(): void {
    localStorage.removeItem(STORAGE_KEYS.userBalance)
  }
}

// Combined local storage service
export const LocalStorage = {
  falKey: LocalFalKey,
  generations: LocalGenerations,
  balance: LocalBalance
}

export default LocalStorage