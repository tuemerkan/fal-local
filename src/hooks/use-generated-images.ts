"use client"

import { useState, useEffect, useCallback } from 'react'
import { Generation } from '@/lib/types'
import { LocalStorage } from '@/lib/local-storage'

export function useGeneratedImages() {
  const [images, setImages] = useState<Generation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchImages = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get images from localStorage instead of API call
      const generations = LocalStorage.generations.getGenerations()
      setImages(generations)
    } catch (err) {
      console.error('useGeneratedImages - Fetch images error:', err)
      setError('Failed to load images from local storage')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch images on mount
  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  // Listen for generation events to refresh
  useEffect(() => {
    const handleGenerationAdded = () => {
      fetchImages()
    }

    const handleImageUpdate = () => {
      fetchImages()
    }

    window.addEventListener('generationAdded', handleGenerationAdded)
    window.addEventListener('imageUpdated', handleImageUpdate)
    window.addEventListener('imageDeleted', handleImageUpdate)
    
    return () => {
      window.removeEventListener('generationAdded', handleGenerationAdded)
      window.removeEventListener('imageUpdated', handleImageUpdate)
      window.removeEventListener('imageDeleted', handleImageUpdate)
    }
  }, [fetchImages])

  return {
    images,
    loading,
    error,
    refresh: fetchImages
  }
}