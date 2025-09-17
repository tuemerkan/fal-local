'use client'

import React, { useState } from "react"

import { SidebarProvider, SidebarInset, Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ModelPicker } from "@/components/model-picker"
import { FalKeyManagerSimple } from "@/components/fal-key-manager-simple"
import { ThemeProvider } from "@/hooks/use-theme"
import { SimpleThemeToggle } from "@/components/theme-toggle"
import { useIsMobile } from "@/hooks/use-mobile"
import { useBalance } from "@/hooks/use-balance"
import { LocalStorage } from "@/lib/local-storage"
import { ImageStorage } from "@/lib/image-storage"
import { Generation } from "@/lib/types"

import { Key } from "lucide-react"
import { MobileDrawer } from "@/components/mobile-drawer"
import { ModelProvider, useModel } from "@/contexts/model-context"

interface Model {
  id: string
  title: string
  description: string
  task: string
  category: string
}
import Image from "next/image"

function AppLayoutContent({ 
  children
}: { 
  children: React.ReactNode
}) {
  return (
    <ModelProvider>
      <AppLayoutInner>
        {children}
      </AppLayoutInner>
    </ModelProvider>
  )
}

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ThemeProvider defaultTheme="system" storageKey="fal-local-theme">
      <AppLayoutContent>
        {children}
      </AppLayoutContent>
    </ThemeProvider>
  )
}

function AppLayoutInner({ 
  children
}: { 
  children: React.ReactNode
}) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [showFalKeyManager, setShowFalKeyManager] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const isMobile = useIsMobile()
  const { balance, loading: balanceLoading } = useBalance()
  const { setCurrentModel } = useModel()

  if (balanceLoading) {
    return null
  }

  const handleApiKeyClick = () => {
    setShowFalKeyManager(true)
  }

  const formatBalance = (balance: { balance: number, currency: string } | number | null) => {
    if (balance === null || balance === undefined) return 'N/A'
    
    // Handle case where balance might be just a number (direct API response)
    const balanceValue = typeof balance === 'number' ? balance : balance.balance
    const currency = typeof balance === 'object' && balance.currency ? balance.currency : 'USD'
    
    if (typeof balanceValue !== 'number' || isNaN(balanceValue)) return 'N/A'
    
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    })
    return formatter.format(balanceValue)
  }

  const handleGenerate = async (model: Model, parameters: Record<string, unknown>) => {
    if (!model || !parameters) {
      return
    }

    // Close mobile drawer immediately when generate is clicked
    if (isMobile) {
      setMobileDrawerOpen(false)
    }

    // Extract number of images from parameters or default to 1
    const numImages = (parameters.num_images as number) || (parameters.num_image as number) || 1
    
    try {
      setIsGenerating(true)
      
      // Get FAL API key from localStorage
      const falApiKey = LocalStorage.falKey.getKey()
      
      
      if (!falApiKey) {
        throw new Error('FAL API key required. Please configure your API key in settings.')
      }
      
      // Dispatch generation start event
      window.dispatchEvent(new CustomEvent('generationStarted', { 
        detail: { 
          numImages: numImages
        }
      }))

      const response = await fetch('/api/generate-dynamic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-fal-api-key': falApiKey,
        },
        body: JSON.stringify({
          modelId: model.id,
          parameters: parameters
        }),
      })

      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to generate content')
      }


      // Process and save the results locally
      if (result.success && result.data) {
        // Download and store images locally first
        
        const processedGenerations = await Promise.all(
          result.data.map(async (generation: Generation) => {
            // Skip if no images to process (check both possible structures)
            const images = generation.result?.data?.images || generation.result?.images
            if (!images?.length) {
              return generation
            }

            try {
              // Process each image in the generation
              
              const processedImages = await Promise.all(
                images.map(async (image: any, index: number) => {
                  if (!image.url) {
                    return image
                  }

                  
                  // Download and get local URL
                  const localUrl = await ImageStorage.downloadAndStoreImage(image.url)
                  
                  
                  const processedImage = {
                    ...image,
                    url: localUrl, // Replace remote URL with local data URL
                    originalUrl: image.url // Keep reference to original URL
                  }
                  
                  return processedImage
                })
              )
              

              // Return generation with locally stored images (maintain the correct structure)
              const updatedGeneration = { ...generation }
              
              if (generation.result?.data?.images) {
                // Use the new structure: result.data.images
                updatedGeneration.result = {
                  ...generation.result,
                  data: {
                    ...generation.result.data,
                    images: processedImages
                  }
                }
              } else {
                // Use the old structure: result.images
                updatedGeneration.result = {
                  ...generation.result,
                  images: processedImages
                }
              }
              
              return updatedGeneration
            } catch (error) {
              return generation // Return original if processing fails
            }
          })
        )


        // Save processed generations (with local image URLs) to localStorage
        processedGenerations.forEach((generation: Generation) => {
          LocalStorage.generations.addGeneration(generation)
        })

        
        // Verify what was actually saved
        const savedGenerations = LocalStorage.generations.getGenerations()

        // Dispatch all events for UI components to refresh
        window.dispatchEvent(new CustomEvent('generationAdded'))
        window.dispatchEvent(new CustomEvent('imageGenerated', { 
          detail: { 
            generations: processedGenerations
          }
        }))
        
        // Also dispatch the new event name for forward compatibility
        window.dispatchEvent(new CustomEvent('generationCompleted', { 
          detail: { 
            generations: processedGenerations
          }
        }))
      } else {
      }
      
    } catch (error) {
      // Log error for debugging
      console.error('Generation failed:', error)
    } finally {
      setIsGenerating(false)
      
      // Dispatch generation end event
      window.dispatchEvent(new CustomEvent('generationEnded'))
    }
  }

  return (
    <TooltipProvider>
      <SidebarProvider>
        {/* Model Picker Sidebar - Hidden on mobile, visible on desktop */}
        <Sidebar className="w-[26rem] flex-col h-screen">
          <SidebarHeader className="p-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              <Image 
                src="/logo.svg" 
                alt="Logo" 
                width={32} 
                height={32}
                className={`w-8 h-8 logo-purple ${isGenerating ? 'logo-spinning' : ''}`}
              />
              <h1 className="text-xl font-bold">fal-local</h1>
            </div>
          </SidebarHeader>
          <SidebarContent className="p-4 flex-1 flex flex-col min-h-0">
            <ModelPicker 
              onModelSelect={setCurrentModel}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              isAuthenticated={true}
            />
          </SidebarContent>
        </Sidebar>
        
        {/* Main Content Area */}
        <SidebarInset className="flex flex-col h-screen !m-0 !p-0">
          {/* Top Bar */}
          <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background">
            {/* Logo - Only visible on mobile when sidebar is hidden */}
            {isMobile && (
              <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
                <Image
                  src="/logo.svg"
                  alt="fal-local logo"
                  width={24}
                  height={24}
                  className={`w-6 h-6 logo-purple ${isGenerating ? 'logo-spinning' : ''}`}
                />
                <span className="font-semibold text-lg text-foreground">fal-local</span>
              </div>
            )}
            
            {/* Spacer for desktop to push avatar to right */}
            {!isMobile && <div className="flex-1" />}
            <div className="flex items-center gap-3">
              {/* Balance Display */}
              <div className="text-sm text-muted-foreground">
                {balanceLoading ? (
                  <Skeleton className="h-5 w-12" />
                ) : (
                  formatBalance(balance)
                )}
              </div>
              
              {/* API Key Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleApiKeyClick}
                className="flex items-center gap-2"
              >
                <Key className="h-4 w-4" />
                API Key
              </Button>
              
              {/* Theme Toggle */}
              <SimpleThemeToggle />
            </div>
          </div>
          
          {/* Main Content */}
          <div className={`flex-1 overflow-y-auto ${isMobile ? 'pb-16' : ''}`}>
            <div className="flex flex-1 flex-col">
              {children}
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
      
      {/* Mobile Generate Drawer */}
      {isMobile && (
        <>
          {/* Bottom Generate Tab - Always visible on mobile */}
          <div 
            onClick={() => setMobileDrawerOpen(true)}
            className="fixed bottom-0 left-0 right-0 z-40 bg-primary text-primary-foreground px-6 py-3 text-center font-semibold cursor-pointer shadow-lg rounded-t-lg active:scale-95 transition-transform touch-manipulation"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            Generate
          </div>
          
          {/* Mobile Drawer */}
          <MobileDrawer
            open={mobileDrawerOpen}
            onOpenChange={setMobileDrawerOpen}
            title="Model Picker"
            description="Select a model and generate images"
            maxHeight="85vh"
            minHeight="50vh"
          >
            <ModelPicker 
              onModelSelect={setCurrentModel}
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              isAuthenticated={true}
            />
          </MobileDrawer>
        </>
      )}
      
      {/* FAL Key Manager */}
      <FalKeyManagerSimple 
        isOpen={showFalKeyManager} 
        onOpenChange={(open: boolean) => {
          setShowFalKeyManager(open)
        }} 
      />

    </TooltipProvider>
  )
} 