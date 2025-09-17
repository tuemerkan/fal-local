'use client'

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogOverlay, DialogPortal } from "@/components/ui/dialog"
import { Generation } from "@/lib/types"
import { Download, Trash2, X, Copy, Check, ArrowLeftRight } from "lucide-react"
import { useState, useEffect } from "react"
import { useModel } from "@/contexts/model-context"

interface ImageViewerModalProps {
  image: Generation | null
  imageIndex?: number
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete?: (imageId: string) => void
}

export function ImageViewerModal({ 
  image, 
  imageIndex = 0,
  open, 
  onOpenChange,
  onDelete 
}: ImageViewerModalProps) {
  const { hasImageUrlFields, pasteImageUrl, setHighlightedField, currentModel } = useModel()

  // Helper functions to extract data from Generation format
  const getImageUrl = (generation: Generation, index: number = 0): string => {
    // Try new structure first: result.data.images, then fall back to result.images
    return generation.result?.data?.images?.[index]?.url || 
           generation.result?.images?.[index]?.url || ''
  }
  
  const getImageDimensions = (generation: Generation, index: number = 0): { width: number, height: number } => {
    // Try to get dimensions from result first, then fall back to parameters
    const img = generation.result?.data?.images?.[index] || generation.result?.images?.[index]
    const resultWidth = img?.width
    const resultHeight = img?.height
    
    if (resultWidth && resultHeight) {
      return { width: resultWidth, height: resultHeight }
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
  
  const [isDownloading, setIsDownloading] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)

  // Helper function to get the image URL field name
  const getImageUrlFieldName = () => {
    if (!currentModel) return null
    const imageUrlField = currentModel.inputs.find(input => 
      input.name === 'image_url' || 
      input.name === 'image_urls' ||
      input.name.includes('image_url')
    )
    return imageUrlField?.name || null
  }

  if (!image) return null

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const handleDownload = async () => {
    const dimensions = getImageDimensions(image, imageIndex)
    const imageUrl = getImageUrl(image, imageIndex)
    const modelName = getModelName(image)
    
    
    try {
      setIsDownloading(true)
      
      let blob: Blob
      
      if (imageUrl.startsWith('data:')) {
        // Handle base64 data URL
        const response = await fetch(imageUrl)
        blob = await response.blob()
      } else {
        // Handle remote URL
        const response = await fetch(imageUrl)
        blob = await response.blob()
      }
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const suffix = imageIndex > 0 ? `-${imageIndex + 1}` : ''
      a.download = `generated-image-${modelName}-${image.created_at.slice(0, 10)}${suffix}.jpg`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }


  const handleDelete = async () => {
    if (!onDelete) return
    
    // Add confirmation dialog before deletion
    const confirmed = window.confirm('Are you sure you want to delete this image? This action cannot be undone.')
    if (!confirmed) return

    try {
      setIsDeleting(true)
      onDelete(image.id)
      onOpenChange(false) // Close modal after deletion
    } catch (error) {
      console.error('Failed to delete image:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCopyPrompt = async () => {
    
    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(getPrompt(image))
      setIsCopied(true)
      // Reset the check mark after 2 seconds
      setTimeout(() => {
        setIsCopied(false)
      }, 2000)
    } catch (error) {
      console.error('Failed to copy prompt:', error)
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogOverlay className="!bg-black !fixed !inset-0 !z-50" />
        <DialogContent showCloseButton={false} className="!max-w-none !w-screen !h-screen !p-0 !bg-black !border-none !m-0 !rounded-none !fixed !inset-0 !top-0 !left-0 !transform-none !translate-x-0 !translate-y-0 !gap-0 !shadow-none">
          <DialogTitle className="sr-only">
            Image view - {getModelName(image)}
          </DialogTitle>
        
        {/* Fullscreen container */}
        <div className="relative w-full h-full bg-black flex flex-col">
            {/* Top toolbar */}
            <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between p-3 md:p-4 bg-gradient-to-b from-black/60 to-transparent">
              {/* Left side - Back button */}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 md:h-8 md:w-8 p-0 text-white hover:bg-white/10"
                onClick={() => onOpenChange(false)}
              >
                <X className="size-5 md:size-4" />
              </Button>

              {/* Right side - Action buttons */}
              <div className="flex items-center gap-2">

                {hasImageUrlFields() && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (getImageUrl(image, imageIndex)) {
                        pasteImageUrl(getImageUrl(image, imageIndex))
                      }
                    }}
                    onMouseEnter={() => {
                      const fieldName = getImageUrlFieldName()
                      if (fieldName) {
                        setHighlightedField(fieldName)
                      }
                    }}
                    onMouseLeave={() => {
                      setHighlightedField(null)
                    }}
                    className="h-9 w-9 md:h-8 md:w-8 p-0 text-white hover:bg-white/10"
                    title="Paste image URL to field"
                  >
                    <ArrowLeftRight className="size-5 md:size-4" />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="h-9 w-9 md:h-8 md:w-8 p-0 text-white hover:bg-white/10"
                  title="Download"
                >
                  <Download className="size-5 md:size-4" />
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="h-9 w-9 md:h-8 md:w-8 p-0 text-white hover:bg-white/10"
                  title="Delete"
                >
                  <Trash2 className="size-5 md:size-4" />
                </Button>
              </div>
            </div>

            {/* Main image area */}
            <div className="flex-1 flex items-center justify-center relative w-full overflow-hidden" onClick={handleBackgroundClick}>
              {/* Use regular img tag for base64 data URLs, Next.js Image for remote URLs */}
              {getImageUrl(image, imageIndex).startsWith('data:') ? (
                <img
                  src={getImageUrl(image, imageIndex)}
                  alt={getPrompt(image)}
                  className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] object-contain"
                  style={{ objectPosition: 'center center' }}
                />
              ) : (
                <Image
                  src={getImageUrl(image, imageIndex)}
                  alt={getPrompt(image)}
                  width={getImageDimensions(image, imageIndex).width || 512}
                  height={getImageDimensions(image, imageIndex).height || 512}
                  className="max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] object-contain"
                  style={{ objectPosition: 'center center', width: 'auto', height: 'auto' }}
                  priority
                />
              )}
            </div>

            {/* Bottom info panel */}
            <div className="absolute bottom-0 left-0 right-0 z-20 p-3 md:p-4 bg-gradient-to-t from-black/80 to-transparent">
              <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-0 md:justify-between text-white">
                <div className="flex-1 md:mr-4">
                  <p className="font-medium text-xs md:text-sm mb-1 md:mb-2">Prompt:</p>
                  <div className="flex items-start md:items-center gap-1">
                    <p className="text-xs md:text-sm text-white/90 break-words flex-1">{getPrompt(image)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCopyPrompt}
                      disabled={isCopying}
                      className="h-6 w-6 md:h-6 md:w-6 p-0 text-white hover:bg-white/10 flex-shrink-0 mt-0.5 md:mt-0"
                      title={isCopied ? 'Copied!' : 'Copy prompt'}
                    >
                      {isCopied ? (
                        <Check className="size-3 text-green-400" />
                      ) : (
                        <Copy className="size-3" />
                      )}
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-white/80 md:text-right flex-shrink-0">
                  <p>{getImageDimensions(image, imageIndex).width} × {getImageDimensions(image, imageIndex).height}</p>
                  <p className="hidden md:block">{new Date(image.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit', 
                    year: 'numeric'
                  })} um {new Date(image.created_at).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</p>
                  <p className="md:hidden">{new Date(image.created_at).toLocaleDateString('de-DE', {
                    day: '2-digit',
                    month: '2-digit'
                  })}</p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </DialogPortal>
    </Dialog>
  )
} 