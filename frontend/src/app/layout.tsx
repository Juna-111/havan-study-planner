import type{Metadata,Viewport}from'next';import{DM_Sans,Fraunces}from'next/font/google';import'../styles/tokens.css';import'../styles/base.css';import'../styles/utilities.css';const
dm=DM_Sans({subsets:['latin'],display:'swap',variable:'--font-dm-sans',weight:['400','500','700']});const fr=Fraunces({subsets:['latin'],display:'swap',variable:'--font-fraunces',weight:['600']});export const metadata:Metadata={title:'Havan',description:'Academic planning for
Ethiopian university freshman students.'};export const viewport:Viewport={width:'device-width',initialScale:1,viewportFit:'cover'};export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={`${dm.variable}
${fr.variable}`}>{children}</body></html>}
