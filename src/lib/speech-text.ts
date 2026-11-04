/** Keep spoken English and punctuation; omit emoji, Markdown decoration and URLs. */
export function speechText(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[—–]/g, ', ')
    .replace(/[^A-Za-z0-9\s.,!?;:'"()\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
