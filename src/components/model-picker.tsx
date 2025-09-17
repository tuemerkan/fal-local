'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import Image from 'next/image'

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

import { Play, Search, AlertTriangle } from "lucide-react"
import falModels from '@/data/fal-models-combined.json'
import { useModel } from '@/contexts/model-context'

interface ModelInput {
  name: string
  type: string
  description: string
  required: boolean
  default?: unknown
  minimum?: number
  maximum?: number
  enum?: string[]
  anyOf?: Array<{
    enum?: string[]
    type?: string
    $ref?: string
  }>
  examples?: string[]
}

interface Model {
  id: string
  title: string
  description: string
  task: string
  category: string
  inputs: ModelInput[]
}

interface ModelPickerProps {
  onModelSelect?: (model: Model) => void
  onGenerate?: (model: Model, parameters: Record<string, unknown>) => void
  isGenerating?: boolean
  isAuthenticated?: boolean // Whether user is authenticated and can generate
}

// localStorage utilities for saving/loading last used model
const LAST_MODEL_KEY = 'fal-ui-last-model'

// Helper function to extract enum values from various structures
const getEnumValues = (input: ModelInput): string[] | null => {
  // Direct enum property
  if (input.enum && input.enum.length > 0) {
    return input.enum
  }
  
  // Check anyOf structure for enum values
  if (input.anyOf && input.anyOf.length > 0) {
    for (const option of input.anyOf) {
      if (option.enum && option.enum.length > 0) {
        return option.enum
      }
    }
  }
  
  // Special case for image_size field which commonly has predefined options
  if (input.name === 'image_size') {
    // Common image size options found in FAL models
    return [
      "square_hd",
      "square", 
      "portrait_4_3",
      "portrait_16_9",
      "landscape_4_3", 
      "landscape_16_9"
    ]
  }
  
  // Special case for aspect_ratio field which commonly has predefined options
  if (input.name === 'aspect_ratio') {
    return [
      "1:1",
      "4:3", 
      "3:4",
      "16:9",
      "9:16"
    ]
  }
  
  return null
}

const saveLastUsedModel = (model: Model) => {
  try {
    localStorage.setItem(LAST_MODEL_KEY, JSON.stringify({
      id: model.id,
      title: model.title,
      description: model.description,
      task: model.task,
      category: model.category,
      inputs: model.inputs
    }))
  } catch (error) {
    // Failed to save last used model to localStorage
  }
}

const getLastUsedModel = (): Model | null => {
  try {
    const saved = localStorage.getItem(LAST_MODEL_KEY)
    if (saved) {
      return JSON.parse(saved) as Model
    }
  } catch (error) {
    // Failed to load last used model from localStorage
  }
  return null
}

export const getCategoryBadgeInfo = (task: string, category: string) => {
  const text = getTaskBadgeText(task)
  
  switch (category) {
    case 'text-to-image':
      return { text, variant: 'text-to-image' as const }
    case 'image-to-image':
      return { text, variant: 'image-to-image' as const }
    case 'text-to-video':
      return { text, variant: 'text-to-video' as const }
    case 'image-to-video':
      return { text, variant: 'image-to-video' as const }
    case 'video-to-video':
      return { text, variant: 'video-to-video' as const }
    case 'training':
      return { text, variant: 'training' as const }
    default:
      return { text, variant: 'secondary' as const }
  }
}

const getTaskBadgeText = (task: string) => {
  switch (task) {
    case 'text-to-image':
      return 'T2I'
    case 'image-to-image':
      return 'I2I'
    case 'text-to-video':
      return 'T2V'
    case 'image-to-video':
      return 'I2V'
    case 'video-to-video':
      return 'V2V'
    default:
      return task.slice(0, 3).toUpperCase()
  }
}

export function ModelPicker({ onModelSelect, onGenerate, isGenerating = false, isAuthenticated = false }: ModelPickerProps) {
  const [selectedModel, setSelectedModel] = useState<Model | null>(null)
  const [parameters, setParameters] = useState<Record<string, unknown>>({})
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set())
  const { highlightedField } = useModel()

  // Detect mobile environment
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768 || 'ontouchstart' in window)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])


  const allModels = (falModels as { models: Model[] }).models

  // Filter out training and private models, then apply search
  const filteredModels = useMemo(() => {
    const publicModels = allModels.filter(model => 
      model.category !== 'training' && model.category !== 'private'
    )
    
    if (!searchQuery.trim()) {
      return publicModels
    }
    
    const query = searchQuery.toLowerCase()
    return publicModels.filter(model =>
      model.title.toLowerCase().includes(query) ||
      model.description.toLowerCase().includes(query) ||
      model.task.toLowerCase().includes(query) ||
      model.category.toLowerCase().includes(query)
    )
  }, [allModels, searchQuery])

  const handleModelSelect = useCallback((model: Model) => {
    setSelectedModel(model)
    
    
    // Save the selected model as the last used model
    saveLastUsedModel(model)
    
    // Initialize parameters with default values
    const initialParams: Record<string, unknown> = {}
    model.inputs.forEach(input => {
      if (input.default !== undefined) {
        initialParams[input.name] = input.default
      }
    })
    setParameters(initialParams)
    
    onModelSelect?.(model)
  }, [onModelSelect])

  const handleParameterChange = (name: string, value: unknown) => {
    setParameters(prev => ({
      ...prev,
      [name]: value
    }))
  }

  // Clear broken images when model changes
  useEffect(() => {
    setBrokenImages(new Set())
  }, [selectedModel?.id])

  const handleGenerate = () => {
    if (selectedModel) {
      
      onGenerate?.(selectedModel, parameters)
    }
  }



  const cleanModelName = (name: string) => {
    if (name.startsWith('fal-ai/')) {
      return name.substring(7) // Remove 'fal-ai/' prefix
    }
    return name
  }

  const renderParameterInput = (input: ModelInput) => {
    const value = parameters[input.name] ?? input.default
    const isHighlighted = highlightedField === input.name
    const isImageUrlField = input.name === 'image_url' || input.name === 'image_urls' || input.name.includes('image_url')

    // Special handling for image URL fields
    if (isImageUrlField) {
      const imageValue = value as string | string[] | undefined
      return (
        <div className={`space-y-2 transition-all duration-200 ${isHighlighted ? "mx-1 my-1 px-1 py-2 rounded-md bg-primary/10 ring-2 ring-primary/30 border border-primary/20" : ""}`}>
          <Label htmlFor={input.name} className={`text-sm ${isHighlighted ? "text-primary font-medium" : ""}`}>
            {input.name}
            {input.required && <span className="text-red-500 ml-1">*</span>}
          </Label>
          
          {/* Display thumbnails if URLs are present */}
          {imageValue && Array.isArray(imageValue) && (
            <div className="mb-2">
              <div className="flex flex-wrap gap-2">
                  {imageValue.map((url, index) => {
                    const isBroken = brokenImages.has(url)
                    return (
                      <div key={index} className="relative group">
                        {isBroken ? (
                          <div className="w-16 h-16 bg-gray-100 border rounded flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                            <AlertTriangle className="w-6 h-6 text-gray-400" />
                          </div>
                        ) : (
                          <div 
                            className="w-16 h-16 rounded border cursor-pointer hover:scale-105 transition-transform relative overflow-hidden"
                            onClick={() => {
                              // Remove this URL from the array
                              const newValue = imageValue.filter((_, i) => i !== index)
                              handleParameterChange(input.name, newValue.length > 0 ? newValue : undefined)
                            }}
                          >
                            <Image 
                              src={url} 
                              alt={`Image ${index + 1}`}
                              fill
                              className="object-cover"
                              onError={() => {
                                setBrokenImages(prev => new Set(prev).add(url))
                              }}
                            />
                          </div>
                        )}
                        <button
                          onClick={() => {
                            const newValue = imageValue.filter((_, i) => i !== index)
                            handleParameterChange(input.name, newValue.length > 0 ? newValue : undefined)
                            // Remove from broken images set when removing
                            setBrokenImages(prev => {
                              const newSet = new Set(prev)
                              newSet.delete(url)
                              return newSet
                            })
                          }}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Remove image"
                          style={{ fontSize: '10px', lineHeight: '1' }}
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
          
          {imageValue && typeof imageValue === 'string' && imageValue.trim() && (
            <div className="mb-2">
              <div className="relative group inline-block">
                {brokenImages.has(imageValue) ? (
                  <div className="w-16 h-16 bg-gray-100 border rounded flex items-center justify-center cursor-pointer hover:scale-105 transition-transform">
                    <AlertTriangle className="w-6 h-6 text-gray-400" />
                  </div>
                ) : (
                  <div 
                    className="w-16 h-16 rounded border cursor-pointer hover:scale-105 transition-transform relative overflow-hidden"
                    onClick={() => {
                      // Clear the URL
                      handleParameterChange(input.name, undefined)
                    }}
                  >
                    <Image 
                      src={imageValue} 
                      alt="Image preview"
                      fill
                      className="object-cover"
                      onError={() => {
                        setBrokenImages(prev => new Set(prev).add(imageValue))
                      }}
                    />
                  </div>
                )}
                <button
                  onClick={() => {
                    handleParameterChange(input.name, undefined)
                    // Remove from broken images set when removing
                    setBrokenImages(prev => {
                      const newSet = new Set(prev)
                      newSet.delete(imageValue)
                      return newSet
                    })
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                  style={{ fontSize: '10px', lineHeight: '1' }}
                >
                  ×
                </button>
              </div>
            </div>
          )}
          
          <Input
            id={input.name}
            type="text"
            value={Array.isArray(imageValue) ? imageValue.join(', ') : String(imageValue || '')}
            onChange={(e) => {
              const inputValue = e.target.value
              if (input.name.includes('image_urls') || input.name === 'image_urls') {
                // Handle array field
                const urls = inputValue.split(',').map(url => url.trim()).filter(url => url)
                handleParameterChange(input.name, urls.length > 0 ? urls : undefined)
              } else {
                // Handle single field
                handleParameterChange(input.name, inputValue || undefined)
              }
            }}
            placeholder={input.examples?.[0] || input.description || 'Enter image URL(s)'}
            className=""
          />
        </div>
      )
    }

    switch (input.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <Switch
              id={input.name}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleParameterChange(input.name, checked)}
            />
            <Label htmlFor={input.name} className="text-sm">
              {input.name}
              {input.required && <span className="text-red-500 ml-1">*</span>}
            </Label>
          </div>
        )

      case 'string':
        const stringEnumValues = getEnumValues(input)
        if (stringEnumValues) {
          return (
            <div className="space-y-2">
              <Label htmlFor={input.name} className="text-sm">
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Select
                value={String(value || '')}
                onValueChange={(newValue) => handleParameterChange(input.name, newValue)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${input.name}`} />
                </SelectTrigger>
                <SelectContent>
                  {stringEnumValues.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        } else if (input.description?.toLowerCase().includes('prompt') || input.name.toLowerCase().includes('prompt') || input.name.toLowerCase().includes('video_prompt')) {
          return (
            <div className={`space-y-2 ${isHighlighted ? 'bg-primary/10 border border-primary/40 rounded-md p-3 transition-all duration-200' : ''}`}>
              <Label htmlFor={input.name} className={`text-sm ${isHighlighted ? 'text-primary font-medium' : ''}`}>
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Textarea
                id={input.name}
                value={String(value || '')}
                onChange={(e) => handleParameterChange(input.name, e.target.value)}
                rows={3}
                className=""
              />
            </div>
          )
        } else {
          return (
            <div className={`space-y-2 ${isHighlighted ? 'bg-primary/10 border border-primary/40 rounded-md p-3 transition-all duration-200' : ''}`}>
              <Label htmlFor={input.name} className={`text-sm ${isHighlighted ? 'text-primary font-medium' : ''}`}>
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={input.name}
                type="text"
                value={String(value || '')}
                onChange={(e) => handleParameterChange(input.name, e.target.value)}
                placeholder={input.examples?.[0] || input.description}
                className=""
              />
            </div>
          )
        }

      case 'integer':
      case 'number':
        const numberEnumValues = getEnumValues(input)
        if (numberEnumValues) {
          return (
            <div className="space-y-2">
              <Label htmlFor={input.name} className="text-sm">
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Select
                value={String(value || '')}
                onValueChange={(newValue) => {
                  const val = input.type === 'integer' 
                    ? parseInt(newValue) || 0
                    : parseFloat(newValue) || 0
                  handleParameterChange(input.name, val)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${input.name}`} />
                </SelectTrigger>
                <SelectContent>
                  {numberEnumValues.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        } else {
          return (
            <div className="space-y-2">
              <Label htmlFor={input.name} className="text-sm">
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
                {input.minimum !== undefined && input.maximum !== undefined && (
                  <span className="text-xs text-muted-foreground ml-1">
                    ({input.minimum}-{input.maximum})
                  </span>
                )}
              </Label>
              <Input
                id={input.name}
                type="number"
                value={String(value || '')}
                onChange={(e) => {
                  const val = input.type === 'integer' 
                    ? parseInt(e.target.value) || 0
                    : parseFloat(e.target.value) || 0
                  handleParameterChange(input.name, val)
                }}
                min={input.minimum}
                max={input.maximum}
                step={input.type === 'integer' ? 1 : 0.1}
              />
            </div>
          )
        }

      default:
        const defaultEnumValues = getEnumValues(input)
        if (defaultEnumValues) {
          return (
            <div className="space-y-2">
              <Label htmlFor={input.name} className="text-sm">
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Select
                value={String(value || '')}
                onValueChange={(newValue) => handleParameterChange(input.name, newValue)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${input.name}`} />
                </SelectTrigger>
                <SelectContent>
                  {defaultEnumValues.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        } else {
          return (
            <div className={`space-y-2 ${isHighlighted ? 'bg-primary/10 border border-primary/40 rounded-md p-3 transition-all duration-200' : ''}`}>
              <Label htmlFor={input.name} className={`text-sm ${isHighlighted ? 'text-primary font-medium' : ''}`}>
                {input.name}
                {input.required && <span className="text-red-500 ml-1">*</span>}
              </Label>
              <Input
                id={input.name}
                type="text"
                value={String(value || '')}
                onChange={(e) => handleParameterChange(input.name, e.target.value)}
                placeholder={input.description}
                className=""
              />
            </div>
          )
        }
    }
  }

  // Load last used model on component mount
  useEffect(() => {
    const lastUsedModel = getLastUsedModel()
    if (lastUsedModel) {
      // Verify the model still exists in the current models list
      const modelExists = allModels.find(model => model.id === lastUsedModel.id)
      if (modelExists) {
        handleModelSelect(modelExists)
      }
    }
  }, [allModels, handleModelSelect])

  // Listen for pasteImageUrl events
  useEffect(() => {
    const handlePasteImageUrl = (event: CustomEvent) => {
      const { fieldName, imageUrl } = event.detail
      
      if (fieldName.includes('image_urls') || fieldName === 'image_urls') {
        // Handle array field - add to existing array or create new array
        setParameters(prev => {
          const existingValue = prev[fieldName]
          if (Array.isArray(existingValue)) {
            return { ...prev, [fieldName]: [...existingValue, imageUrl] }
          } else {
            return { ...prev, [fieldName]: [imageUrl] }
          }
        })
      } else {
        // Handle single field - replace value
        setParameters(prev => ({ ...prev, [fieldName]: imageUrl }))
      }
    }

    window.addEventListener('pasteImageUrl', handlePasteImageUrl as EventListener)
    return () => {
      window.removeEventListener('pasteImageUrl', handlePasteImageUrl as EventListener)
    }
  }, [])

  return (
    <div className="flex flex-col h-full">
      {/* Sticky Header Section */}
      <div className={`${isMobile ? 'sticky top-0 z-40 bg-background pb-3 pt-3 px-1 -mt-4 mb-4' : ''} space-y-3 ${isMobile ? 'border-b border-border' : ''}`}>
        {!isMobile && <h3 className="text-sm font-medium">Select Model</h3>}
        
        {/* Search Bar with Dropdown */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => {
                const newQuery = e.target.value
                setSearchQuery(newQuery)
                
              }}
              onFocus={() => {
                setIsSearchFocused(true)
                // On mobile, scroll the input into view when focused
                if (isMobile) {
                  setTimeout(() => {
                    const input = document.querySelector('input[placeholder="Search models..."]') as HTMLInputElement
                    if (input) {
                      input.scrollIntoView({ behavior: 'smooth', block: 'center' })
                    }
                  }, 100)
                }
              }}
              onBlur={() => setTimeout(() => setIsSearchFocused(false), 150)}
              className="pl-10"
            />
          </div>
          
          {/* Search Results Dropdown */}
          {isSearchFocused && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-background border rounded-md shadow-lg z-50 max-h-80 overflow-hidden min-w-0 flex flex-col">
              <div className="p-2 border-b">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{filteredModels.length} models</span>
                  {searchQuery && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchQuery('')}
                      className="h-auto p-1 text-xs"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>
              
              <ScrollArea className="h-60 overflow-y-auto">
                <div className="p-1">
                  {filteredModels.map((model) => (
                    <Button
                      key={model.id}
                      variant={selectedModel?.id === model.id ? "default" : "ghost"}
                      size="sm"
                      className="w-full h-auto p-2 text-left mb-1 whitespace-normal"
                      onClick={() => {
                        handleModelSelect(model)
                        setIsSearchFocused(false)
                      }}
                    >
                      <div className="flex items-start justify-between gap-2 w-full">
                        <span className="text-xs font-medium leading-relaxed break-words">{cleanModelName(model.title)}</span>
                        <Badge 
                          variant={getCategoryBadgeInfo(model.task, model.category).variant}
                          className="flex-shrink-0 text-xs font-mono"
                        >
                          {getCategoryBadgeInfo(model.task, model.category).text}
                        </Badge>
                      </div>
                    </Button>
                  ))}
                  
                  {filteredModels.length === 0 && searchQuery && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Search className="size-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No models found</p>
                      <p className="text-xs">Try a different search term</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
        
        {/* Selected Model Display */}
        {selectedModel && (
          <div className="p-2 bg-muted rounded-md">
            <div className="flex items-start justify-between gap-2 mb-2">
              <span className="text-xs font-medium leading-relaxed break-words">{cleanModelName(selectedModel.title)}</span>
              <Badge 
                variant={getCategoryBadgeInfo(selectedModel.task, selectedModel.category).variant}
                className="flex-shrink-0 text-xs font-mono"
              >
                {getCategoryBadgeInfo(selectedModel.task, selectedModel.category).text}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedModel.description}
            </p>
          </div>
        )}
      </div>

      {/* Selected Model Parameters */}
      {selectedModel && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className={`${isMobile ? 'pt-4' : 'border-t pt-4 mt-4'}`}>
            <h4 className="text-sm font-medium mb-4">Parameters</h4>
          </div>
          
          <div className="flex-1 min-h-0">
            <ScrollArea className="h-full">
              <div className="space-y-4 pb-4">
                {selectedModel.inputs
                  .sort((a, b) => {
                    // Required fields first, then optional fields
                    if (a.required && !b.required) return -1
                    if (!a.required && b.required) return 1
                    return 0
                  })
                  .map((input) => (
                    <div key={input.name}>
                      {renderParameterInput(input)}
                      {input.description && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {input.description}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            </ScrollArea>
          </div>
        </div>
      )}

      {/* Fixed Generate Button */}
      {selectedModel && (
        <div className="border-t pt-3 mt-auto">
          <Button 
            onClick={handleGenerate} 
            className="w-full" 
            size="sm"
            disabled={!selectedModel || isGenerating || !isAuthenticated}
          >
            <Play className="size-3 mr-2" />
            {isGenerating 
              ? 'Generating...' 
              : !isAuthenticated 
                ? 'Sign in to Generate' 
                : selectedModel?.task?.includes('video') ? 'Generate Video' : 'Generate Image'
            }
          </Button>
        </div>
      )}
    </div>
  )
}
