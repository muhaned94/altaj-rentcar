# Al-Taj Car Rental Platform

<div align="center">
  <h3>👑 Premium Luxury Car Rental Service</h3>
  <p><strong>شركة التاج لتأجير السيارات</strong></p>
</div>

## 🌟 Features

- **Responsive Design**: Mobile-first approach with optimized layouts for phones, tablets, and desktops
- **Luxury UI/UX**: Premium gold and black theme with glassmorphism effects
- **Multi-language Support**: English and Arabic (with proper fonts)
- **Car Management**: Full CRUD operations for managing vehicle inventory
- **Booking System**: "Pay on Delivery" model with booking status tracking
- **Admin Dashboard**: Comprehensive admin panel with responsive sidebar
- **Image Upload**: Direct integration with Supabase Storage
- **Real-time Data**: Powered by Supabase PostgreSQL database

## 🛠️ Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Custom luxury theme
- **UI Components**: Shadcn/UI
- **Icons**: Lucide React
- **Backend**: Supabase (PostgreSQL + Storage + Auth)
- **Fonts**: Inter (English) + Cairo (Arabic)

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account
- Modern web browser

## 🚀 Getting Started

### 1. Clone and Install

```bash
cd "Car Retnal"
npm install
```

### 2. Supabase Setup

Follow the detailed guide in [`database/README.md`](database/README.md) to:
- Create Supabase project
- Run database schema
- Create storage bucket
- Set up policies

### 3. Environment Variables

Create `.env.local` and add your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

```
car-rental/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Homepage
│   ├── layout.tsx         # Root layout
│   ├── globals.css        # Global styles
│   ├── cars/              # Car listing & details
│   ├── book/              # Booking pages
│   ├── admin/             # Admin dashboard
│   └── api/               # API routes
├── components/            # React components
│   ├── navbar.tsx         # Responsive navbar
│   ├── footer.tsx         # Footer component
│   ├── car-card.tsx       # Car display card
│   └── ui/                # Shadcn components
├── lib/                   # Utilities
│   ├── supabase.ts        # Supabase client
│   ├── types.ts           # TypeScript types
│   └── utils.ts           # Helper functions
├── database/              # Database files
│   ├── schema.sql         # SQL schema
│   └── README.md          # Setup guide
└── public/                # Static assets
```

## 🎨 Responsive Breakpoints

The application uses mobile-first design with the following breakpoints:

- **Mobile**: `< 640px` (1 column grid)
- **Tablet**: `640px - 1024px` (2 column grid)
- **Desktop**: `> 1024px` (3-4 column grid)

## 🎨 Color Palette

- **Gold**: `#D4AF37` - Primary accent color
- **Deep Black**: `#0A0A0A` - Background
- **Elegant White**: `#F8F8F8` - Text
- **Luxury Gray**: `#1F1F1F` - Secondary backgrounds

## 📊 Database Schema

### Tables

1. **categories**: Vehicle categories (Luxury, SUV, Sedan, etc.)
2. **cars**: Vehicle inventory with images and specifications
3. **bookings**: Customer bookings with status tracking

### Storage

- **car-images**: Public bucket for vehicle photos

## 🔐 Security Notes

- Row Level Security (RLS) enabled on all tables
- Public read access for cars and categories
- Public insert for bookings (customer forms)
- Admin operations should use authenticated routes (to be implemented)

## 🚧 Roadmap

- [ ] Admin authentication
- [ ] Real-time availability checking
- [ ] Email notifications
- [ ] PDF invoice generation
- [ ] Multi-language switcher (i18n)
- [ ] Advanced search filters
- [ ] Car comparison feature

## 📝 License

ISC

## 👥 Support

For issues or questions, please contact Al-Taj Company support.

---

<div align="center">
  <p>Built with ❤️ for Al-Taj Company</p>
  <p><strong>Experience luxury, drive in style</strong></p>
</div>
