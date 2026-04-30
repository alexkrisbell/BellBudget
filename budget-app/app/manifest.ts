import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Bell Bucks',
    short_name: 'Bell Bucks',
    description: 'Household budgeting dashboard',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/Icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        // "any" is required by Chrome on Android; without it the icon is ignored
        purpose: 'any',
      },
      {
        src: '/Icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
