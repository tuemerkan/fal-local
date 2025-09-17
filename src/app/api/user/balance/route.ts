import { NextRequest, NextResponse } from 'next/server'
import { BalanceResponse, FalBalance } from '@/lib/types'

export async function GET(request: NextRequest) {
  try {
    // Get FAL API key from request headers
    const falApiKey = request.headers.get('x-fal-api-key')
    
    if (!falApiKey) {
      const response: BalanceResponse = {
        success: false,
        error: 'FAL API key required',
        details: 'Please configure your FAL API key'
      }
      return NextResponse.json(response, { status: 401 })
    }

    // Make request to FAL API to get user balance
    const response = await fetch('https://rest.alpha.fal.ai/billing/user_balance', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'authorization': `Key ${falApiKey}`,
      },
    })

    if (!response.ok) {
      // FAL API balance request failed
      
      if (response.status === 401) {
        const balanceResponse: BalanceResponse = {
          success: false,
          error: 'Invalid FAL API key',
          details: 'Your API key is no longer valid or has expired'
        }
        return NextResponse.json(balanceResponse, { status: 401 })
      }
      
      const balanceResponse: BalanceResponse = {
        success: false,
        error: 'Failed to fetch balance',
        details: 'Unable to retrieve balance from FAL API'
      }
      return NextResponse.json(balanceResponse, { status: response.status })
    }

    const balanceData = await response.json()

    const balanceResponse: BalanceResponse = {
      success: true,
      balance: balanceData
    }

    return NextResponse.json(balanceResponse)

  } catch (error) {
    console.error('Error fetching user balance:', error)
    
    const response: BalanceResponse = {
      success: false,
      error: 'Internal server error',
      details: 'Failed to process request'
    }
    
    return NextResponse.json(response, { status: 500 })
  }
}