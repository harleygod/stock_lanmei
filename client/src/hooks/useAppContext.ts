import { useOutletContext } from 'react-router-dom';
import type { AppContext } from '../App';

export function useAppContext(): AppContext {
  return useOutletContext<AppContext>();
}
