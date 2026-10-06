import { confirmDestructive } from './confirmDestructive';

/** Confirm before leaving an active match (web-safe). */
export async function confirmLeaveMatch(
  inProgress: boolean,
  title = 'Уйти из матча?',
  message = 'Партнёр перейдёт в соло (если online). Твой прогресс раунда здесь пропадёт.',
): Promise<boolean> {
  if (!inProgress) return true;
  return confirmDestructive(title, message);
}
