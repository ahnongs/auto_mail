import { useRef, useEffect, useState, useCallback } from 'react'

export default function FileDropZone({ file, onChange }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (!file) { setPreview(null); return }
    const url = URL.createObjectURL(file)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  const handleFile = useCallback((f) => {
    if (f && f.type.startsWith('image/')) onChange(f)
  }, [onChange])

  // Ctrl+V 붙여넣기
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

  if (preview) {
    return (
      <div style={s.previewWrap}>
        <img src={preview} alt="첨부 이미지" style={s.previewImg} />
        <div style={s.previewOverlay}>
          <button style={s.removeBtn} onClick={() => onChange(null)}>✕ 제거</button>
        </div>
        <div style={s.fileName}>📎 {file.name}</div>
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
        accept="image/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFile(e.target.files[0])}
      />
      <div style={s.icon}>🖼️</div>
      <div style={s.mainText}>클릭하거나 파일을 드래그해서 올려주세요</div>
      <div style={s.subText}>또는 캡처 후 <kbd style={s.kbd}>Ctrl</kbd> + <kbd style={s.kbd}>V</kbd> 로 바로 붙여넣기</div>
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
  mainText: { fontSize: 14, color: '#555', marginBottom: 6 },
  subText: { fontSize: 12, color: '#aaa' },
  kbd: { background: '#eee', border: '1px solid #ccc', borderRadius: 3, padding: '1px 5px', fontSize: 11, fontFamily: 'monospace' },
  previewWrap: { position: 'relative', borderRadius: 10, overflow: 'hidden', border: '2px solid #e0e0e0' },
  previewImg: { width: '100%', maxHeight: 200, objectFit: 'contain', display: 'block', background: '#f5f5f5' },
  previewOverlay: { position: 'absolute', top: 8, right: 8 },
  removeBtn: { background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' },
  fileName: { padding: '6px 12px', fontSize: 12, color: '#888', background: '#f5f5f5' },
}
