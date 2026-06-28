import { useState } from 'react';
import './App.css';
import QuizApp from './QuizApp';
import Flashcards from './Flashcards';
import { questions as rawQuiz } from './questions';
import { flashcardsData } from './flashcardsData';

const CATEGORIES = [
  {
    id: 'quiz',
    title: 'Chestionar grilă',
    description: 'Întrebări cu variante de răspuns, cu feedback și scor.',
    meta: `${rawQuiz.questions.length} întrebări`,
    accent: '#9de1f6',
  },
  {
    id: 'flashcards',
    title: 'Subiecte proba practică',
    description: 'Flashcard-uri: subiectul pe față, răspunsul pe verso.',
    meta: `${flashcardsData.cards.length} subiecte`,
    accent: '#bfe6c4',
  },
];

function App() {
  const [category, setCategory] = useState(null);

  if (!category) {
    return (
      <div className="home">
        <header className="home-header">
          <h1>Lucrător calificat în culturi de câmp și legumicultură</h1>
          <p>Alege modul de învățare</p>
        </header>
        <div className="category-grid">
          {CATEGORIES.map((item) => (
            <button
              key={item.id}
              type="button"
              className="category-card"
              style={{ '--accent': item.accent }}
              onClick={() => setCategory(item.id)}
            >
              <span className="category-title">{item.title}</span>
              <span className="category-desc">{item.description}</span>
              <span className="category-meta">{item.meta}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const activeTitle = CATEGORIES.find((item) => item.id === category)?.title;

  return (
    <div className="category-view">
      <div className="category-topbar">
        <button type="button" className="back-btn" onClick={() => setCategory(null)}>
          ← Meniu
        </button>
        <span className="category-view-title">{activeTitle}</span>
      </div>
      {category === 'quiz' ? <QuizApp /> : <Flashcards />}
    </div>
  );
}

export default App;
