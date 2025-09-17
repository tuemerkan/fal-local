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
   * Store image data locally
   */
  static async storeImage(imageData: LocalImageData): Promise<void> {
    try {
      const storedImages = this.getStoredImages()
      storedImages[imageData.originalUrl] = imageData
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(storedImages))
    } catch (error) {
      console.error('Failed to store image locally:', error)
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
   * Download and store image, return local data URL or original URL if download fails
   */
  static async downloadAndStoreImage(imageUrl: string): Promise<string> {
    try {
      // Check if already stored
      const existingImage = this.getStoredImage(imageUrl)
      if (existingImage) {
        return existingImage.localDataUrl
      }

      // Download and store
      const imageData = await this.downloadImageAsDataUrl(imageUrl)
      if (imageData) {
        await this.storeImage(imageData)
        return imageData.localDataUrl
      } else {
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
      }
    } catch (error) {
      console.error('Failed to cleanup old images:', error)
    }
  }

  /**
   * Get storage statistics
   */
  static getStorageStats(): {
    imageCount: number
    totalSize: number
    totalSizeMB: number
    oldestImage: string | null
    newestImage: string | null
  } {
    try {
      const storedImages = this.getStoredImages()
      const images = Object.values(storedImages)
      const totalSize = images.reduce((total, img) => total + img.size, 0)
      
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
        oldestImage: oldest,
        newestImage: newest
      }
    } catch (error) {
      return {
        imageCount: 0,
        totalSize: 0,
        totalSizeMB: 0,
        oldestImage: null,
        newestImage: null
      }
    }
  }
}
