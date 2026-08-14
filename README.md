# Mero Deutsch

**Mero Deutsch** is a modern German language learning application built with React, TypeScript, and Vite. Help users learn German vocabulary, grammar, and phrases through interactive lessons, spaced repetition, and engaging quizzes.

## 📱 Features

- **Interactive Lessons** - Learn German alphabets, numbers, and common phrases
- **Spaced Repetition** - Review system to help memorize vocabulary long-term
- **Progress Tracking** - Monitor your learning journey and streaks
- **Achievement System** - Earn badges as you progress
- **Review Queue** - Focus on words you need to practice most
- **PWA Support** - Install the app on your device for offline learning
- **User Authentication** - Secure sign up and login with Supabase

## 🛠️ Tech Stack

- **Frontend**: React 19, TypeScript, Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Routing**: React Router DOM
- **State Management**: React Context, TanStack Query
- **UI Components**: Lucide React, Recharts
- **Animations**: Canvas Confetti
- **Linting**: Oxlint

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:5173
```

## 📦 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with HMR |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run Oxlint for code quality |

## 🏗️ Project Structure

```
src/
├── components/     # Reusable UI components
├── pages/          # Page components
├── context/        # React context providers
├── hooks/          # Custom React hooks
├── lib/            # Utility functions and helpers
├── services/       # API services (Supabase)
├── types/          # TypeScript type definitions
├── config/         # Application configuration
└── data/           # Static data and vocabulary
```

## 🌐 Deployment

This project is designed for easy deployment on **Vercel**:

1. Push code to GitHub
2. Import repository at [vercel.com/new](https://vercel.com/new)
3. Framework: Vite, Build Command: `npm run build`, Output Directory: `dist`
4. Add environment variables in Vercel Dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

See [DEPLOY.md](./DEPLOY.md) for detailed deployment instructions.

## 📦 Environment Variables

Create a `.env` file (see `.gitignore` for excluded files):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 🎯 Core Features

- **Alphabet Module** - Learn German letters and pronunciation
- **Numbers Module** - Practice numbers 0-1000+
- **Lesson System** - Structured learning paths
- **Review Queue** - Spaced repetition for long-term retention
- **User Progress** - Track learning streaks and achievements
- **Multi-user Support** - Each user has isolated progress

## 🛡️ Security & Best Practices

- `.env` files are gitignored for security
- Row Level Security (RLS) policies on Supabase tables
- Supabase anon key is public (not service key)
- Rate limiting configured in Supabase Auth
- No sensitive data stored in client code

## 📚 Related Documentation

- [DEPLOY.md](./DEPLOY.md) - Complete deployment guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture details
- [TASKS.md](./TASKS.md) - Project tasks and progress

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin main`)
5. Open a Pull Request

## 👤 Author

**Pramod Subedi** - [GitHub](https://github.com/PramodSubedi)

## 🙏 Acknowledgments

- Inspiration from various language learning apps
- Built with the React and Vite community tools
- Database design inspired by educational best practices

---

**Mero Deutsch** - Learn German, one word at a time! 🇩🇪