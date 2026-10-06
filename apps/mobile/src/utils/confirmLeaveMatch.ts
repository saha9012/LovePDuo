import { confirmDestructive } from './confirmDestructive';

/** Confirm before leaving an active match (web-safe). */
export async function confirmLeaveMatch(
  inProgress: boolean,
  opts?: { soloDemo?: boolean },
): Promise<boolean> {
  if (!inProgress) return true;
  const solo = opts?.soloDemo === true;
  return confirmDestructive(
    'Уйти из матча?',
    solo
      ? 'Solo demo — leaveMatch партнёру не уйдёт. Прогресс раунда здесь пропадёт.'
      : 'Если партнёр в WS 2/2 — он перейдёт в соло. Твой прогресс раунда здесь пропадёт.',
  );
}
