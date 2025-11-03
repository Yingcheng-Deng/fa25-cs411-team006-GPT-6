import { ProductVersion } from '../api/products'
import './VersionHistory.css'

interface VersionHistoryProps {
  versions: ProductVersion[]
}

const VersionHistory = ({ versions }: VersionHistoryProps) => {
  if (versions.length === 0) {
    return <div className="version-history empty">No version history available</div>
  }

  return (
    <div className="version-history">
      <h4>Version History</h4>
      <div className="version-list">
        {versions.map((version, idx) => (
          <div key={version.version_id} className="version-item">
            <div className="version-header">
              <span className="version-number">Version {version.version}</span>
              <span className="version-date">
                {new Date(version.created_at).toLocaleString()}
              </span>
            </div>
            {version.change_summary && (
              <div className="version-summary">{version.change_summary}</div>
            )}
            {version.created_by && (
              <div className="version-author">by {version.created_by}</div>
            )}
            {idx < versions.length - 1 && <div className="version-divider" />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default VersionHistory

