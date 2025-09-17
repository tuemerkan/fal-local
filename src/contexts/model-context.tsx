'use client'

import React, { createContext, useContext, useState, ReactNode } from 'react'

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

interface ModelContextType {
  currentModel: Model | null
  setCurrentModel: (model: Model | null) => void
  hasImageUrlFields: () => boolean
  getImageUrlFieldName: () => string | null
  pasteImageUrl: (imageUrl: string) => void
  highlightedField: string | null
  setHighlightedField: (fieldName: string | null) => void
}

const ModelContext = createContext<ModelContextType | undefined>(undefined)

export function ModelProvider({ children }: { children: ReactNode }) {
  const [currentModel, setCurrentModel] = useState<Model | null>(null)
  const [highlightedField, setHighlightedField] = useState<string | null>(null)

  const hasImageUrlFields = () => {
    if (!currentModel) return false
    return currentModel.inputs.some(input => 
      input.name === 'image_url' || 
      input.name === 'image_urls' ||
      input.name.includes('image_url')
    )
  }

  const getImageUrlFieldName = () => {
    if (!currentModel) return null
    const imageUrlField = currentModel.inputs.find(input => 
      input.name === 'image_url' || 
      input.name === 'image_urls' ||
      input.name.includes('image_url')
    )
    return imageUrlField?.name || null
  }

  const pasteImageUrl = (imageUrl: string) => {
    if (!currentModel) return
    
    // Find the first image_url field
    const imageUrlField = currentModel.inputs.find(input => 
      input.name === 'image_url' || 
      input.name === 'image_urls' ||
      input.name.includes('image_url')
    )
    
    if (imageUrlField) {
      // Dispatch a custom event that the ModelPicker can listen to
      window.dispatchEvent(new CustomEvent('pasteImageUrl', {
        detail: { fieldName: imageUrlField.name, imageUrl }
      }))
    }
  }

  return (
    <ModelContext.Provider value={{ 
      currentModel, 
      setCurrentModel, 
      hasImageUrlFields,
      getImageUrlFieldName,
      pasteImageUrl,
      highlightedField,
      setHighlightedField
    }}>
      {children}
    </ModelContext.Provider>
  )
}

export function useModel() {
  const context = useContext(ModelContext)
  if (context === undefined) {
    throw new Error('useModel must be used within a ModelProvider')
  }
  return context
}
