import { NextResponse } from 'next/server'

// This endpoint is no longer needed since images are stored in localStorage
// But keeping it for compatibility during migration

export async function GET() {
  try {
    // Return empty array since images are now stored in localStorage
    // Frontend should use localStorage directly instead of this API
    return NextResponse.json({ 
      images: [],
      message: 'Images are now stored locally. Please use localStorage directly.'
    })

  } catch (error) {
    console.error('Get generated images API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}