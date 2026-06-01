export function readFileAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result.split(',')[1])
    reader.readAsDataURL(file)
  })
}

export function readFileWithMeta(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const [meta, data] = e.target.result.split(',')
      resolve({ data, type: meta.match(/:(.*?);/)[1] })
    }
    reader.readAsDataURL(file)
  })
}
