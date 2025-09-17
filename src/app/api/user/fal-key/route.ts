import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Validation schema for storing FAL API key
const storeFalKeySchema = z.object({
  apiKey: z.string().min(1, 'API key is required')
})

// Verify FAL API key by making a test request
async function verifyFalAPIKey(apiKey: string): Promise<boolean> {
  try {
    // Test the API key by calling a FAL model endpoint (since balance endpoint doesn't exist)
    const response = await fetch('https://fal.run/fal-ai/fast-sdxl/submit', {
      method: 'POST',
      headers: {
        'Authorization': `Key ${apiKey.trim()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        input: {
          prompt: 'test' // Minimal test prompt
        }
      })
    })

    // 401 = invalid key, other 4xx errors likely mean valid key but bad request
    if (response.status === 401) {
      return false // Invalid key
    }
    
    return response.ok || (response.status >= 400 && response.status < 500)
  } catch (error) {
    console.error('FAL API key verification failed:', error)
    return false
  }
}

// POST - Verify FAL API key (no storage needed, frontend handles localStorage)
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body = await request.json()
    const validationResult = storeFalKeySchema.safeParse(body)
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request', 
          details: validationResult.error.issues.map((e) => e.message).join(', ')
        },
        { status: 400 }
      )
    }

    const { apiKey } = validationResult.data

    // Verify FAL API key before confirming it's valid
    const isValidKey = await verifyFalAPIKey(apiKey)
    if (!isValidKey) {
      return NextResponse.json(
        { error: 'Invalid FAL API key', details: 'The provided API key is not valid or has expired' },
        { status: 400 }
      )
    }

    // Return success - frontend will handle storing in localStorage
    return NextResponse.json({
      message: 'FAL API key verified successfully',
      valid: true
    })

  } catch (error) {
    console.error('Error verifying FAL key:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// GET - Check FAL API key status (from request headers)
export async function GET(request: NextRequest) {
  try {
    const falApiKey = request.headers.get('x-fal-api-key')
    
    if (!falApiKey) {
      return NextResponse.json({
        hasKey: false,
        keyCreatedAt: null,
        keyUpdatedAt: null
      })
    }

    // Verify the key is still valid
    const isValid = await verifyFalAPIKey(falApiKey)
    
    return NextResponse.json({
      hasKey: isValid,
      valid: isValid,
      keyCreatedAt: null, // Not tracking creation time
      keyUpdatedAt: null   // Not tracking update time
    })

  } catch (error) {
    console.error('Error checking FAL key status:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: 'Failed to process request' },
      { status: 500 }
    )
  }
}

// DELETE - Remove FAL API key (frontend handles localStorage removal)
export async function DELETE(request: NextRequest) {
  try {
    // Just return success - frontend will handle localStorage removal
    return NextResponse.json({
      message: 'FAL API key removal confirmed'
    })

  } catch (error) {
    console.error('Error in FAL key deletion:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: 'Failed to process request' },
      { status: 500 }
    )
  }
}