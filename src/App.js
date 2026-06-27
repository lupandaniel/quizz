import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import Quiz from 'react-quiz-component';
import { questions as rawQuiz } from './questions';

const STORAGE_KEY = 'quiz-progress-v1';

// react-quiz-component expects `correctAnswer` to be a (1-based) string for
// single-selection questions. This data set stores it as an array (e.g. [1]),
// which breaks scoring + instant feedback. Normalize it here without touching
// the large data file.
function normalizeQuestions(questionList) {
  return questionList.map((question) => {
    const type = question.answerSelectionType || 'single';
    if (type === 'single' && Array.isArray(question.correctAnswer)) {
      return { ...question, correctAnswer: String(question.correctAnswer[0]) };
    }
    return question;
  });
}

function isAnswerCorrect(question, userAnswer) {
  const type = question.answerSelectionType || 'single';

  if (type === 'single') {
    if (userAnswer === undefined || userAnswer === null) return false;
    const correct = Array.isArray(question.correctAnswer)
      ? Number(question.correctAnswer[0])
      : Number(question.correctAnswer);
    return Number(userAnswer) === correct;
  }

  const correct = (question.correctAnswer || []).map(Number).sort((a, b) => a - b);
  const given = Array.isArray(userAnswer) ? userAnswer.map(Number).sort((a, b) => a - b) : [];
  return correct.length === given.length && correct.every((value, index) => value === given[index]);
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.activeKeys)) return null;
    return {
      activeKeys: parsed.activeKeys,
      answered: parsed.answered && typeof parsed.answered === 'object' ? parsed.answered : {},
    };
  } catch {
    return null;
  }
}

function saveProgress(activeKeys, answered) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeKeys, answered }));
  } catch {
    /* storage unavailable / full – ignore */
  }
}

// Questions still to ask in the current run = active universe minus the ones
// already answered (in this or a previous, persisted session).
function computeRunQuestions(fullQuestions, activeKeys, answered) {
  const keySet = new Set(activeKeys);
  return fullQuestions.filter(
    (question) => keySet.has(question.question) && !(question.question in answered),
  );
}

function App() {
  const fullQuestions = useMemo(() => normalizeQuestions(rawQuiz.questions), []);

  const initial = useMemo(() => {
    const saved = loadProgress();
    if (saved) {
      const keySet = new Set(saved.activeKeys);
      const known = fullQuestions.some((question) => keySet.has(question.question));
      if (known) {
        return { activeKeys: saved.activeKeys, answered: saved.answered };
      }
    }
    return { activeKeys: fullQuestions.map((question) => question.question), answered: {} };
  }, [fullQuestions]);

  const [activeKeys, setActiveKeys] = useState(initial.activeKeys);
  const [answered, setAnswered] = useState(initial.answered);
  const [runQuestions, setRunQuestions] = useState(() =>
    computeRunQuestions(fullQuestions, initial.activeKeys, initial.answered),
  );
  const [runId, setRunId] = useState(0);

  useEffect(() => {
    saveProgress(activeKeys, answered);
  }, [activeKeys, answered]);

  const quizData = useMemo(
    () => ({
      ...rawQuiz,
      questions: runQuestions,
      nrOfQuestions: String(runQuestions.length),
    }),
    [runQuestions],
  );

  const handleQuestionSubmit = useCallback((data) => {
    const key = data.question.question;
    const correct = isAnswerCorrect(data.question, data.userAnswer);
    setAnswered((prev) => (key in prev ? prev : { ...prev, [key]: correct }));
  }, []);

  const startRun = useCallback((questions) => {
    setActiveKeys(questions.map((question) => question.question));
    setAnswered({});
    setRunQuestions(questions);
    setRunId((id) => id + 1);
  }, []);

  const restartWithFailed = useCallback(
    (failedQuestions) => {
      startRun(failedQuestions);
    },
    [startRun],
  );

  const restartAll = useCallback(() => {
    startRun(fullQuestions);
  }, [fullQuestions, startRun]);

  const activeSet = useMemo(() => {
    const keySet = new Set(activeKeys);
    return fullQuestions.filter((question) => keySet.has(question.question));
  }, [activeKeys, fullQuestions]);

  const answeredCount = activeSet.filter((question) => question.question in answered).length;

  const renderResultUI = useCallback(() => {
    const failedQuestions = activeSet.filter((question) => answered[question.question] === false);
    const total = activeSet.length;
    const correctCount = total - failedQuestions.length;
    const allCorrect = failedQuestions.length === 0;

    return (
      <div className="quiz-result-custom">
        <h2>{allCorrect ? 'Felicitări! Ai răspuns corect la toate întrebările.' : 'Ai terminat chestionarul.'}</h2>
        <p className="score-line">
          Ai <strong>{correctCount}</strong> răspunsuri corecte din <strong>{total}</strong>.
        </p>
        {!allCorrect && (
          <p className="score-line incorrect-count">
            Întrebări greșite: <strong>{failedQuestions.length}</strong>
          </p>
        )}

        <div className="result-actions">
          {!allCorrect && (
            <button
              type="button"
              className="btn restart-failed-btn"
              onClick={() => restartWithFailed(failedQuestions)}
            >
              Reia doar întrebările greșite ({failedQuestions.length})
            </button>
          )}
          <button type="button" className="btn restart-all-btn" onClick={restartAll}>
            Reia tot chestionarul
          </button>
        </div>

        {!allCorrect && (
          <div className="failed-review">
            <h3>Întrebări greșite</h3>
            <ul>
              {failedQuestions.map((question, index) => (
                <li key={index}>{question.question}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }, [activeSet, answered, restartWithFailed, restartAll]);

  // Nothing left to ask in this run: everything has been answered, so show the
  // result page directly (e.g. when the page is reloaded on a finished quiz).
  if (runQuestions.length === 0) {
    if (activeSet.length > 0) {
      return <div className="react-quiz-container">{renderResultUI()}</div>;
    }
    return null;
  }

  const isResuming = answeredCount > 0;

  return (
    <div className="quiz-app">
      <div className="quiz-progress-banner">
        <span>
          Progres salvat: <strong>{answeredCount}</strong> / {activeSet.length} întrebări
          {isResuming ? ' · continuă de unde ai rămas' : ''}
        </span>
        <button type="button" className="reset-progress-btn" onClick={restartAll}>
          Începe din nou
        </button>
      </div>

      <Quiz
        key={runId}
        quiz={quizData}
        shuffle={true}
        enableProgressBar={true}
        showInstantFeedback={true}
        showDefaultResult={false}
        onQuestionSubmit={handleQuestionSubmit}
        customResultPage={renderResultUI}
      />
    </div>
  );
}

export default App;
