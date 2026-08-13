/**
 * Haptic feedback utility for native-feeling mobile PWA interactions
 * Provides tactile feedback for button taps, success, and error states
 */

export type HapticType = 'light' | 'success' | 'error';

/**
 * Triggers haptic feedback on supported devices
 * @param type - The type of haptic feedback to trigger
 */
export const triggerHaptic = (type: HapticType = 'light'): void => {
  // Feature detection for vibration API
  if (typeof window === 'undefined' || !('vibrate' in navigator)) {
    return;
  }

  try {
    switch (type) {
      case 'success':
        // Short, satisfying tap for correct answers
        navigator.vibrate(20);
        break;
      case 'error':
        // Double pulse for errors or incorrect answers
        navigator.vibrate([40, 30, 40]);
        break;
      case 'light':
      default:
        // Subtle tap for general interactions
        navigator.vibrate(10);
        break;
    }
  } catch (error) {
    // Silently fail on unsupported browsers
    console.debug('Haptic feedback not supported:', error);
  }
};
