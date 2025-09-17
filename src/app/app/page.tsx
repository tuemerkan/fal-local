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

  const getImageUrl = (generation: Generation): string => {
    // Try new structure first: result.data.images
    const imageUrl = generation.result?.data?.images?.[0]?.url || 
                     generation.result?.images?.[0]?.url || ''
    
    return imageUrl
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
  
  const getImageDimensions = (generation: Generation): { width: number, height: number } => {
    // Try to get dimensions from result first, then fall back to parameters
    if (isVideoGeneration(generation)) {
      const video = generation.result?.video || generation.result?.videos?.[0]
      const resultWidth = video?.width
      const resultHeight = video?.height
      
      if (resultWidth && resultHeight) {
        return { width: resultWidth, height: resultHeight }
      }
    } else {
      const img = generation.result?.images?.[0]
      const resultWidth = img?.width
      const resultHeight = img?.height
      
      if (resultWidth && resultHeight) {
        return { width: resultWidth, height: resultHeight }
      }
    }
    
    // Fall back to parameters (from migrated data)
    const paramWidth = generation.parameters?.width as number
    const paramHeight = generation.parameters?.height as number
    
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

  const handleItemClick = (generation: Generation) => {
    if (isVideoGeneration(generation)) {
      setSelectedVideo(generation)
      setIsVideoViewerOpen(true)
    } else {
      setSelectedImage(generation)
      setIsViewerOpen(true)
    }
  }


  const handleDownload = async (generation: Generation) => {
    const contentUrl = getContentUrl(generation)
    const modelName = getModelName(generation)
    const isVideo = isVideoGeneration(generation)
    
    setDownloadingImages(prev => new Set(prev).add(generation.id))
    
    try {
      const response = await fetch(contentUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const extension = isVideo ? 'mp4' : 'jpg'
      const prefix = isVideo ? 'generated-video' : 'generated-image'
      a.download = `${prefix}-${modelName}-${generation.created_at.slice(0, 10)}.${extension}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      // Download error handling
    } finally {
      setDownloadingImages(prev => {
        const newSet = new Set(prev)
        newSet.delete(generation.id)
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
    // Combine all images and sort by creation date (newest first)
    const allImages = [...imagesList]
    allImages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    
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

    if (allImages.length === 0 && !isGenerating) {
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
        {allImages.map((generation) => {
          const isDownloading = downloadingImages.has(generation.id)
          const isVideo = isVideoGeneration(generation)
          const contentUrl = getContentUrl(generation)

          // Skip if no content URL (corrupted generation)
          if (!contentUrl || contentUrl.trim() === '') {
            return null
          }

          const dimensions = getImageDimensions(generation)
          const aspectRatio = dimensions.width && dimensions.height 
            ? dimensions.width / dimensions.height 
            : 3/4 // fallback to 3:4 aspect ratio

          return (
            <div 
              key={generation.id} 
              className="w-full group relative overflow-hidden rounded-lg cursor-pointer hover:scale-[1.02] transition-transform duration-200 flex items-center justify-center"
              style={{ aspectRatio: aspectRatio }}
              onClick={() => handleItemClick(generation)}
            >
              {/* Content - Image or Video */}
              {isVideo ? (
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
                    alt={getPrompt(generation)}
                    className="w-full h-full object-cover transition-all duration-300"
                    style={{ objectPosition: 'center center' }}
                    loading="lazy"
                  />
                ) : (
                  <Image
                    src={contentUrl}
                    alt={getPrompt(generation)}
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
                {!isVideo && hasImageUrlFields() && (
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
                    handleItemClick(generation)
                  }}
                  className="h-7 w-7 md:h-8 md:w-8 p-0 bg-black/50 hover:bg-black/60 text-white md:opacity-0 md:group-hover:opacity-100 opacity-80 transition-all duration-200"
                  title={isVideo ? "View video" : "View full size"}
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
                    handleDownload(generation)
                  }}
                  disabled={isDownloading}
                  className="h-7 w-7 md:h-8 md:w-8 p-0 bg-black/50 hover:bg-black/60 text-white md:opacity-0 md:group-hover:opacity-100 opacity-80 transition-all duration-200"
                  title={isVideo ? "Download video" : "Download"}
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
                    handleDelete(generation.id)
                  }}
                  className="h-7 w-7 md:h-8 md:w-8 p-0 bg-red-500/70 hover:bg-red-500/80 text-white opacity-0 group-hover:opacity-100 transition-all duration-200"
                  title={isVideo ? "Delete video" : "Delete image"}
                >
                  <Trash2 className="size-3 md:size-4" />
                </Button>
              </div>
              
              {/* Video indicator overlay */}
              {isVideo && (
                <div className="absolute top-2 left-2 bg-black/50 rounded px-2 py-1 text-white text-xs font-medium">
                  VIDEO
                </div>
              )}
              
              {/* Gradient overlay for text readability */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
              
              {/* Model name and time - bottom right */}
              <div className="absolute bottom-2 md:bottom-3 right-2 md:right-3 text-right pointer-events-none">
                <p className="text-white font-medium text-xs md:text-sm drop-shadow-lg">
                  {getModelName(generation).replace('Dynamic Model: ', '') || 'Generated'}
                </p>
                <p className="text-white/80 text-xs drop-shadow-lg">
                  {getDaysAgo(generation.created_at)}
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
          onDownload={() => handleDownload(selectedVideo)}
        />
      )}
    </div>
  )
} 