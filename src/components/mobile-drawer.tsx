'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

interface MobileDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  children: React.ReactNode
  title?: string
  description?: string
  className?: string
  showHandle?: boolean
  maxHeight?: string
  minHeight?: string
}

export function MobileDrawer({
  open,
  onOpenChange,
  children,
  title,
  description,
  className,
  showHandle = true,
  maxHeight = '90vh',
  minHeight = '50vh'
}: MobileDrawerProps) {
  const [isVisible, setIsVisible] = React.useState(false)
  const [isDragging, setIsDragging] = React.useState(false)
  const [startY, setStartY] = React.useState(0)
  const [currentY, setCurrentY] = React.useState(0)
  const [initialHeight, setInitialHeight] = React.useState(0)
  const [keyboardHeight, setKeyboardHeight] = React.useState(0)
  
  const drawerRef = React.useRef<HTMLDivElement>(null)
  const contentRef = React.useRef<HTMLDivElement>(null)
  const overlayRef = React.useRef<HTMLDivElement>(null)

  // Handle keyboard appearance
  React.useEffect(() => {
    if (!open) return

    const handleResize = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height
        const windowHeight = window.innerHeight
        const keyboardHeight = Math.max(0, windowHeight - viewportHeight)
        setKeyboardHeight(keyboardHeight)
        
        // Adjust drawer height when keyboard appears
        if (drawerRef.current && keyboardHeight > 50) {
          const maxDrawerHeight = Math.min(
            viewportHeight * 0.8, // 80% of visible viewport
            windowHeight * 0.85   // 85% of full window height
          )
          drawerRef.current.style.maxHeight = `${maxDrawerHeight}px`
        } else if (drawerRef.current) {
          drawerRef.current.style.maxHeight = ''
        }
      }
    }

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize)
      handleResize()
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize)
      }
    }
  }, [open])

  // Handle drawer animation
  React.useEffect(() => {
    if (open) {
      setIsVisible(true)
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      // Restore body scroll
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
      
      // Delay hiding to allow exit animation
      const timer = setTimeout(() => setIsVisible(false), 300)
      return () => clearTimeout(timer)
    }
  }, [open])

  // Touch handlers for drag-to-close
  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    if (!drawerRef.current) return
    
    const touch = e.touches[0]
    setStartY(touch.clientY)
    setCurrentY(touch.clientY)
    setInitialHeight(drawerRef.current.getBoundingClientRect().height)
    setIsDragging(true)
  }, [])

  const handleTouchMove = React.useCallback((e: React.TouchEvent) => {
    if (!isDragging || !drawerRef.current) return
    
    const touch = e.touches[0]
    const deltaY = touch.clientY - startY
    
    // Only allow dragging down (positive deltaY)
    if (deltaY > 0) {
      setCurrentY(touch.clientY)
      
      // Apply transform to drawer
      const newHeight = Math.max(200, initialHeight - deltaY)
      drawerRef.current.style.height = `${newHeight}px`
      drawerRef.current.style.transform = `translateY(${Math.max(0, deltaY)}px)`
      
      // Apply opacity to overlay based on drag distance
      if (overlayRef.current) {
        const opacity = Math.max(0, 1 - (deltaY / 300))
        overlayRef.current.style.opacity = opacity.toString()
      }
    }
  }, [isDragging, startY, initialHeight])

  const handleTouchEnd = React.useCallback(() => {
    if (!isDragging || !drawerRef.current) return
    
    const deltaY = currentY - startY
    const threshold = 100 // Minimum drag distance to close
    
    if (deltaY > threshold) {
      // Close drawer
      onOpenChange(false)
    } else {
      // Snap back to open position
      drawerRef.current.style.height = ''
      drawerRef.current.style.transform = ''
      if (overlayRef.current) {
        overlayRef.current.style.opacity = ''
      }
    }
    
    setIsDragging(false)
    setStartY(0)
    setCurrentY(0)
  }, [isDragging, currentY, startY, onOpenChange])

  // Close on escape key
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onOpenChange])

  // Close on backdrop click
  const handleBackdropClick = React.useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onOpenChange(false)
    }
  }, [onOpenChange])

  if (!isVisible) return null

  const dynamicMaxHeight = keyboardHeight > 50 
    ? `calc(80vh - env(safe-area-inset-bottom))` // Use 80% of visible viewport when keyboard is open
    : `calc(${maxHeight} - env(safe-area-inset-bottom))`

  return (
    <>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        className={cn(
          'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
          'transition-opacity duration-300',
          open ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50',
          'bg-background border-t border-border',
          'rounded-t-xl shadow-xl',
          'transform transition-transform duration-300 ease-out',
          'flex flex-col',
          'max-h-[90vh]',
          open ? 'translate-y-0' : 'translate-y-full',
          className
        )}
        style={{
          maxHeight: dynamicMaxHeight,
          minHeight: minHeight,
          paddingBottom: 'env(safe-area-inset-bottom)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'drawer-title' : undefined}
        aria-describedby={description ? 'drawer-description' : undefined}
      >
        {/* Drag Handle */}
        {showHandle && (
          <div className="flex justify-center py-3 px-4 touch-manipulation">
            <div className="w-12 h-1.5 bg-muted-foreground/30 rounded-full" />
          </div>
        )}

        {/* Header */}
        {(title || description) && (
          <div className="px-4 pb-2 border-b border-border">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {title && (
                  <h2 id="drawer-title" className="text-lg font-semibold text-foreground">
                    {title}
                  </h2>
                )}
                {description && (
                  <p id="drawer-description" className="text-sm text-muted-foreground mt-1">
                    {description}
                  </p>
                )}
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-2 -mr-2 -mt-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close drawer"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Content */}
        <div
          ref={contentRef}
          className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4"
          style={{
            // Ensure content is scrollable and takes available space
            minHeight: 0,
            // Add safe padding for iOS devices and adjust for keyboard
            paddingBottom: keyboardHeight > 50 ? '2rem' : 'max(1rem, env(safe-area-inset-bottom))',
            // Ensure content doesn't get cut off when keyboard is open
            maxHeight: keyboardHeight > 50 ? 'calc(100% - 2rem)' : '100%'
          }}
        >
          {children}
        </div>
      </div>
    </>
  )
}

// Additional hook for enhanced mobile drawer management
export function useMobileDrawer(defaultOpen = false) {
  const [open, setOpen] = React.useState(defaultOpen)
  
  const toggle = React.useCallback(() => setOpen(prev => !prev), [])
  const close = React.useCallback(() => setOpen(false), [])
  const openDrawer = React.useCallback(() => setOpen(true), [])
  
  return {
    open,
    setOpen,
    toggle,
    close,
    openDrawer
  }
}
