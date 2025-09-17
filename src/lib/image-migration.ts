'use client'

import { LocalStorage } from './local-storage'
import { ImageStorage } from './image-storage'
import { Generation } from './types'

/**
 * Migration utilities for downloading and storing existing remote images locally
 */
export class ImageMigration {
  
  /**
   * Check if a URL is a remote URL (not a data URL)
   */
  private static isRemoteUrl(url: string): boolean {
    return url.startsWith('http://') || url.startsWith('https://')
  }

  /**
   * Process a single generation to download remote images locally
   */
  static async processGeneration(generation: Generation): Promise<Generation> {
    if (!generation.result?.images?.length) {
      return generation
    }

    try {
      // Process each image
      const processedImages = await Promise.all(
        generation.result.images.map(async (image) => {
          // Skip if no URL or already a data URL
          if (!image.url || !this.isRemoteUrl(image.url)) {
            return image
          }

          // Download and get local URL
          const localUrl = await ImageStorage.downloadAndStoreImage(image.url)
          
          return {
            ...image,
            url: localUrl,
            originalUrl: image.url // Keep reference to original URL
          }
        })
      )

      // Return updated generation
      const updatedGeneration = {
        ...generation,
        result: {
          ...generation.result,
          images: processedImages
        },
        updated_at: new Date().toISOString()
      }

      // Save the updated generation back to localStorage
      LocalStorage.generations.updateGeneration(generation.id, updatedGeneration)
      
      return updatedGeneration

    } catch (error) {
      console.error(`Error processing generation ${generation.id}:`, error)
      return generation
    }
  }

  /**
   * Migrate all existing generations to use local image storage
   */
  static async migrateAllGenerations(): Promise<{
    total: number
    processed: number
    errors: number
    alreadyLocal: number
  }> {
    const generations = LocalStorage.generations.getGenerations()
    const stats = {
      total: generations.length,
      processed: 0,
      errors: 0,
      alreadyLocal: 0
    }

    for (const generation of generations) {
      try {
        // Check if this generation has remote images
        const hasRemoteImages = generation.result?.images?.some(img => 
          img.url && this.isRemoteUrl(img.url)
        )

        if (!hasRemoteImages) {
          stats.alreadyLocal++
          continue
        }

        // Process the generation
        await this.processGeneration(generation)
        stats.processed++

        // Add small delay to avoid overwhelming the browser
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (error) {
        console.error(`Error migrating generation ${generation.id}:`, error)
        stats.errors++
      }
    }

    return stats
  }

  /**
   * Get migration status - how many generations still have remote images
   */
  static getMigrationStatus(): {
    totalGenerations: number
    remoteImageGenerations: number
    localImageGenerations: number
    noImageGenerations: number
  } {
    const generations = LocalStorage.generations.getGenerations()
    
    const stats = {
      totalGenerations: generations.length,
      remoteImageGenerations: 0,
      localImageGenerations: 0,
      noImageGenerations: 0
    }

    generations.forEach(generation => {
      if (!generation.result?.images?.length) {
        stats.noImageGenerations++
      } else {
        const hasRemoteImages = generation.result.images.some(img => 
          img.url && this.isRemoteUrl(img.url)
        )
        
        if (hasRemoteImages) {
          stats.remoteImageGenerations++
        } else {
          stats.localImageGenerations++
        }
      }
    })

    return stats
  }

  /**
   * Clean up old remote URLs that have been migrated
   */
  static cleanupMigratedImages(): number {
    let cleanedCount = 0
    const generations = LocalStorage.generations.getGenerations()

    generations.forEach(generation => {
      if (!generation.result?.images?.length) return

      let hasChanges = false
      const cleanedImages = generation.result.images.map(image => {
        // Remove originalUrl if it exists and the current URL is local
        if (image.originalUrl && !this.isRemoteUrl(image.url || '')) {
          hasChanges = true
          cleanedCount++
          const { originalUrl, ...cleanedImage } = image
          return cleanedImage
        }
        return image
      })

      if (hasChanges) {
        const updatedGeneration = {
          ...generation,
          result: {
            ...generation.result,
            images: cleanedImages
          },
          updated_at: new Date().toISOString()
        }
        
        LocalStorage.generations.updateGeneration(generation.id, updatedGeneration)
      }
    })

    return cleanedCount
  }
}
