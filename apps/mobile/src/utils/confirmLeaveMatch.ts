import { confirmDestructive } from './confirmDestructive';

/** Confirm before leaving an active match (web-safe). */
export async function confirmLeaveMatch(
  inProgress: boolean,
  title = 'Уйти из матча?',
  message = 'Партнёр останется один. Прогресс раунда потеряется у тебя.',
): Promise<boolean> {
  if (!inProgress) return true;
  return confirmDestructive(title, message);
}
