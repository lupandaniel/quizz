import { useCallback, useEffect, useMemo, useState } from 'react';
import Quiz from 'react-quiz-component';
import { questions as rawQuiz } from './questions';

const STORAGE_KEY = 'quiz-progress-v3';

// react-quiz-component renders the question text through a markdown parser.
// A leading "57. " is interpreted as an ordered-list item, and because each
// question is a single-item list, markdown always renders the marker as "1.",
// throwing away the real question number. Inserting a zero-width space after
// the digits breaks that list detection while staying visually identical.
function preserveQuestionNumber(text) {
  return typeof text === 'string' ? text.replace(/^(\s*\d+)\./, '$1\u200B.') : text;
}

// react-quiz-component expects `correctAnswer` to be a (1-based) string for
// single-selection questions. This data set stores it as an array (e.g. [1]),
// which breaks scoring + instant feedback. Normalize it here without touching
// the large data file.
function normalizeQuestions(questionList) {
  return questionList.map((question) => {
    const normalized = { ...question, question: preserveQuestionNumber(question.question) };
    const type = normalized.answerSelectionType || 'single';
    if (type === 'single' && Array.isArray(normalized.correctAnswer)) {
      normalized.correctAnswer = String(normalized.correctAnswer[0]);
    }
    return normalized;
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

function correctIndexes(question) {
  if (Array.isArray(question.correctAnswer)) return question.correctAnswer.map(Number);
  return [Number(question.correctAnswer)];
}

function selectedIndexes(userAnswer) {
  if (Array.isArray(userAnswer)) return userAnswer.map(Number);
  if (userAnswer === undefined || userAnswer === null) return [];
  return [Number(userAnswer)];
}

const entryIsCorrect = (entry) =>
  entry != null && (typeof entry === 'object' ? entry.correct === true : entry === true);

const entryUserAnswer = (entry) => (entry && typeof entry === 'object' ? entry.userAnswer : undefined);

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

function QuizApp() {
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
  const [resultFilter, setResultFilter] = useState('answered');
  const [finished, setFinished] = useState(false);

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
    setAnswered((prev) =>
      key in prev ? prev : { ...prev, [key]: { correct, userAnswer: data.userAnswer } },
    );
  }, []);

  const startRun = useCallback((questions) => {
    setActiveKeys(questions.map((question) => question.question));
    setAnswered({});
    setRunQuestions(questions);
    setResultFilter('answered');
    setFinished(false);
    setRunId((id) => id + 1);
  }, []);

  const finishNow = useCallback(() => {
    setResultFilter('answered');
    setFinished(true);
  }, []);

  const continueRemaining = useCallback(() => {
    setRunQuestions((current) => computeRunQuestions(fullQuestions, activeKeys, answered) || current);
    setFinished(false);
    setRunId((id) => id + 1);
  }, [fullQuestions, activeKeys, answered]);

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
  const correctSoFar = activeSet.filter((question) => entryIsCorrect(answered[question.question])).length;
  const incorrectSoFar = answeredCount - correctSoFar;

  const renderAnswerReview = useCallback(
    (question) => {
      const entry = answered[question.question];
      const correctSet = correctIndexes(question);
      const userSet = selectedIndexes(entryUserAnswer(entry));

      return (
        <div className="review-answers">
          {question.answers.map((answer, index) => {
            const oneBased = index + 1;
            const isCorrect = correctSet.includes(oneBased);
            const isPicked = userSet.includes(oneBased);
            const className = [
              'review-answer',
              isCorrect ? 'correct' : '',
              !isCorrect && isPicked ? 'incorrect' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <div key={index} className={className}>
                {question.questionType === 'photo' ? (
                  <img src={answer} alt="răspuns" />
                ) : (
                  <span>{answer}</span>
                )}
                {isCorrect && <span className="review-tag">răspuns corect</span>}
                {!isCorrect && isPicked && <span className="review-tag">răspunsul tău</span>}
              </div>
            );
          })}
        </div>
      );
    },
    [answered],
  );

  const statusOf = useCallback(
    (question) => {
      if (!(question.question in answered)) return 'unanswered';
      return entryIsCorrect(answered[question.question]) ? 'correct' : 'incorrect';
    },
    [answered],
  );

  const renderResultUI = useCallback(() => {
    const total = activeSet.length;
    const correctQuestions = activeSet.filter((question) => statusOf(question) === 'correct');
    const incorrectQuestions = activeSet.filter((question) => statusOf(question) === 'incorrect');
    const unansweredQuestions = activeSet.filter((question) => statusOf(question) === 'unanswered');
    const correctCount = correctQuestions.length;
    const answeredTotal = total - unansweredQuestions.length;
    const allPerfect = total > 0 && correctCount === total;

    const reviewQuestions = activeSet.filter((question) => {
      const status = statusOf(question);
      if (resultFilter === 'all') return true;
      if (resultFilter === 'answered') return status === 'correct' || status === 'incorrect';
      return status === resultFilter;
    });

    const badge = { correct: 'badge correct-badge', incorrect: 'badge incorrect-badge', unanswered: 'badge unanswered-badge' };
    const badgeIcon = { correct: '✓', incorrect: '✗', unanswered: '–' };

    return (
      <div className="quiz-result-custom">
        <h2>{allPerfect ? 'Felicitări! Ai răspuns corect la toate întrebările.' : 'Rezultatul chestionarului'}</h2>
        <p className="score-line">
          Scor: <strong>{correctCount}</strong> / {total} ({total ? Math.round((correctCount / total) * 100) : 0}%)
        </p>
        <p className="score-line muted">
          Răspunse: <strong>{answeredTotal}</strong> · Corecte: <strong className="score-correct">{correctCount}</strong> · Greșite:{' '}
          <strong className="score-incorrect">{incorrectQuestions.length}</strong>
          {unansweredQuestions.length > 0 && (
            <>
              {' '}· Fără răspuns: <strong>{unansweredQuestions.length}</strong>
            </>
          )}
        </p>

        <div className="result-actions">
          {unansweredQuestions.length > 0 && (
            <button type="button" className="btn continue-btn" onClick={continueRemaining}>
              Continuă întrebările rămase ({unansweredQuestions.length})
            </button>
          )}
          {incorrectQuestions.length > 0 && (
            <button
              type="button"
              className="btn restart-failed-btn"
              onClick={() => restartWithFailed(incorrectQuestions)}
            >
              Reia doar întrebările greșite ({incorrectQuestions.length})
            </button>
          )}
          <button type="button" className="btn restart-all-btn" onClick={restartAll}>
            Reia tot chestionarul
          </button>
        </div>

        <div className="review-section">
          <div className="review-header">
            <h3>Răspunsuri</h3>
            <div className="review-filter">
              <button type="button" className={resultFilter === 'answered' ? 'active' : ''} onClick={() => setResultFilter('answered')}>
                Răspunse ({answeredTotal})
              </button>
              <button type="button" className={resultFilter === 'correct' ? 'active' : ''} onClick={() => setResultFilter('correct')}>
                Corecte ({correctCount})
              </button>
              <button type="button" className={resultFilter === 'incorrect' ? 'active' : ''} onClick={() => setResultFilter('incorrect')}>
                Greșite ({incorrectQuestions.length})
              </button>
              {unansweredQuestions.length > 0 && (
                <button
                  type="button"
                  className={resultFilter === 'unanswered' ? 'active' : ''}
                  onClick={() => setResultFilter('unanswered')}
                >
                  Fără răspuns ({unansweredQuestions.length})
                </button>
              )}
              <button type="button" className={resultFilter === 'all' ? 'active' : ''} onClick={() => setResultFilter('all')}>
                Toate ({total})
              </button>
            </div>
          </div>

          {reviewQuestions.map((question, index) => {
            const status = statusOf(question);
            return (
              <div key={index} className="review-question">
                <p className="review-question-text">
                  <span className={badge[status]}>{badgeIcon[status]}</span>
                  {question.question}
                </p>
                {renderAnswerReview(question)}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [activeSet, statusOf, resultFilter, continueRemaining, restartWithFailed, restartAll, renderAnswerReview]);

  // Show the result page directly when the user finished early, or when there
  // is nothing left to ask (e.g. reloading on an already-completed quiz).
  if (finished || runQuestions.length === 0) {
    if (activeSet.length > 0) {
      return <div className="react-quiz-container">{renderResultUI()}</div>;
    }
    return null;
  }

  const isResuming = answeredCount > 0;

  return (
    <div className="quiz-app">
      <div className="quiz-progress-banner">
        <div className="banner-stats">
          <span>
            Progres: <strong>{answeredCount}</strong> / {activeSet.length}
            {isResuming ? ' · continuă de unde ai rămas' : ''}
          </span>
          <span className="live-score">
            Scor: <strong className="score-correct">{correctSoFar}</strong> corecte
            {incorrectSoFar > 0 && (
              <>
                {' · '}
                <strong className="score-incorrect">{incorrectSoFar}</strong> greșite
              </>
            )}
          </span>
        </div>
        <div className="banner-actions">
          {answeredCount > 0 && (
            <button type="button" className="finish-now-btn" onClick={finishNow}>
              Finalizează acum
            </button>
          )}
          <button type="button" className="reset-progress-btn" onClick={restartAll}>
            Începe din nou
          </button>
        </div>
      </div>

      <Quiz
        key={runId}
        quiz={quizData}
        shuffle={false}
        enableProgressBar={true}
        showInstantFeedback={true}
        showDefaultResult={false}
        onQuestionSubmit={handleQuestionSubmit}
        customResultPage={renderResultUI}
      />
    </div>
  );
}

export default QuizApp;
