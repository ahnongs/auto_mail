import { useRef, useState, useCallback, useEffect } from 'react'

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

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return (bytes / 1024 / 1024).toFixed(1) + ' MB'
}

function ImageThumb({ file, onRemove }) {
  const [src, setSrc] = useState(null)
  const [hover, setHover] = useState(false)

  useEffect(() => {
    const url = URL.createObjectURL(file)
    setSrc(url)
    return () => URL.revokeObjectURL(url)
  }, [file])

  return (
    <div
      style={s.thumb}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      {src && <img src={src} alt={file.name} style={s.thumbImg} />}
      <button
        style={{ ...s.thumbRemove, opacity: hover ? 1 : 0 }}
        onClick={(e) => { e.stopPropagation(); onRemove() }}
      >✕</button>
      <div style={s.thumbName}>{file.name}</div>
    </div>
  )
}

export default function MultiFileDropZone({ files, onChange }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const addFiles = useCallback((newFiles) => {
    const arr = Array.from(newFiles)
    if (!arr.length) return
    onChange(prev => [...prev, ...arr])
  }, [onChange])

  const removeFile = (i) => onChange(files.filter((_, idx) => idx !== i))

  useEffect(() => {
    const onPaste = (e) => {
      const items = e.clipboardData?.items
      if (!items) return
      const images = []
      for (const item of items) {
        if (item.type.startsWith('image/')) images.push(item.getAsFile())
      }
      if (images.length) addFiles(images)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [addFiles])

  const onDragOver = (e) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false) }
  const onDrop = (e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }

  const hasFiles = files.length > 0
  const images = files.filter(f => f.type.startsWith('image/'))
  const docs = files.filter(f => !f.type.startsWith('image/'))

  return (
    <div
      style={{ ...s.container, ...(dragging ? s.containerDrag : {}) }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="*/*"
        style={{ display: 'none' }}
        onChange={(e) => { addFiles(e.target.files); e.target.value = '' }}
      />

      {hasFiles ? (
        <>
          {/* 이미지 썸네일 그리드 */}
          {images.length > 0 && (
            <div style={s.thumbGrid}>
              {files.map((f, i) => f.type.startsWith('image/') && (
                <ImageThumb key={i} file={f} onRemove={() => removeFile(i)} />
              ))}
            </div>
          )}

          {/* 문서 리스트 */}
          {docs.length > 0 && (
            <div style={{ marginTop: images.length ? 8 : 0 }}>
              {files.map((f, i) => !f.type.startsWith('image/') && (
                <div key={i} style={s.docItem}>
                  <span style={s.docIcon}>{fileIcon(f.type)}</span>
                  <span style={s.docName}>{f.name}</span>
                  <span style={s.docSize}>{formatSize(f.size)}</span>
                  <button style={s.docRemove} onClick={() => removeFile(i)}>✕</button>
                </div>
              ))}
            </div>
          )}

          {/* 파일 추가 버튼 */}
          <button
            style={s.addMoreBtn}
            onClick={() => inputRef.current?.click()}
          >
            + 파일 추가
          </button>
        </>
      ) : (
        /* 빈 상태 드롭존 */
        <div style={s.emptyZone} onClick={() => inputRef.current?.click()}>
          <div style={s.icon}>📎</div>
          <div style={s.mainText}>클릭하거나 파일을 드래그해서 올려주세요</div>
          <div style={s.subText}>이미지 · PDF · Excel · Word 등 여러 파일 가능</div>
          <div style={s.subText}>이미지는 <kbd style={s.kbd}>Ctrl</kbd> + <kbd style={s.kbd}>V</kbd> 붙여넣기도 지원</div>
        </div>
      )}
    </div>
  )
}

const s = {
  container: {
    border: '2px dashed #d0d0d0',
    borderRadius: 10,
    padding: 12,
    background: '#fafafa',
    transition: 'border-color 0.15s, background 0.15s',
  },
  containerDrag: {
    border: '2px dashed #667eea',
    background: '#f0f0ff',
  },
  emptyZone: {
    padding: '20px 12px',
    textAlign: 'center',
    cursor: 'pointer',
  },
  icon: { fontSize: 32, marginBottom: 8 },
  mainText: { fontSize: 14, color: '#555', marginBottom: 4 },
  subText: { fontSize: 12, color: '#aaa', marginBottom: 2 },
  kbd: {
    background: '#eee', border: '1px solid #ccc', borderRadius: 3,
    padding: '1px 5px', fontSize: 11, fontFamily: 'monospace',
  },
  thumbGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
    gap: 8,
    marginBottom: 4,
  },
  thumb: {
    position: 'relative',
    borderRadius: 8,
    overflow: 'hidden',
    border: '1.5px solid #e0e0e0',
    background: '#f5f5f5',
  },
  thumbImg: {
    width: '100%',
    height: 90,
    objectFit: 'cover',
    display: 'block',
  },
  thumbRemove: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: 'rgba(0,0,0,0.55)',
    color: '#fff',
    border: 'none',
    fontSize: 11,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbName: {
    fontSize: 10,
    color: '#666',
    padding: '4px 6px',
    background: '#fff',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  docItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    background: '#f8f8ff',
    borderRadius: 8,
    marginBottom: 6,
    border: '1.5px solid #e8e8ff',
  },
  docIcon: { fontSize: 20, flexShrink: 0 },
  docName: {
    fontSize: 13,
    color: '#333',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    minWidth: 0,
  },
  docSize: { fontSize: 11, color: '#aaa', whiteSpace: 'nowrap', flexShrink: 0 },
  docRemove: {
    background: 'none',
    border: '1px solid #ddd',
    color: '#aaa',
    borderRadius: 4,
    padding: '2px 8px',
    fontSize: 11,
    cursor: 'pointer',
    flexShrink: 0,
  },
  addMoreBtn: {
    marginTop: 10,
    width: '100%',
    padding: '8px 0',
    border: '1.5px dashed #c0c8ff',
    borderRadius: 8,
    background: 'transparent',
    color: '#667eea',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
}
