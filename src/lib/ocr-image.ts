/** Resize on-device; neither the original image nor a thumbnail is persisted. */
export async function compressOcrImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件。');
  if (file.size > 25 * 1024 * 1024) throw new Error('原图超过 25MB，请裁剪或选择较小的图片。');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('无法读取这张图片，请改用 JPG、PNG 或截图。')); image.src = url; });
    const scale = Math.min(1, 1200 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('浏览器暂不支持图片压缩，请更换浏览器。');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally { URL.revokeObjectURL(url); }
}

export function ocrSentence(text: string, offset: number): string {
  const before = text.slice(0, offset);
  const start = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n')) + 1;
  const rest = text.slice(offset);
  const end = rest.search(/[.!?\n]/);
  return text.slice(start, end < 0 ? text.length : offset + end + 1).trim().slice(0, 2500);
}
