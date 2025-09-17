import { NextResponse } from 'next/server'
import falModelsData from '@/data/fal-models-combined.json'

export async function GET() {
  try {
    return NextResponse.json(falModelsData)
  } catch (error) {
    // Failed to load fal models data
    return NextResponse.json(
      { error: 'Failed to load models data' },
      { status: 500 }
    )
  }
}
