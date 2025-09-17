import { NextRequest, NextResponse } from 'next/server'

// This endpoint is no longer needed since images are stored in localStorage
// But keeping it for compatibility during migration

export async function DELETE(request: NextRequest) {
  try {
    // Frontend should handle deletion directly in localStorage
    return NextResponse.json({ 
      message: 'Deletion is now handled locally. Please use localStorage directly.',
      success: true
    })

  } catch (error) {
    console.error('Delete image API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}