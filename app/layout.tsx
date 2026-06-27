import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'راصد — منصة تحليل النتائج المدرسية',
  description: 'منصة تحليل النتائج المدرسية للمدارس',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
