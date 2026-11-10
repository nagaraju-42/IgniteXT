/**
 * Web study bookmarks & reading history persistence in browser localStorage.
 */

export interface WebBookmark {
  id: string;
  fileUrl: string;
  title: string;
  subjectId: string;
  subjectName: string;
  shortCode: string;
  type: 'note' | 'pyq';
  unitNumber?: number | null;
  fileSizeKb?: number | null;
  savedAt: number;
}

const BOOKMARKS_KEY = 'semkit_web_bookmarks';
const HISTORY_KEY = 'semkit_web_history';

/** Returns all bookmarked materials for online revision. */
export function getWebBookmarks(): WebBookmark[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(BOOKMARKS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Checks if a given fileUrl is currently bookmarked. */
export function isBookmarked(fileUrl: string): boolean {
  if (!fileUrl) return false;
  return getWebBookmarks().some((b) => b.fileUrl === fileUrl);
}

/** Toggles bookmark status and notifies listeners. Returns the new bookmarked state. */
export function toggleWebBookmark(item: Omit<WebBookmark, 'savedAt'>): boolean {
  if (typeof window === 'undefined') return false;
  const list = getWebBookmarks();
  const existsIdx = list.findIndex((b) => b.fileUrl === item.fileUrl);
  let nextState: boolean;
  if (existsIdx >= 0) {
    list.splice(existsIdx, 1);
    nextState = false;
  } else {
    list.unshift({ ...item, savedAt: Date.now() });
    nextState = true;
  }
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(list));
  window.dispatchEvent(new Event('semkit_web_bookmarks_changed'));
  return nextState;
}

/** Records a recently viewed document for quick access in Bookmarks & History. */
export function recordWebHistory(item: {
  fileUrl: string;
  title: string;
  subjectId?: string;
  subjectName?: string;
  page?: number;
  total?: number;
}): void {
  if (typeof window === 'undefined' || !item.fileUrl) return;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const list: any[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter((h) => h.fileUrl !== item.fileUrl);
    filtered.unshift({ ...item, visitedAt: Date.now() });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, 25)));
  } catch {
    // Ignore storage quota errors
  }
}

/** Returns recent reading history on Web. */
export function getWebHistory(): Array<{
  fileUrl: string;
  title: string;
  subjectId?: string;
  subjectName?: string;
  page?: number;
  total?: number;
  visitedAt: number;
}> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
