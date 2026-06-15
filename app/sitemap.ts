import type { MetadataRoute } from 'next'
import { ROUTES } from '@/lib/constants/routes'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://notea.app'

export default function sitemap(): MetadataRoute.Sitemap {
  // 公開ページのみ sitemap に含める。ユーザーの個別ページは含めない
  return [
    {
      url: APP_URL + ROUTES.HOME,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: APP_URL + ROUTES.HELP,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: APP_URL + ROUTES.TERMS,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: APP_URL + ROUTES.PRIVACY,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: APP_URL + ROUTES.TOKUSHOHO,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
