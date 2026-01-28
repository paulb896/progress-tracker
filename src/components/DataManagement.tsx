import React, { useRef, useState } from 'react'
import { loadRoutines, saveRoutines } from '../routines/storage'
import { loadCompletions, saveCompletions } from '../completions/storage'

const EXPORT_VERSION = 1

export const DataManagement = () => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const handleExport = () => {
    const routines = loadRoutines()
    const completions = loadCompletions()

    const data = {
      version: EXPORT_VERSION,
      timestamp: new Date().toISOString(),
      routines,
      completions,
    }

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `progress-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const raw = event.target?.result as string
        const data = JSON.parse(raw)

        if (!data || typeof data !== 'object') {
          throw new Error('Invalid file format')
        }

        // Basic validation
        if (!Array.isArray(data.routines) || !Array.isArray(data.completions)) {
          throw new Error('Missing routines or completions data')
        }

        const confirmMessage = `Found ${data.routines.length} routines and ${data.completions.length} completion records.\n\nThis will REPLACE your current data. Are you sure?`
        
        if (window.confirm(confirmMessage)) {
          saveRoutines(data.routines)
          saveCompletions(data.completions)
          setImportStatus({ type: 'success', message: 'Data imported successfully! Reloading...' })
          setTimeout(() => {
            window.location.reload()
          }, 1500)
        } else {
            // clear input
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
      } catch (err) {
        console.error(err)
        setImportStatus({ type: 'error', message: 'Failed to import data. Invalid JSON file.' })
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="glassPanel" style={{ borderRadius: 24, padding: 24, marginTop: 32 }}>
      <h2 className="panelTitlePlain" style={{ marginBottom: 16 }}>Data Management</h2>
      <p style={{ color: 'var(--muted)', marginBottom: 24 }}>
        Export your data to back it up or transfer it to another device.
      </p>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <button className="button secondary" onClick={handleExport}>
            <span style={{ marginRight: 8 }}>↓</span> Export Backup
        </button>
        
        <button className="button secondary" onClick={handleImportClick}>
            <span style={{ marginRight: 8 }}>↑</span> Import Backup
        </button>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".json"
        style={{ display: 'none' }}
      />

      {importStatus && (
        <div style={{ 
          marginTop: 16, 
          padding: 12, 
          borderRadius: 8, 
          background: importStatus.type === 'success' ? 'rgba(45, 212, 191, 0.1)' : 'rgba(251, 113, 133, 0.1)',
          color: importStatus.type === 'success' ? 'var(--accent)' : 'var(--danger)',
          border: `1px solid ${importStatus.type === 'success' ? 'var(--accent)' : 'var(--danger)'}`
        }}>
          {importStatus.message}
        </div>
      )}
    </div>
  )
}
