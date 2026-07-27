/**
 * Safely sets an item in localStorage, automatically handling QuotaExceededError,
 * clearing old passage analysis caches, and pruning old history items if needed.
 */
export function safeSetLocalStorage(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err: any) {
    console.warn(`[LocalStorage QuotaExceeded] Failed to save key: ${key}. Attempting auto-cleanup...`, err);

    // 1. Remove old temporary or passage analysis caches to free up storage
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('eng_passage_analysis_') || k.startsWith('eng_temp_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch (cleanErr) {
      console.error("Cleanup of old passage analysis keys failed:", cleanErr);
    }

    // 2. Retry setItem after clearing passage analysis cache
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (retryErr) {
      // 3. If history key itself is overflowing 5MB quota, prune older history items (keep latest 20)
      if (key === 'eng_reading_lessons_history') {
        try {
          const history = JSON.parse(value);
          if (Array.isArray(history) && history.length > 20) {
            const pruned = history.slice(0, 20);
            localStorage.setItem(key, JSON.stringify(pruned));
            console.log(`[LocalStorage QuotaExceeded] History pruned to latest 20 items to stay within quota.`);
            return true;
          }
        } catch (pruneErr) {
          console.error("Failed to prune history:", pruneErr);
        }
      }
      console.error(`[LocalStorage QuotaExceeded] Final fallback failed for key: ${key}`);
      return false;
    }
  }
}
