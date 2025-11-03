import { useState } from 'react'
import './ConflictResolutionBanner.css'

interface ConflictResolutionBannerProps {
  conflict: {
    current_version: number
    expected_version: number
    current_values: any
    submitted_values: any
  }
  currentValues: any
  submittedValues: any
  onResolve: (useCurrent: boolean) => void
}

const ConflictResolutionBanner = ({
  conflict,
  currentValues,
  submittedValues,
  onResolve,
}: ConflictResolutionBannerProps) => {
  const [showDiff, setShowDiff] = useState(false)

  const getDiff = () => {
    const diff: Array<{ field: string; current: any; submitted: any }> = []
    const fields = Object.keys({ ...currentValues, ...submittedValues })
    
    fields.forEach(field => {
      if (currentValues[field] !== submittedValues[field]) {
        diff.push({
          field,
          current: currentValues[field],
          submitted: submittedValues[field],
        })
      }
    })
    
    return diff
  }

  const diff = getDiff()

  return (
    <div className="conflict-banner">
      <div className="conflict-header">
        <div className="conflict-icon">⚠️</div>
        <div className="conflict-content">
          <h3>Version Conflict Detected</h3>
          <p>
            This product was modified by another user. Current version: {conflict.current_version}, 
            Your version: {conflict.expected_version}
          </p>
        </div>
        <button
          className="close-btn"
          onClick={() => onResolve(true)}
          aria-label="Use current values"
        >
          Use Current
        </button>
      </div>
      
      <button
        className="toggle-diff"
        onClick={() => setShowDiff(!showDiff)}
      >
        {showDiff ? 'Hide' : 'Show'} Differences
      </button>

      {showDiff && (
        <div className="diff-view">
          <h4>Changes Detected:</h4>
          <table className="diff-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Current Value</th>
                <th>Your Value</th>
              </tr>
            </thead>
            <tbody>
              {diff.map((item, idx) => (
                <tr key={idx} className={item.current !== item.submitted ? 'changed' : ''}>
                  <td><strong>{item.field}</strong></td>
                  <td className="current-value">{String(item.current || 'N/A')}</td>
                  <td className="submitted-value">{String(item.submitted || 'N/A')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="conflict-actions">
            <button
              className="btn-use-current"
              onClick={() => onResolve(true)}
            >
              Use Current Values
            </button>
            <button
              className="btn-use-submitted"
              onClick={() => onResolve(false)}
            >
              Overwrite with Your Values
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default ConflictResolutionBanner

