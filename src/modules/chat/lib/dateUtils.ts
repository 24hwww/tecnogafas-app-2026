// ============================================================================
// DATE UTILS - Formateo de fechas para chat
// ============================================================================

/**
 * Formatea una fecha relativa tipo "hace 2 minutos"
 */
export function formatDistanceToNow(date: string | Date): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 10) return 'ahora';
  if (diffInSeconds < 60) return `hace ${diffInSeconds}s`;
  
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `hace ${diffInMinutes}m`;
  
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `hace ${diffInHours}h`;
  
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `hace ${diffInDays}d`;
  
  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) return `hace ${diffInWeeks}sem`;
  
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `hace ${diffInMonths}m`;
  
  const diffInYears = Math.floor(diffInDays / 365);
  return `hace ${diffInYears}a`;
}

/**
 * Formatea una fecha absoluta
 */
export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formatea una hora
 */
export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formatea fecha completa para separadores
 */
export function formatDateSeparator(date: string | Date): string {
  const d = new Date(date);
  const now = new Date();
  
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return 'Hoy';
  
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return 'Ayer';
  
  return d.toLocaleDateString('es-ES', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/**
 * Agrupa mensajes por fecha
 */
export function groupMessagesByDate<T extends { created_at: string }>(
  messages: T[]
): Array<{ date: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  
  for (const message of messages) {
    const date = new Date(message.created_at).toDateString();
    if (!groups.has(date)) {
      groups.set(date, []);
    }
    groups.get(date)!.push(message);
  }
  
  return Array.from(groups.entries()).map(([date, items]) => ({
    date: formatDateSeparator(date),
    items,
  }));
}
