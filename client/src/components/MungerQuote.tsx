import { useMemo } from 'react';
import { randomQuote } from '../utils/quotes';

export default function MungerQuote() {
  const quote = useMemo(() => randomQuote(), []);

  return (
    <blockquote className="border-l-4 border-blue-500 pl-3 text-sm text-muted italic">
      {quote}
    </blockquote>
  );
}
