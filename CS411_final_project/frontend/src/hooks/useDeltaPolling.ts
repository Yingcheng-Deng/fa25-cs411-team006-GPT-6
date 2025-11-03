import { useEffect, useRef } from 'react'
import { deltaApi } from '../api/delta'

interface UseDeltaPollingOptions {
  enabled?: boolean
  interval?: number
  onChanges?: (changes: any) => void
}

export const useDeltaPolling = ({ enabled = true, interval = 5000, onChanges }: UseDeltaPollingOptions = {}) => {
  const lastTimestampRef = useRef<string>(new Date().toISOString())
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (!enabled) return

    const poll = async () => {
      try {
        const response = await deltaApi.getChanges(lastTimestampRef.current)
        
        if (response.changes && onChanges) {
          const hasChanges = 
            response.changes.products.length > 0 ||
            response.changes.orders.length > 0 ||
            response.changes.audit.length > 0
          
          if (hasChanges) {
            onChanges(response.changes)
          }
        }
        
        lastTimestampRef.current = response.timestamp
      } catch (error) {
        console.error('Delta polling error:', error)
      }
    }

    // Initial poll
    poll()

    // Set up interval
    intervalRef.current = window.setInterval(poll, interval)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
      }
    }
  }, [enabled, interval, onChanges])

  return {
    resetTimestamp: () => {
      lastTimestampRef.current = new Date().toISOString()
    }
  }
}

