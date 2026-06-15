import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notea.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/help', '/terms', '/privacy', '/tokushoho'],
      disallow: ['/pages/', '/settings/', '/trash/', '/login', '/register', '/password-reset', '/api/'],
    },
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
