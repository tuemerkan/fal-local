"use client"

import { useState, useEffect, useCallback } from 'react'
import { FalBalance, BalanceResponse } from '@/lib/types'
import { LocalStorage } from '@/lib/local-storage'

export function useBalance() {
  const [balance, setBalance] = useState<FalBalance | number | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchBalance = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Check if FAL API key is configured
      if (!LocalStorage.falKey.hasKey()) {
        setBalance(null)
        setError('Please configure your FAL API key')
        setLoading(false)
        return
      }

      // Try to get balance from API that uses FAL key header
      try {
        const falApiKey = LocalStorage.falKey.getKey()
        
        // Call balance API with FAL key in header
        const balanceResponse = await fetch('/api/user/balance', {
          headers: {
            'x-fal-api-key': falApiKey!,
          },
        })

        if (balanceResponse.ok) {
          const balanceResult = await balanceResponse.json()
          
          if (balanceResult.success && balanceResult.balance) {
            setBalance(balanceResult.balance)
            // Cache the balance in localStorage
            LocalStorage.balance.setBalance(balanceResult.balance)
          } else {
            setError(balanceResult.error || 'Failed to fetch balance')
          }
        } else {
          // Fallback to cached balance
          const cachedBalance = LocalStorage.balance.getBalance()
          if (cachedBalance) {
            setBalance(cachedBalance)
          } else {
            setError('Failed to fetch balance')
          }
        }
      } catch (apiError) {
        console.error('FAL API error:', apiError)
        
        // Fallback to cached balance
        const cachedBalance = LocalStorage.balance.getBalance()
        if (cachedBalance) {
          setBalance(cachedBalance)
        } else {
          setError('Failed to connect to FAL API')
        }
      }
    } catch (err) {
      setError('Failed to load balance')
      console.error('Fetch balance error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch balance on mount
  useEffect(() => {
    fetchBalance()
  }, [fetchBalance])

  // Listen for generation events to refresh balance
  useEffect(() => {
    const handleGenerationCompleted = () => {
      // Refresh balance after generation (since it likely costs money)
      fetchBalance()
    }

    const handleKeyUpdate = () => {
      // Refresh balance when API key changes
      fetchBalance()
    }

    window.addEventListener('generationCompleted', handleGenerationCompleted)
    window.addEventListener('falKeyUpdated', handleKeyUpdate)
    
    return () => {
      window.removeEventListener('generationCompleted', handleGenerationCompleted)
      window.removeEventListener('falKeyUpdated', handleKeyUpdate)
    }
  }, [fetchBalance])

  return {
    balance,
    loading,
    error,
    refresh: fetchBalance
  }
}