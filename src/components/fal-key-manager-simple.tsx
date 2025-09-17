'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LocalStorage } from '@/lib/local-storage'

interface FalKeyStatus {
  hasKey: boolean
  keyCreatedAt?: string | null
  keyUpdatedAt?: string | null
}

interface FalKeyManagerSimpleProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function FalKeyManagerSimple({ isOpen, onOpenChange }: FalKeyManagerSimpleProps) {
  const [keyStatus, setKeyStatus] = useState<FalKeyStatus | null>(null)
  const [newApiKey, setNewApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isVerifying, setIsVerifying] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setNewApiKey('')
      setShowApiKey(false)
      setError(null)
      setSuccess(null)
      setIsLoading(false)
      setIsVerifying(false)
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    } else {
      fetchKeyStatus()
    }
  }, [isOpen])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onOpenChange(false)
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onOpenChange])

  const fetchKeyStatus = async () => {
    try {
      // Get key status from localStorage
      const metadata = LocalStorage.falKey.getKeyMetadata()
      setKeyStatus(metadata)
    } catch (error) {
      // Error fetching key status
    }
  }

  const verifyApiKey = async (apiKey: string): Promise<boolean> => {
    setIsVerifying(true)
    setError(null)
    
    
    try {
      const response = await fetch('/api/user/fal-key/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey })
      })

      const data = await response.json()
      
      if (data.valid) {
        return true
      } else {
        setError(data.error || 'Invalid API key')
        return false
      }
    } catch {
      setError('Failed to verify API key. Please try again.')
      return false
    } finally {
      setIsVerifying(false)
    }
  }

  const handleSaveKey = async () => {
    
    if (!newApiKey.trim()) {
      setError('Please enter an API key')
      return
    }

    // Verify key first (use trimmed version)
    const trimmedKey = newApiKey.trim()
    
    const isValid = await verifyApiKey(trimmedKey)
    
    if (!isValid) {
      return
    }

    setIsLoading(true)
    setError(null)
    setSuccess(null)

    try {
      
      // Check localStorage availability
      if (typeof Storage === 'undefined') {
        throw new Error('localStorage is not available')
      }
      
      // Check current storage state
      
      // Save key to localStorage directly (use trimmed version)
      LocalStorage.falKey.setKey(trimmedKey)
      
      // Small delay to ensure localStorage write completes
      await new Promise(resolve => setTimeout(resolve, 50))
      
      // Check storage state after save
      
      // Verify it was saved by reading it back
      const savedKey = LocalStorage.falKey.getKey()
      
      // Additional verification using raw localStorage
      const rawStoredValue = localStorage.getItem('fal_local_api_key')
      
      if (rawStoredValue) {
        try {
          const parsed = JSON.parse(rawStoredValue)
        } catch (e) {
        }
      }
      
      // Track successful API key save
      
      setSuccess('FAL API key saved locally!')
      setNewApiKey('')
      setShowApiKey(false)
      await fetchKeyStatus()
      
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('falKeyUpdated'))
    } catch (error) {
      setError(`Failed to save API key: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteKey = async () => {
    setIsDeleting(true)
    setError(null)
    setSuccess(null)

    try {
      // Remove key from localStorage
      LocalStorage.falKey.removeKey()
      
      // Track successful API key deletion
      
      setSuccess('FAL API key deleted successfully!')
      setNewApiKey('')
      setShowDeleteConfirm(false)
      await fetchKeyStatus()
      
      // Dispatch event for other components
      window.dispatchEvent(new CustomEvent('falKeyUpdated'))
    } catch (error) {
      setError('Failed to delete API key. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const isValidFalKeyFormat = (key: string) => {
    if (!key) return false
    const trimmedKey = key.trim()
    if (trimmedKey.length < 20 || trimmedKey.length > 200) return false
    // Allow alphanumeric, underscore, hyphen, colon, period, and forward slash
    // Note: Allow most characters that might appear in API keys
    return /^[a-zA-Z0-9_\-:.\/]+$/.test(trimmedKey)
  }

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onOpenChange(false)
        }
      }}
    >
      <Card className="w-full max-w-md shadow-2xl border-0">
        <CardHeader className="pb-6">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">API Key</CardTitle>
              <CardDescription className="text-sm">
                Configure your personal FAL API key (stored locally)
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            >
              ×
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Status */}
          {keyStatus && (
            <div className="flex items-center gap-2">
              {keyStatus.hasKey ? (
                <>
                  <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-700 font-medium">Key configured locally</span>
                </>
              ) : (
                <>
                  <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
                  <span className="text-sm text-muted-foreground">No key set</span>
                </>
              )}
            </div>
          )}

          {/* Key Input */}
          <div className="space-y-2">
            <Label htmlFor="apiKey" className="text-sm font-medium">
              API Key
            </Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="Paste your FAL API key..."
                value={newApiKey}
                onChange={(e) => {
                  setNewApiKey(e.target.value)
                  setError(null)
                  setSuccess(null)
                }}
                className={`pr-16 ${!isValidFalKeyFormat(newApiKey) && newApiKey ? 'border-red-300 focus:border-red-500' : ''}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 px-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
                onClick={() => setShowApiKey(!showApiKey)}
              >
                {showApiKey ? 'Hide' : 'Show'}
              </Button>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Get your key from{' '}
              <a 
                href="https://fal.ai/dashboard/keys" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline font-medium"
              >
                fal.ai dashboard
              </a>
              . Keys are stored locally in your browser.
            </p>

            {newApiKey && !isValidFalKeyFormat(newApiKey) && (
              <p className="text-xs text-red-600">
                Invalid format. Use your complete API key from fal.ai
              </p>
            )}

          </div>

          {/* Messages */}
          {error && (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 p-3 rounded-md">
              {error}
            </div>
          )}

          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 p-3 rounded-md">
              {success}
            </div>
          )}

          {/* Delete Confirmation */}
          {showDeleteConfirm && (
            <div className="border border-red-200 bg-red-50 p-4 rounded-md space-y-3">
              <div>
                <p className="text-sm font-medium text-red-800">Delete API Key</p>
                <p className="text-xs text-red-600 mt-1">
                  This will permanently remove your stored API key from local storage. You&apos;ll need to configure it again to use the service.
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleDeleteKey}
                  disabled={isDeleting}
                  variant="destructive"
                  size="sm"
                  className="text-xs"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Key'}
                </Button>
                <Button
                  onClick={() => setShowDeleteConfirm(false)}
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleSaveKey}
              disabled={!newApiKey || isLoading || isVerifying || !isValidFalKeyFormat(newApiKey)}
              className="flex-1"
              size="sm"
            >
              {isVerifying ? 'Verifying...' : isLoading ? 'Saving...' : 'Save Key'}
            </Button>
            
            {keyStatus?.hasKey && !showDeleteConfirm && (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                Delete
              </Button>
            )}
            
            <Button
              variant="ghost"
              onClick={() => onOpenChange(false)}
              size="sm"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}