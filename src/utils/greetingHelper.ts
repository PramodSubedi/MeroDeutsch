/**
 * German Greeting Helper Component
 * Provides time-based greetings in German and English for guest and logged-in users.
 * Integrates with user streak data for motivational messages.
 */
export function getSimpleGermanGreeting(userName?: string | null, streak: number = 0) {
  const hour = new Date().getHours();

  if (!userName) {
    return {
      title: "Willkommen! 🇩🇪",
      subtitle: "Lerne heute deine ersten deutschen Wörter."
    };
  }

  let title = "Hallo";
  let subtitle = "Du machst das super!";

  if (hour >= 5 && hour < 12) {
    title = `Guten Morgen, ${userName}! ☕`;
    subtitle = "Ein neuer Tag, ein neues Wort.";
  } else if (hour >= 12 && hour < 18) {
    title = `Guten Tag, ${userName}! 🎯`;
    subtitle = "Zeit für eine kleine Lernpause.";
  } else if (hour >= 18 && hour < 22) {
    title = `Guten Abend, ${userName}! 🚀`;
    subtitle = "Super gemacht heute!";
  } else {
    title = `Hallo, Nachteule ${userName}! 🦉`;
    subtitle = "Spät unterwegs? Weiter so!";
  }

  if (streak > 0) {
    subtitle = `🔥 ${streak} Tage in Folge! ${subtitle}`;
  }

  return { title, subtitle };
}

/**
 * Get welcome message for guest users
 */
export function getGuestWelcomeMessage(): { english: string; german: string } {
  return {
    english: "Willkommen bei MeroDeutsch! 🇩🇪 Bereit zum Lernen?",
    german: "Willkommen bei MeroDeutsch! 🇩🇪 Bereit zum Lernen?"
  };
};

/**
 * Get welcome message for logged-in users
 */
export function getLoggedInWelcomeMessage(
  userName: string,
  streak: number,
  wordsToday: number
): { english: string; german: string } {
  const hour = new Date().getHours();

  let period: 'morning' | 'afternoon' | 'evening' | 'night';
  if (hour >= 5 && hour < 12) period = 'morning';
  else if (hour >= 12 && hour < 18) period = 'afternoon';
  else if (hour >= 18 && hour < 22) period = 'evening';
  else period = 'night';

  const timeMap: Record<'morning' | 'afternoon' | 'evening' | 'night', { english: string; german: string }> = {
    morning: { english: "Good morning!", german: "Guten Morgen!" },
    afternoon: { english: "Good afternoon!", german: "Guten Tag!" },
    evening: { english: "Good evening!", german: "Guten Abend!" },
    night: { english: "Hello!", german: "Hallo!" }
  };

  const englishPart = timeMap[period].english;
  const germanPart = timeMap[period].german;

  const english = englishPart + ` Welcome back, ${userName}! You've reviewed ${wordsToday} words today. Keep going! 💪`;
  const german = germanPart + ` Willkommen zurück, ${userName}! Heute ${wordsToday} Wörter wiederholt. Weit so gut! 💪`;

  return { english, german };
}