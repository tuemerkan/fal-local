'use client'

import { Button } from "@/components/ui/button"
import { Generation } from "@/lib/types"
import { Download, X, Copy, Check, Play, Pause, Volume2, VolumeX, Maximize, Minimize, ArrowLeftRight } from "lucide-react"
import { useState, useEffect, useRef } from "react"
import { useModel } from "@/contexts/model-context"

interface VideoViewerModalProps {
  generation: Generation | null
  videoItem: {
    id: string
    type: 'video'
    url: string
    width?: number
    height?: number
    duration?: number
    generation: Generation
    index: number
  } | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownload?: (item: { id: string, type: 'video', url: string, generation: Generation, index: number }) => void
}

export function VideoViewerModal({ 
  generation,
  videoItem, 
  open, 
  onOpenChange, 
  onDownload
}: VideoViewerModalProps) {
  const { hasImageUrlFields, pasteImageUrl, setHighlightedField, currentModel } = useModel()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)

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

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!open) {
      setIsPlaying(false)
      setCurrentTime(0)
    }
  }, [open])

  // Handle ESC key to close modal and fullscreen changes
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false)
      }
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    if (open) {
      document.addEventListener('keydown', handleEscape)
      document.addEventListener('fullscreenchange', handleFullscreenChange)
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.body.style.overflow = 'unset'
    }
  }, [open, onOpenChange])

  // Video event handlers
  const handlePlayPause = () => {
    if (!videoRef.current) return
    
    if (isPlaying) {
      videoRef.current.pause()
    } else {
      videoRef.current.play()
    }
  }

  const handleMuteToggle = () => {
    if (!videoRef.current) return
    videoRef.current.muted = !videoRef.current.muted
    setIsMuted(videoRef.current.muted)
  }

  const handleFullscreenToggle = () => {
    if (!videoRef.current) return
    
    if (!isFullscreen) {
      videoRef.current.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  const handleTimeUpdate = () => {
    if (!videoRef.current) return
    setCurrentTime(videoRef.current.currentTime)
  }

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return
    setDuration(videoRef.current.duration)
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current) return
    
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const width = rect.width
    const newTime = (clickX / width) * duration
    
    videoRef.current.currentTime = newTime
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!generation || !videoItem) return null

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }

  const handleDownload = async () => {
    if (!onDownload) return

    
    try {
      setIsDownloading(true)
      onDownload(videoItem)
    } catch (error) {
      console.error('Download failed:', error)
    } finally {
      setIsDownloading(false)
    }
  }

  const handleCopyPrompt = async () => {
    const prompt = (generation.parameters.prompt as string) || ''
    
    
    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(prompt)
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

  if (!open) return null

  const prompt = (generation.parameters.prompt as string) || 'Generated video'

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Accessibility */}
      <div className="sr-only">Video view - {generation.model_title}</div>
      
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
                  if (videoItem?.url) {
                    pasteImageUrl(videoItem.url)
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
          </div>
        </div>

        {/* Main video area */}
        <div className="flex-1 flex items-center justify-center p-4 relative" onClick={handleBackgroundClick}>
          <video
            ref={videoRef}
            src={videoItem.url}
            className="max-w-full max-h-full object-contain"
            controls={false}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            autoPlay
            loop
          />
          
          {/* Custom video controls overlay */}
          <div className="absolute bottom-20 left-4 right-4 bg-black/50 rounded-lg p-3 backdrop-blur-sm">
            {/* Progress bar */}
            <div className="mb-3">
              <div 
                className="w-full h-2 bg-white/20 rounded-full cursor-pointer"
                onClick={handleSeek}
              >
                <div 
                  className="h-full bg-white rounded-full transition-all duration-150"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>
            </div>
            
            {/* Control buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePlayPause}
                  className="h-8 w-8 p-0 text-white hover:bg-white/10"
                >
                  {isPlaying ? <Pause className="size-4" /> : <Play className="size-4" />}
                </Button>
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMuteToggle}
                  className="h-8 w-8 p-0 text-white hover:bg-white/10"
                >
                  {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
                </Button>
                
                <span className="text-white text-sm">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </span>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={handleFullscreenToggle}
                className="h-8 w-8 p-0 text-white hover:bg-white/10"
              >
                {isFullscreen ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom info panel */}
        <div className="absolute bottom-0 left-0 right-0 z-20 p-3 md:p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex flex-col md:flex-row md:items-end gap-3 md:gap-0 md:justify-between text-white">
            <div className="flex-1 md:mr-4">
              <p className="font-medium text-xs md:text-sm mb-1 md:mb-2">Prompt:</p>
              <div className="flex items-start md:items-center gap-1">
                <p className="text-xs md:text-sm text-white/90 break-words flex-1">{prompt}</p>
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
              <p>{generation.model_title?.replace('fal-ai/', '') || 'Video Model'}</p>
              {videoItem.width && videoItem.height && (
                <p>{videoItem.width} × {videoItem.height}</p>
              )}
              <p className="hidden md:block">{new Date(generation.created_at).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit', 
                year: 'numeric'
              })} um {new Date(generation.created_at).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit'
              })}</p>
              <p className="md:hidden">{new Date(generation.created_at).toLocaleDateString('de-DE', {
                day: '2-digit',
                month: '2-digit'
              })}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
