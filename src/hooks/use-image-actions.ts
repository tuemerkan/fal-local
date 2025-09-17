"use client"

import { useState } from 'react'
import { LocalStorage } from '@/lib/local-storage'

interface UseImageActionsResult {
  deleteImage: (imageId: string) => Promise<void>
  loading: boolean
  error: string | null
}

export function useImageActions(): UseImageActionsResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)


  const deleteImage = async (imageId: string): Promise<void> => {
    setLoading(true)
    setError(null)

    try {
      // Delete from localStorage
      LocalStorage.generations.deleteGeneration(imageId)
      
      // Dispatch events for other components to refresh
      window.dispatchEvent(new CustomEvent('imageDeleted'))
      window.dispatchEvent(new CustomEvent('imageUpdated'))
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image'
      setError(errorMessage)
      console.error('Error deleting image:', err)
    } finally {
      setLoading(false)
    }
  }

  return {
    deleteImage,
    loading,
    error
  }
}
