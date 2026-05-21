import { useRef, useEffect, useState, useCallback } from 'react'

const FILE_ICONS = {
  'application/pdf': '📄',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '📊',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '📝',
}

function fileIcon(type) {
  if (type.startsWith('image/')) return '🖼️'
  return FILE_ICONS[type] || '📎'
}

export default function FileDropZone({ file, onChange, accept }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [imgPreview, setImgPreview] = useState(null)

  useEffect(() => {
    if (!file || !file.type.startsWith('image/')) { setImgPreview(null); return }
    const url = URL.createObjectURL(file)
    setImgPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = useCallback((f) => {
    if (f) onChange(f)
  }, [onChange])

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          handleFile(item.getAsFile())
          break
        }
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [handleFile])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  if (file) {
    return (
      <div style={s.previewWrap}>
        {imgPreview ? (
          <img src={imgPreview} alt="첨부 이미지" style={s.previewImg} />
        ) : (
          <div style={s.filePreview}>
            <span style={s.filePreviewIcon}>{fileIcon(file.type)}</span>
            <span style={s.filePreviewName}>{file.name}</span>
            <span style={s.filePreviewSize}>{(file.size / 1024).toFixed(0)} KB</span>
          </div>
        )}
        <div style={s.previewActions}>
          <span style={s.fileName}>📎 {file.name}</span>
          <button style={s.removeBtn} onClick={() => onChange(null)}>✕ 제거</button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{ ...s.zone, ...(dragging ? s.zoneDrag : {}) }}
      onClick={() => inputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept || '*/*'}
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <div style={s.icon}>📎</div>
      <div style={s.mainText}>클릭하거나 파일을 드래그해서 올려주세요</div>
      <div style={s.subText}>이미지 · PDF · Excel · Word 등 모든 파일 가능</div>
      <div style={s.subText2}>이미지는 <kbd style={s.kbd}>Ctrl</kbd> + <kbd style={s.kbd}>V</kbd> 붙여넣기도 지원</div>
    </div>
  )
}

const s = {
  zone: {
    border: '2px dashed #d0d0d0', borderRadius: 10, padding: '28px 20px',
    textAlign: 'center', cursor: 'pointer', background: '#fafafa',
    transition: 'all 0.15s',
  },
  zoneDrag: { border: '2px dashed #667eea', background: '#f0f0ff' },
  icon: { fontSize: 32, marginBottom: 8 },
  mainText: { fontSize: 14, color: '#555', marginBottom: 4 },
  subText: { fontSize: 12, color: '#aaa', marginBottom: 2 },
  subText2: { fontSize: 12, color: '#aaa', marginTop: 4 },
  kbd: { background: '#eee', border: '1px solid #ccc', borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'monospace' },
  previewWrap: { borderRadius: 10, overflow: 'hidden', border: '2px solid #e0e0e0' },
  previewImg: { width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', background: '#f5f5f5' },
  filePreview: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px', background: '#f8f8ff' },
  filePreviewIcon: { fontSize: 36 },
  filePreviewName: { fontSize: 14, color: '#333', fontWeight: 600, flex: 1, wordBreak: 'break-all' },
  filePreviewSize: { fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' },
  previewActions: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 12px', background: '#f5f5f5' },
  removeBtn: { background: 'none', border: '1px solid #ddd', color: '#888', borderRadius: 6, padding: '3px 10px', fontSize: 12, cursor: 'pointer' },
  fileName: { fontSize: 12, color: '#888' },
}
