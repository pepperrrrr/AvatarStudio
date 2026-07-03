export function downloadBlob(
  data: Blob | ArrayBuffer | ArrayBufferView | string,
  filename: string,
  mime = 'application/octet-stream',
) {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
