# 📊 Stockify — Stock Portfolio Manager

[![Live Demo](https://img.shields.io/badge/Live-Demo-00C851?style=flat&logo=vercel&logoColor=white)](https://stockify-brown.vercel.app/)
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)]()
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat&logo=supabase&logoColor=white)]()

**Live site:** https://stockify-brown.vercel.app/

A stock portfolio management SaaS application that lets you track, analyze, and manage your stock investments in real time.

## 📸 Screenshots

![Stockify Dashboard](https://image.thum.io/get/width/1280/crop/800/https://stockify-brown.vercel.app/)

## ✨ Features

- 📈 **Portfolio tracking** — Monitor your stock holdings and P&L in real time
- 💰 **Price refresh** — Live portfolio price updates
- 👥 **Partner management** — Share and manage portfolios with collaborators
- 🔐 **Secure** — Row-level security with Supabase RLS policies
- 📋 **Database schema** — Well-structured Supabase/Postgres schema

## 🧠 Tech Stack

| Technology | Purpose |
|---|---|
| **Next.js** | App Router, React Server Components |
| **TypeScript** | Type safety |
| **Supabase** | Database, Auth, RLS |
| **Tailwind CSS** | Styling |
| **Vercel** | Deployment |

## 🚀 Getting Started

1. Clone the repo
2. Install dependencies:
```bash
npm install
```
3. Set up environment variables:
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```
4. Run migrations from `/supabase` folder
5. Start dev server:
```bash
npm run dev
```
