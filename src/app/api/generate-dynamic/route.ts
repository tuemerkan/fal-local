import { NextRequest, NextResponse } from 'next/server'
import { GenerateRequest, GenerateResponse, Generation } from '@/lib/types'
import falModels from '@/data/fal-models-combined.json'
import { fal } from '@fal-ai/client'

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json()
    const { modelId, parameters } = body

    if (!modelId || !parameters) {
      return NextResponse.json({ error: 'Missing modelId or parameters' }, { status: 400 })
    }

    // Get FAL API key from request headers (sent from frontend)
    const falApiKey = request.headers.get('x-fal-api-key')
    
    
    if (!falApiKey) {
      return NextResponse.json(
        { 
          error: 'FAL API key required', 
          details: 'Please configure your FAL API key',
          requiresKeySetup: true
        },
        { status: 403 }
      )
    }

    // Configure FAL client with the provided key
    const falClient = { ...fal }
    falClient.config({
      credentials: falApiKey,
    })

    // Find model info to determine if it's a video or image model
    const allModels = (falModels as { models: Array<{ id: string, title: string, task: string }> }).models
    const modelInfo = allModels.find(model => model.id === modelId)
    const isVideoModel = modelInfo?.task?.includes('video') || false
    const modelTitle = modelInfo?.title || modelId
    const modelTask = modelInfo?.task || 'unknown'

    
    try {
      // Call FAL API
      const result = await falClient.subscribe(modelId, {
        input: parameters,
        logs: true,
      })

      
      // Create generation object to return to frontend (frontend will save to localStorage)
      const generation: Generation = {
        id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: 'local-user', // No real user ID needed
        model_id: modelId,
        model_title: modelTitle,
        model_task: modelTask,
        parameters,
        result,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const response: GenerateResponse = {
        success: true,
        data: [generation]
      }

      return NextResponse.json(response)

    } catch (falError: any) {
      console.error(`FAL API error for model ${modelTitle}:`, falError)
      
      // Create error generation object
      const errorGeneration: Generation = {
        id: `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: 'local-user',
        model_id: modelId,
        model_title: modelTitle,
        model_task: modelTask,
        parameters,
        error_message: falError.message || 'Generation failed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }

      const response: GenerateResponse = {
        success: false,
        data: [errorGeneration],
        error: falError.message || 'Generation failed'
      }

      return NextResponse.json(response, { status: 500 })
    }

  } catch (error) {
    console.error('Generate API error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    )
  }
}