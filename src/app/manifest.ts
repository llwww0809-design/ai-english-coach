import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return { name: 'AI English Coach', short_name: 'AI Coach', description: '每天一点，更自信地说英语', start_url: '/', display: 'standalone', orientation: 'portrait', background_color: '#f5f6f1', theme_color: '#566e51', icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }, { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' }] };
}
