import localFont from 'next/font/local'

// Vendored latin files. next/font/google downloads CSS at build time, and
// Google sometimes returns extensionless /l/font URLs that crash the build.
// Paths stay inline so the font loader can see them statically.

export const siteInter = localFont({
  src: './inter-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--font-inter',
})

export const aibInter = localFont({
  src: './inter-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--aib-inter',
})

export const aigInter = localFont({
  src: './inter-latin.woff2',
  weight: '100 900',
  style: 'normal',
  display: 'swap',
  variable: '--aig-inter',
})

export const aibPoppins = localFont({
  src: [
    { path: './poppins-latin-500.woff2', weight: '500', style: 'normal' },
    { path: './poppins-latin-600.woff2', weight: '600', style: 'normal' },
    { path: './poppins-latin-700.woff2', weight: '700', style: 'normal' },
    { path: './poppins-latin-800.woff2', weight: '800', style: 'normal' },
    { path: './poppins-latin-900.woff2', weight: '900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--aib-poppins',
})

export const aigPoppins = localFont({
  src: [
    { path: './poppins-latin-500.woff2', weight: '500', style: 'normal' },
    { path: './poppins-latin-600.woff2', weight: '600', style: 'normal' },
    { path: './poppins-latin-700.woff2', weight: '700', style: 'normal' },
    { path: './poppins-latin-800.woff2', weight: '800', style: 'normal' },
    { path: './poppins-latin-900.woff2', weight: '900', style: 'normal' },
  ],
  display: 'swap',
  variable: '--aig-poppins',
})
