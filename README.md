# fal-ui

A clean, modern interface for generating images and videos with FAL AI models. Built for privacy and local-first workflow - no accounts, no databases.

## What is fal-ui?

fal-ui is a web application that lets you:

- **Generate AI images and videos** using 100+ FAL AI models
- **Browse and experiment** with different models and parameters
- **Manage your creations** in a local gallery
- **Keep everything private** - all data stays in your browser

Perfect for artists, designers, developers, and anyone who wants to explore AI generation without compromising privacy.

## Features

- **Local-first** - All data stored in your browser's localStorage
- **No registration** - Just bring your FAL API key and start creating
- **Privacy-focused** - Your API key and generations never leave your device
- **Full model library** - Access to all available FAL AI models
- **Responsive design** - Works seamlessly on desktop and mobile
- **Modern UI** - Clean interface built with shadcn/ui components

## Quick Start

```bash
pnpm install
pnpm dev
```

1. Open [localhost:3000](http://localhost:3000)
2. Get your [FAL API key](https://fal.ai/dashboard/keys)
3. Add it to the app (stored locally)
4. Choose a model and start generating!

## How it Works

1. **Browse Models** - Explore image and video generation models
2. **Configure Parameters** - Adjust settings like prompts, dimensions, and style
3. **Generate** - Watch your creation come to life
4. **Save & Organize** - Everything is automatically saved to your local gallery

## Tech Stack

- **Next.js 15** with React 19 and App Router
- **TypeScript** for type safety
- **Tailwind CSS v4** for styling
- **shadcn/ui** + Radix UI for components
- **FAL AI Client** for model integration

---

Built with ♥️ for creators who value privacy
