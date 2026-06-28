import { useCallback, useEffect, useMemo, useState } from 'react';
import { flashcardsData } from './flashcardsData';

const STORAGE_KEY = 'flashcards-progress-v1';

// Persisted shape: { index, statuses: { [cardFront]: 'known' | 'review' } }
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      index: Number.isInteger(parsed.index) ? parsed.index : 0,
      statuses: parsed.statuses && typeof parsed.statuses === 'object' ? parsed.statuses : {},
    };
  } catch {
    return null;
  }
}

function Flashcards() {
  const cards = flashcardsData.cards;
  const total = cards.length;

  const initial = useMemo(() => loadProgress() || { index: 0, statuses: {} }, []);

  const [index, setIndex] = useState(() => Math.min(initial.index, total - 1));
  const [statuses, setStatuses] = useState(initial.statuses);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ index, statuses }));
    } catch {
      /* storage unavailable / full – ignore */
    }
  }, [index, statuses]);

  const goTo = useCallback(
    (next) => {
      setIndex((current) => {
        const clamped = Math.max(0, Math.min(next, total - 1));
        if (clamped !== current) setFlipped(false);
        return clamped;
      });
    },
    [total],
  );

  const prev = useCallback(() => goTo(index - 1), [goTo, index]);
  const next = useCallback(() => goTo(index + 1), [goTo, index]);

  const setStatus = useCallback(
    (status) => {
      setStatuses((current) => {
        const card = cards[index];
        const updated = { ...current };
        if (current[card.front] === status) {
          delete updated[card.front];
        } else {
          updated[card.front] = status;
        }
        return updated;
      });
    },
    [cards, index],
  );

  const resetAll = useCallback(() => {
    setStatuses({});
    setIndex(0);
    setFlipped(false);
  }, []);

  const knownCount = useMemo(
    () => cards.filter((card) => statuses[card.front] === 'known').length,
    [cards, statuses],
  );
  const reviewCount = useMemo(
    () => cards.filter((card) => statuses[card.front] === 'review').length,
    [cards, statuses],
  );

  // Keyboard shortcuts: ← / → to navigate, space/enter to flip.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowLeft') prev();
      else if (event.key === 'ArrowRight') next();
      else if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        setFlipped((value) => !value);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [prev, next]);

  const card = cards[index];
  const currentStatus = statuses[card.front];
  const seenCount = knownCount + reviewCount;

  return (
    <div className="flashcards">
      <div className="flashcards-toolbar">
        <div className="flashcards-stats">
          <span>
            Card <strong>{index + 1}</strong> / {total}
          </span>
          <span className="fc-progress-pills">
            <span className="fc-pill known">Știu: {knownCount}</span>
            <span className="fc-pill review">De repetat: {reviewCount}</span>
          </span>
        </div>
        <button type="button" className="fc-reset-btn" onClick={resetAll}>
          Resetează progresul
        </button>
      </div>

      <div className="fc-progress-bar">
        <div className="fc-progress-fill" style={{ width: `${total ? (seenCount / total) * 100 : 0}%` }} />
      </div>

      <button
        type="button"
        className={`flashcard ${flipped ? 'flipped' : ''} ${currentStatus ? `status-${currentStatus}` : ''}`}
        onClick={() => setFlipped((value) => !value)}
        aria-label="Întoarce cardul"
      >
        <div className="flashcard-inner">
          <div className="flashcard-face flashcard-front">
            <span className="flashcard-label">Subiect</span>
            <p className="flashcard-text">{card.front}</p>
            <span className="flashcard-hint">Apasă pentru răspuns</span>
          </div>
          <div className="flashcard-face flashcard-back">
            <span className="flashcard-label">Răspuns</span>
            <p className="flashcard-text">{card.back}</p>
          </div>
        </div>
      </button>

      <div className="fc-mark-actions">
        <button
          type="button"
          className={`fc-mark-btn review ${currentStatus === 'review' ? 'active' : ''}`}
          onClick={() => setStatus('review')}
        >
          De repetat
        </button>
        <button
          type="button"
          className={`fc-mark-btn known ${currentStatus === 'known' ? 'active' : ''}`}
          onClick={() => setStatus('known')}
        >
          Știu
        </button>
      </div>

      <div className="fc-nav">
        <button type="button" className="fc-nav-btn" onClick={prev} disabled={index === 0}>
          ← Înapoi
        </button>
        <button type="button" className="fc-nav-btn primary" onClick={next} disabled={index === total - 1}>
          Înainte →
        </button>
      </div>
    </div>
  );
}

export default Flashcards;
