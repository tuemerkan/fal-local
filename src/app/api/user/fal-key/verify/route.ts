import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const verifyKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required')
})

// Verify FAL API key by making a test request
async function verifyFalAPIKey(apiKey: string): Promise<{ valid: boolean; error?: string }> {
  try {
    // Test the API key by calling a FAL model endpoint (since balance endpoint doesn't exist)
    const trimmedKey = apiKey.trim()
    
    // Use a lightweight model endpoint to test authentication
    const response = await fetch('https://fal.run/fal-ai/fast-sdxl/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${trimmedKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          prompt: 'test' // Minimal test prompt
        }
      })
    })
    
    if (response.ok) {
      // If we get a 200 response, the API key is valid
      return { valid: true }
    } else if (response.status === 401) {
      // 401 means the API key is invalid
      return { 
        valid: false, 
        error: 'Invalid or expired API key' 
      }
    } else {
      // Other errors (400, 422, etc.) might mean the key is valid but the request has issues
      // For key validation purposes, treat as valid if not auth error
      const errorText = await response.text()
      
      // Check if it's a validation error (key is valid but request is bad)
      if (response.status >= 400 && response.status < 500 && response.status !== 401) {
        return { valid: true } // Key is valid, just bad request format
      }
      
      return { 
        valid: false, 
        error: `API key verification failed: HTTP ${response.status} - ${errorText}` 
      }
    }
  } catch (error) {
    console.error('FAL API key verification failed:', error)
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Network error during verification'
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validationResult = verifyKeySchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          valid: false,
          error: 'Invalid request format',
          details: validationResult.error.issues.map((e) => e.message).join(', ')
        },
        { status: 400 }
      )
    }

    const { apiKey } = validationResult.data

    // Verify the API key
    const verificationResult = await verifyFalAPIKey(apiKey)
    
    if (verificationResult.valid) {
      return NextResponse.json({
        valid: true,
        message: 'API key is valid and working'
      })
    } else {
      return NextResponse.json(
        {
          valid: false,
          error: 'Invalid API key',
          details: verificationResult.error || 'The API key could not be verified'
        },
        { status: 400 }
      )
    }

  } catch (error) {
    console.error('Error in FAL key verification:', error)
    return NextResponse.json(
      { 
        valid: false,
        error: 'Internal server error', 
        details: 'Failed to verify API key'
      },
      { status: 500 }
    )
  }
}