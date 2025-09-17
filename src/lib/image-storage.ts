'use client'

/**
 * Image storage service for downloading and storing images locally
 */

export interface LocalImageData {
  originalUrl: string
  localDataUrl: string
  contentType: string
  size: number
  downloadedAt: string
}

export class ImageStorage {
  private static readonly STORAGE_KEY = 'fal_local_images'
  private static readonly MAX_STORAGE_SIZE = 50 * 1024 * 1024 // 50MB limit

  /**
   * Download an image from URL and convert to base64 data URL
   */
  static async downloadImageAsDataUrl(imageUrl: string): Promise<LocalImageData | null> {
    try {
      // Fetch the image
      const response = await fetch(imageUrl, {
        mode: 'cors',
        headers: {
          'Accept': 'image/*'
        }
      })
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`)
      }
      
      // Get the blob
      const blob = await response.blob()
      const contentType = blob.type || 'image/png'
      const size = blob.size
      
      // Check if adding this image would exceed storage limit
      const currentSize = await this.getCurrentStorageSize()
      if (currentSize + size > this.MAX_STORAGE_SIZE) {
        console.warn('Storage limit exceeded, not storing image locally')
        return null
      }
      
      // Convert to base64 data URL
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result as string
          
          const localImageData: LocalImageData = {
            originalUrl: imageUrl,
            localDataUrl: dataUrl,
            contentType,
            size,
            downloadedAt: new Date().toISOString()
          }
          
          resolve(localImageData)
        }
        reader.onerror = (error) => {
          console.error('FileReader error:', error)
          reject(new Error('Failed to convert image to base64'))
        }
        reader.readAsDataURL(blob)
      })
      
    } catch (error) {
      console.error('Failed to download image:', error)
      return null
    }
  }

  /**
   * Store image data locally with quota handling
   */
  static async storeImage(imageData: LocalImageData): Promise<boolean> {
    try {
      const storedImages = this.getStoredImages()
      storedImages[imageData.originalUrl] = imageData
      
      const dataToStore = JSON.stringify(storedImages)
      
      // Try to store the data
      localStorage.setItem(this.STORAGE_KEY, dataToStore)
      return true
      
    } catch (error) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded, attempting intelligent cleanup...')
        
        // First try: Remove old images (older than 3 days)
        await this.cleanupOldImages(3 * 24 * 60 * 60 * 1000)
        
        try {
          const storedImages = this.getStoredImages()
          storedImages[imageData.originalUrl] = imageData
          localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedImages))
          console.log('Successfully stored image after old image cleanup')
          return true
        } catch (retryError) {
          // Second try: Free up space by removing largest images
          console.warn('Still quota exceeded, freeing up space by removing large images...')
          const targetFreeSpace = Math.max(imageData.size * 2, 10 * 1024 * 1024) // Free at least 2x image size or 10MB
          await this.freeUpSpace(targetFreeSpace)
          
          try {
            const storedImages = this.getStoredImages()
            storedImages[imageData.originalUrl] = imageData
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedImages))
            console.log('Successfully stored image after freeing up space')
            return true
          } catch (finalError) {
            // Last resort: Remove images older than 1 day
            console.warn('Still quota exceeded, performing aggressive cleanup...')
            await this.cleanupOldImages(24 * 60 * 60 * 1000)
            
            try {
              const storedImages = this.getStoredImages()
              storedImages[imageData.originalUrl] = imageData
              localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedImages))
              console.log('Successfully stored image after aggressive cleanup')
              return true
            } catch (lastError) {
              console.error('Failed to store image even after all cleanup attempts. Storage quota exhausted.')
              return false
            }
          }
        }
      } else {
        console.error('Failed to store image locally:', error)
        return false
      }
    }
  }

  /**
   * Get stored image by original URL
   */
  static getStoredImage(originalUrl: string): LocalImageData | null {
    try {
      const storedImages = this.getStoredImages()
      return storedImages[originalUrl] || null
    } catch (error) {
      console.error('Failed to get stored image:', error)
      return null
    }
  }

  /**
   * Get all stored images
   */
  static getStoredImages(): Record<string, LocalImageData> {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? JSON.parse(stored) : {}
    } catch (error) {
      console.error('Failed to get stored images:', error)
      return {}
    }
  }

  /**
   * Download and store image, return local data URL or original URL if download/storage fails
   */
  static async downloadAndStoreImage(imageUrl: string): Promise<string> {
    try {
      // Check if already stored
      const existingImage = this.getStoredImage(imageUrl)
      if (existingImage) {
        return existingImage.localDataUrl
      }

      // Perform proactive cleanup to prevent quota issues
      await this.performMaintenanceCleanup()

      // Download image data
      const imageData = await this.downloadImageAsDataUrl(imageUrl)
      if (imageData) {
        // Try to store the image
        const stored = await this.storeImage(imageData)
        
        if (stored) {
          // Successfully stored, return local data URL
          return imageData.localDataUrl
        } else {
          // Storage failed, but we still have the image data in memory
          // Return the data URL anyway (it just won't persist)
          console.warn(`Image downloaded but not stored persistently: ${imageUrl}`)
          return imageData.localDataUrl
        }
      } else {
        // Download failed, return original URL
        return imageUrl
      }
    } catch (error) {
      console.error('Error in downloadAndStoreImage:', error)
      return imageUrl
    }
  }

  /**
   * Get current storage size in bytes
   */
  static async getCurrentStorageSize(): Promise<number> {
    try {
      const storedImages = this.getStoredImages()
      return Object.values(storedImages).reduce((total, img) => total + img.size, 0)
    } catch (error) {
      return 0
    }
  }

  /**
   * Get actual localStorage usage for image storage (more accurate than sum of image sizes)
   */
  static getActualStorageSize(): number {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY)
      return stored ? new Blob([stored]).size : 0
    } catch (error) {
      return 0
    }
  }

  /**
   * Proactive cleanup to prevent quota issues
   */
  static async performMaintenanceCleanup(): Promise<void> {
    try {
      const actualSize = this.getActualStorageSize()
      const maxSize = this.MAX_STORAGE_SIZE
      
      // If we're using more than 80% of our limit, clean up
      if (actualSize > maxSize * 0.8) {
        console.log(`Storage usage at ${(actualSize / maxSize * 100).toFixed(1)}%, performing maintenance cleanup...`)
        
        // First remove images older than 7 days
        await this.cleanupOldImages(7 * 24 * 60 * 60 * 1000)
        
        // If still over 80%, remove images older than 3 days
        const newSize = this.getActualStorageSize()
        if (newSize > maxSize * 0.8) {
          await this.cleanupOldImages(3 * 24 * 60 * 60 * 1000)
        }
        
        // If still over 80%, free up space by removing largest images
        const finalSize = this.getActualStorageSize()
        if (finalSize > maxSize * 0.8) {
          const targetReduction = finalSize - (maxSize * 0.6) // Target 60% usage
          await this.freeUpSpace(targetReduction)
        }
        
        console.log(`Maintenance cleanup completed. Storage usage: ${(this.getActualStorageSize() / maxSize * 100).toFixed(1)}%`)
      }
    } catch (error) {
      console.error('Failed to perform maintenance cleanup:', error)
    }
  }

  /**
   * Clear all stored images
   */
  static clearAllImages(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY)
    } catch (error) {
      console.error('Failed to clear stored images:', error)
    }
  }

  /**
   * Remove old images to free up space (removes oldest first)
   */
  static async cleanupOldImages(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const storedImages = this.getStoredImages()
      const now = new Date().getTime()
      let hasChanges = false

      for (const [url, imageData] of Object.entries(storedImages)) {
        const downloadedAt = new Date(imageData.downloadedAt).getTime()
        if (now - downloadedAt > maxAge) {
          delete storedImages[url]
          hasChanges = true
        }
      }

      if (hasChanges) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedImages))
        console.log(`Cleaned up ${Object.keys(storedImages).length} old images`)
      }
    } catch (error) {
      console.error('Failed to cleanup old images:', error)
    }
  }

  /**
   * Free up space by removing largest images first
   */
  static async freeUpSpace(targetBytes: number): Promise<void> {
    try {
      const storedImages = this.getStoredImages()
      const imageEntries = Object.entries(storedImages)
      
      // Sort by size (largest first) then by age (oldest first)
      imageEntries.sort((a, b) => {
        const sizeDiff = b[1].size - a[1].size
        if (sizeDiff !== 0) return sizeDiff
        
        const aTime = new Date(a[1].downloadedAt).getTime()
        const bTime = new Date(b[1].downloadedAt).getTime()
        return aTime - bTime
      })

      let freedBytes = 0
      let hasChanges = false

      for (const [url, imageData] of imageEntries) {
        if (freedBytes >= targetBytes) break
        
        delete storedImages[url]
        freedBytes += imageData.size
        hasChanges = true
      }

      if (hasChanges) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedImages))
        console.log(`Freed up ${(freedBytes / (1024 * 1024)).toFixed(2)}MB by removing ${imageEntries.length - Object.keys(storedImages).length} images`)
      }
    } catch (error) {
      console.error('Failed to free up space:', error)
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats(): {
    imageCount: number
    totalSize: number
    totalSizeMB: number
    actualStorageSize: number
    actualStorageSizeMB: number
    storageUsagePercent: number
    oldestImage: string | null
    newestImage: string | null
  } {
    try {
      const storedImages = this.getStoredImages()
      const images = Object.values(storedImages)
      const totalSize = images.reduce((total, img) => total + img.size, 0)
      const actualStorageSize = this.getActualStorageSize()
      
      let oldest = null
      let newest = null
      
      if (images.length > 0) {
        const sorted = images.sort((a, b) => 
          new Date(a.downloadedAt).getTime() - new Date(b.downloadedAt).getTime()
        )
        oldest = sorted[0].downloadedAt
        newest = sorted[sorted.length - 1].downloadedAt
      }

      return {
        imageCount: images.length,
        totalSize,
        totalSizeMB: parseFloat((totalSize / (1024 * 1024)).toFixed(2)),
        actualStorageSize,
        actualStorageSizeMB: parseFloat((actualStorageSize / (1024 * 1024)).toFixed(2)),
        storageUsagePercent: parseFloat(((actualStorageSize / this.MAX_STORAGE_SIZE) * 100).toFixed(1)),
        oldestImage: oldest,
        newestImage: newest
      }
    } catch (error) {
      return {
        imageCount: 0,
        totalSize: 0,
        totalSizeMB: 0,
        actualStorageSize: 0,
        actualStorageSizeMB: 0,
        storageUsagePercent: 0,
        oldestImage: null,
        newestImage: null
      }
    }
  }
}
