
// Unified generation type that replaces both GeneratedImage and DynamicGeneration
export interface Generation {
  id: string
  user_id: string
  model_id: string
  model_title?: string
  model_task?: string
  parameters: Record<string, unknown>
  result?: {
    // New FAL API structure
    data?: {
      images?: Array<{
        url: string
        width?: number
        height?: number
        content_type?: string
        file_name?: string
        file_size?: number | null
        thumbnail_url?: string
        originalUrl?: string // Reference to original remote URL before local storage
      }>
      video?: {
        url: string
        width?: number
        height?: number
        duration?: number
        content_type?: string
      }
      videos?: Array<{
        url: string
        width?: number
        height?: number
        duration?: number
        content_type?: string
      }>
      description?: string
    }
    requestId?: string
    
    // Legacy structure (backwards compatibility)
    images?: Array<{
      url: string
      width?: number
      height?: number
      content_type?: string
      thumbnail_url?: string
      originalUrl?: string // Reference to original remote URL before local storage
    }>
    video?: {
      url: string
      width?: number
      height?: number
      duration?: number
      content_type?: string
    }
    videos?: Array<{
      url: string
      width?: number
      height?: number
      duration?: number
      content_type?: string
    }>
  }
  error_message?: string
  created_at: string
  updated_at: string
}

// Legacy type for backwards compatibility - will be removed after migration
export interface GeneratedImage {
  id: string
  user_id: string
  lora_id: string
  lora_name: string
  prompt: string
  image_url: string
  thumbnail_url?: string
  width: number
  height: number
  image_ratio: string
  num_images_requested: number
  created_at: string
}

// Dynamic Model System Types
export interface FalModelField {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'image' | 'video' | 'file'
  description?: string
  default?: string | number | boolean | null | undefined
  enum?: string[]
  required?: boolean
  min?: number
  max?: number
  placeholder?: string
}

export interface FalModel {
  id: string
  title: string
  task: 'text-to-image' | 'image-to-image' | 'video' | 'audio' | 'llm' | 'unknown'
  endpoint: string
  inputs: FalModelField[]
  outputs: FalModelField[]
  source: string
}

export interface FalModelsData {
  $schema: string
  title: string
  generatedAt: string
  source: string
  count: number
  models: FalModel[]
  errors?: Array<{ apiUrl: string; error: string }>
}

export interface GenerateRequest {
  modelId: string
  parameters: Record<string, unknown>
}

// Legacy type for backwards compatibility - will be removed after migration
export interface DynamicGenerateRequest {
  modelId: string
  parameters: Record<string, unknown>
}

export interface GenerateResponse {
  success: boolean
  data?: Generation[]
  error?: string
}

// Legacy type for backwards compatibility - will be removed after migration
export interface DynamicGenerateResponse {
  success: boolean
  data?: DynamicGeneration[]
  error?: string
}

// Legacy type for backwards compatibility - will be removed after migration
export interface DynamicGeneration {
  id: string
  user_id: string
  model_id: string
  model_title?: string
  model_task?: string
  parameters: Record<string, unknown>
  result?: {
    images?: Array<{
      url: string
      width?: number
      height?: number
      content_type?: string
    }>
    video?: {
      url: string
      width?: number
      height?: number
      duration?: number
      content_type?: string
    }
    videos?: Array<{
      url: string
      width?: number
      height?: number
      duration?: number
      content_type?: string
    }>
  }
  error_message?: string
  created_at: string
  updated_at: string
}

// Balance types
export interface FalBalance {
  balance: number
  currency: string
  formatted?: string
}

export interface BalanceResponse {
  success: boolean
  balance?: FalBalance | number // Handle both object and number responses
  error?: string
  details?: string
}

// Tracking and Analytics types
declare global {
  interface Window {
    datafast?: (event: string, data?: Record<string, string | number>) => void
    gtag?: (command: string, targetId: string, config?: Record<string, string | number | boolean>) => void
  }
} 