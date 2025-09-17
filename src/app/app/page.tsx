'use client'

import { useGeneratedImages } from "@/hooks/use-generated-images"
import { useImageActions } from "@/hooks/use-image-actions"
import { Download, ArrowLeftRight, Eye, Trash2 } from "lucide-react"
import { ImageViewerModal } from "@/components/image-viewer-modal"
import { VideoViewerModal } from "@/components/video-viewer-modal"
import { Skeleton } from "@/components/ui/skeleton"

import { Generation } from "@/lib/types"
import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useModel } from "@/contexts/model-context"

export default function AppPage() {
  const { images, loading, error, refresh } = useGeneratedImages()
  const { deleteImage } = useImageActions()
  const { hasImageUrlFields, getImageUrlFieldName, pasteImageUrl, setHighlightedField } = useModel()
  const [selectedImage, setSelectedImage] = useState<Generation | null>(null)
  const [selectedImageIndex, setSelectedImageIndex] = useState<number>(0)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [selectedVideo, setSelectedVideo] = useState<Generation | null>(null)
  const [isVideoViewerOpen, setIsVideoViewerOpen] = useState(false)
  
  // Track downloading states
  const [downloadingImages, setDownloadingImages] = useState<Set<string>>(new Set())
  
  // Track generation state
  const [isGenerating, setIsGenerating] = useState(false)
  const [numGenerating, setNumGenerating] = useState(1)

  // Listen for generation events
  useEffect(() => {
    const handleGenerationStarted = (event: CustomEvent) => {
      setIsGenerating(true)
      setNumGenerating(event.detail?.numImages || 1)
    }

    const handleGenerationAdded = () => {
      setIsGenerating(false)
      // The useGeneratedImages hook will handle the data refresh via its own event listener
    }

    const handleGenerationEnded = () => {
      setIsGenerating(false)
    }

    window.addEventListener('generationStarted', handleGenerationStarted as EventListener)
    window.addEventListener('generationAdded', handleGenerationAdded as EventListener)
    window.addEventListener('generationEnded', handleGenerationEnded as EventListener)

    return () => {
      window.removeEventListener('generationStarted', handleGenerationStarted as EventListener)
      window.removeEventListener('generationAdded', handleGenerationAdded as EventListener)
      window.removeEventListener('generationEnded', handleGenerationEnded as EventListener)
    }
  }, [])

  // Helper functions to extract data from Generation format
  const isVideoGeneration = (generation: Generation): boolean => {
    return !!(generation.result?.data?.video || 
              generation.result?.data?.videos?.length ||
              generation.result?.video || 
              generation.result?.videos?.length)
  }

  // Interface to represent a single renderable item (can be an image or video)
  interface RenderableItem {
    id: string // unique identifier for this specific image/video
    generation: Generation // reference to the original generation
    type: 'image' | 'video'
    url: string
    width?: number
    height?: number
    imageIndex?: number // for multi-image generations, which image this represents
  }

  // Extract all renderable items from a generation
  const extractRenderableItems = (generation: Generation): RenderableItem[] => {
    const items: RenderableItem[] = []
    
    if (isVideoGeneration(generation)) {
      // Handle video
      const videoUrl = generation.result?.data?.video?.url || 
                       generation.result?.data?.videos?.[0]?.url ||
                       generation.result?.video?.url || 
                       generation.result?.videos?.[0]?.url || ''
      
      if (videoUrl) {
        const video = generation.result?.data?.video || 
                      generation.result?.data?.videos?.[0] ||
                      generation.result?.video || 
                      generation.result?.videos?.[0]
        
        items.push({
          id: `${generation.id}-video-0`,
          generation,
          type: 'video',
          url: videoUrl,
          width: video?.width,
          height: video?.height
        })
      }
    } else {
      // Handle images - extract ALL images, not just the first one
      const images = generation.result?.data?.images || generation.result?.images || []
      
      images.forEach((image, index) => {
        if (image.url) {
          items.push({
            id: `${generation.id}-image-${index}`,
            generation,
            type: 'image',
            url: image.url,
            width: image.width,
            height: image.height,
            imageIndex: index
          })
        }
      })
    }
    
    return items
  }

  const getImageUrl = (generation: Generation, imageIndex: number = 0): string => {
    // Try new structure first: result.data.images
    const images = generation.result?.data?.images || generation.result?.images || []
    return images[imageIndex]?.url || ''
  }

  const getVideoUrl = (generation: Generation): string => {
    const videoUrl = generation.result?.data?.video?.url || 
                     generation.result?.data?.videos?.[0]?.url ||
                     generation.result?.video?.url || 
                     generation.result?.videos?.[0]?.url || ''
    
    return videoUrl
  }

  const getContentUrl = (generation: Generation): string => {
    const isVideo = isVideoGeneration(generation)
    const contentUrl = isVideo ? getVideoUrl(generation) : getImageUrl(generation)
    
    return contentUrl
  }
  
  const getItemDimensions = (item: RenderableItem): { width: number, height: number } => {
    // Use dimensions from the specific item if available
    if (item.width && item.height) {
      return { width: item.width, height: item.height }
    }
    
    // Fall back to parameters (from migrated data)
    const paramWidth = item.generation.parameters?.width as number
    const paramHeight = item.generation.parameters?.height as number
    
    return { 
      width: paramWidth || 512, 
      height: paramHeight || 512 
    }
  }
  
  const getPrompt = (generation: Generation): string => {
    return (generation.parameters?.prompt as string) || ''
  }
  
  const getModelName = (generation: Generation): string => {
    return generation.model_title || generation.model_id || 'Unknown'
  }

  // Get days ago string for display
  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) return 'today'
    if (diffDays === 1) return 'yesterday'
    return `${diffDays} days ago`
  }

  const handleItemClick = (item: RenderableItem) => {
    if (item.type === 'video') {
      setSelectedVideo(item.generation)
      setIsVideoViewerOpen(true)
    } else {
      setSelectedImage(item.generation)
      setSelectedImageIndex(item.imageIndex ?? 0)
      setIsViewerOpen(true)
    }
  }

  const handleDownload = async (item: RenderableItem) => {
    const contentUrl = item.url
    const modelName = getModelName(item.generation)
    const isVideo = item.type === 'video'
    
    setDownloadingImages(prev => new Set(prev).add(item.id))
    
    try {
      const response = await fetch(contentUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extension = isVideo ? 'mp4' : 'jpg'
      const prefix = isVideo ? 'generated-video' : 'generated-image'
      const suffix = item.imageIndex !== undefined ? `-${item.imageIndex + 1}` : ''
      a.download = `${prefix}-${modelName}-${item.generation.created_at.slice(0, 10)}${suffix}.${extension}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      // Download error handling
    } finally {
      setDownloadingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(item.id)
        return newSet
      })
    }
  }

  const handleDelete = async (imageId: string) => {
    try {
      await deleteImage(imageId)
      // The useImageActions hook will automatically trigger events to refresh the image list
    } catch (error) {
      console.error('Error deleting image:', error)
    }
  }

  const renderContentGrid = (imagesList: Generation[], isLoading: boolean, errorMessage: string | null, emptyMessage: string) => {
    // Extract all renderable items from generations and sort by creation date (newest first)
    const allItems: RenderableItem[] = []
    imagesList.forEach(generation => {
      const items = extractRenderableItems(generation)
      allItems.push(...items)
    })
    
    // Sort by generation creation date (newest first)
    allItems.sort((a, b) => new Date(b.generation.created_at).getTime() - new Date(a.generation.created_at).getTime())
    
    // Show skeleton if loading existing images OR if generating new ones
    if (isLoading) {
      return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 place-items-center">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-full aspect-[3/4] rounded-lg overflow-hidden bg-muted/30 border border-muted animate-pulse relative">
              <Skeleton className="w-full h-full rounded-lg bg-muted/60" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-muted-foreground/20 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      )
    }
    
    if (errorMessage) {
      return (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-destructive">Error loading content</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
          </div>
        </div>
      )
    }

    if (allItems.length === 0 && !isGenerating) {
      return (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="text-center space-y-2">
            <p className="text-lg font-medium">No images yet</p>
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          </div>
        </div>
      )
    }

    // Show generation skeletons when generating (even if there are existing images)
    const generationSkeletons = isGenerating ? Array.from({ length: numGenerating }).map((_, i) => (
      <div key={`generating-${i}`} className="w-full aspect-square">
        <Skeleton className="w-full h-full rounded-lg" />
      </div>
    )) : []

    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 place-items-center">
        {/* Show generation skeletons first */}
        {generationSkeletons}
        {/* Then show existing content (images and videos) */}
        {allItems.map((item) => {
          const isDownloading = downloadingImages.has(item.id)
          const contentUrl = item.url

          // Skip if no content URL (corrupted generation)
          if (!contentUrl || contentUrl.trim() === '') {
            return null
          }

          const dimensions = getItemDimensions(item)
          const aspectRatio = dimensions.width && dimensions.height 
            ? dimensions.width / dimensions.height 
            : 3/4 // fallback to 3:4 aspect ratio

          return (
            <div 
              key={item.id} 
              className="w-full group relative overflow-hidden rounded-lg cursor-pointer hover:scale-[1.02] transition-transform duration-200 flex items-center justify-center"
              style={{ aspectRatio: aspectRatio }}
              onClick={() => handleItemClick(item)}
            >
              {/* Content - Image or Video */}
              {item.type === 'video' ? (
                <video
                  src={contentUrl}
                  className="w-full h-full object-cover transition-all duration-300"
                  style={{ objectPosition: 'center center' }}
                  muted
                  loop
                  playsInline
                  onMouseEnter={(e) => {
                    // Play video on hover for preview
                    e.currentTarget.play().catch(() => {
                      // Ignore play errors (autoplay policy)
                    })
                  }}
                  onMouseLeave={(e) => {
                    // Pause video when not hovering
                    e.currentTarget.pause()
                    e.currentTarget.currentTime = 0
                  }}
                />
              ) : (
                // Use regular img tag for base64 data URLs, Next.js Image for remote URLs
                contentUrl.startsWith('data:') ? (
                  <img
                    src={contentUrl}
                    alt={getPrompt(item.generation)}
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{ objectPosition: 'center center' }}
                    loading="lazy"
                  />
                ) : (
                  <Image
                    src={contentUrl}
                    alt={getPrompt(item.generation)}
                    fill
                    className="object-cover transition-all duration-300"
                    style={{ objectPosition: 'center center' }}
                    loading="lazy"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  />
                )
              )}
              
              {/* Top action buttons */}
              <div className="absolute top-1.5 md:top-2 right-1.5 md:right-2 flex gap-1">
                {/* First button - Use as input image URL (only for images) */}
                {item.type === 'image' && hasImageUrlFields() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      e.nativeEvent?.stopImmediatePropagation()
                      pasteImageUrl(contentUrl)
                    }}
                    onMouseEnter={() => {
                      const fieldName = getImageUrlFieldName()
                      if (fieldName) {
                        setHighlightedField(fieldName)
                      }
                    }}
                    onMouseLeave={() => setHighlightedField(null)}
                    className="h-7 w-7 md:h-8 md:w-8 p-0 bg-black/50 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
                    title="Use as input image"
                  >
                    <ArrowLeftRight className="size-3 md:size-4" />
                  </Button>
                )}

                {/* View full size button */}
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.nativeEvent?.stopImmediatePropagation()
                    handleItemClick(item)
                  }}
                  className="h-7 w-7 md:h-8 md:w-8 p-0 bg-black/50 hover:bg-black/60 text-white md:opacity-0 md:group-hover:opacity-100 opacity-80 transition-all duration-200"
                  title={item.type === 'video' ? "View video" : "View full size"}
                >
                  <Eye className="size-3 md:size-4" />
                </Button>

                {/* Download button */}
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.nativeEvent?.stopImmediatePropagation()
                    handleDownload(item)
                  }}
                  disabled={isDownloading}
                  className="h-7 w-7 md:h-8 md:w-8 p-0 bg-black/50 hover:bg-black/60 text-white md:opacity-0 md:group-hover:opacity-100 opacity-80 transition-all duration-200"
                  title={item.type === 'video' ? "Download video" : "Download"}
                >
                  <Download className={`size-3 md:size-4 ${isDownloading ? 'animate-pulse' : ''}`} />
                </Button>


                {/* Delete button - only shows on hover */}
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    e.nativeEvent?.stopImmediatePropagation()
                    handleDelete(item.generation.id)
                  }}
                  className="h-7 w-7 md:h-8 md:w-8 p-0 bg-red-500/70 hover:bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
                  title={item.type === 'video' ? "Delete video" : "Delete image"}
                >
                  <Trash2 className="size-3 md:size-4" />
                </Button>
              </div>
              
              {/* Video indicator overlay */}
              {item.type === 'video' && (
                <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-white text-xs font-medium">
                  VIDEO
                </div>
              )}
              
              
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              
              {/* Model name and time - bottom right */}
              <div className="absolute bottom-2 md:bottom-3 right-2 md:right-3 text-right pointer-events-none">
                <p className="text-white font-medium text-xs md:text-sm drop-shadow-lg">
                  {getModelName(item.generation).replace('Dynamic Model: ', '') || 'Generated'}
                </p>
                <p className="text-white/80 text-xs drop-shadow-lg">
                  {getDaysAgo(item.generation.created_at)}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex-1 relative px-4 md:px-6 py-6">
      <div className="space-y-6">
        {renderContentGrid(
          images, 
          loading, 
          error, 
          'Use the model picker to generate your first image'
        )}
      </div>

      {/* Image Viewer Modal */}
      <ImageViewerModal
        image={selectedImage}
        imageIndex={selectedImageIndex}
        open={isViewerOpen}
        onOpenChange={setIsViewerOpen}
        onDelete={handleDelete}
      />

      {/* Video Viewer Modal */}
      {selectedVideo && (
        <VideoViewerModal
          generation={selectedVideo}
          videoItem={{
            id: selectedVideo.id,
            type: 'video',
            url: getVideoUrl(selectedVideo),
            width: selectedVideo.result?.video?.width || selectedVideo.result?.videos?.[0]?.width,
            height: selectedVideo.result?.video?.height || selectedVideo.result?.videos?.[0]?.height,
            duration: selectedVideo.result?.video?.duration || selectedVideo.result?.videos?.[0]?.duration,
            generation: selectedVideo,
            index: 0
          }}
          open={isVideoViewerOpen}
          onOpenChange={setIsVideoViewerOpen}
          onDownload={() => handleDownload({
            id: `${selectedVideo.id}-video-0`,
            generation: selectedVideo,
            type: 'video',
            url: getVideoUrl(selectedVideo),
            width: selectedVideo.result?.video?.width || selectedVideo.result?.videos?.[0]?.width,
            height: selectedVideo.result?.video?.height || selectedVideo.result?.videos?.[0]?.height
          })}
        />
      )}
    </div>
  )
} 