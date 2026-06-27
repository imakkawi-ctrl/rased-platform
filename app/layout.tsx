import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ر��صد — منصة تحليل النةائج المدرسية',
  description: 'منصة تحليل النتائج المدرسية للمدارس',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
