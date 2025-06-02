# The Daily Virals - Next.js Frontend

A TikTok content discovery app built with Next.js, Tailwind CSS, and Supabase.

## Features

- 🎥 Video content discovery with thumbnails
- 🔍 Advanced filtering (date, product, posting time, ad type, gender, sorting)
- 📱 Responsive design with mobile-first approach
- 🎨 Dark theme with custom styling
- 🗃️ Supabase integration for data management
- ⚡ Server-side rendering with Next.js

## Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Supabase:**
   - Copy your Supabase URL and anon key from your Supabase project settings
   - Update the `.env.local` file with your actual values:
     ```
     NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
     NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
     ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/
├── app/
│   ├── globals.css      # Global styles and Tailwind imports
│   ├── layout.tsx       # Root layout component
│   └── page.tsx         # Main page component
├── hooks/
│   └── useVideos.ts     # Custom hook for fetching videos
└── lib/
    └── supabaseClient.ts # Supabase client configuration
```

## Database Schema

The app expects a `shop_videos` table in Supabase with the following columns:
- `aweme_id` (string, primary key)
- `username`, `caption`, `video_url`, etc.
- `thumbnail_url` for video thumbnails
- `product_image`, `product_name`, `price` for product information
- `likes`, `comments`, `shares`, `views` for engagement metrics

## Technologies Used

- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first CSS framework
- **Headless UI** - Unstyled, accessible UI components
- **Heroicons** - Beautiful hand-crafted SVG icons
- **React DatePicker** - Date selection component
- **Supabase** - Backend as a Service

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## Customization

### Colors
The app uses a custom dark theme defined in `tailwind.config.js`:
- `pageBg`: Main background color
- `cardBg`: Card background color
- `primary`: Primary text color
- `secondary`: Secondary text color
- `accent`: Accent color (orange)
- `borderColor`: Border color

### Filters
You can customize the filtering options by modifying the `FilterValues` interface and the filter components in `page.tsx`.
