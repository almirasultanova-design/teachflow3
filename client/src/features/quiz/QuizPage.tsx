import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import type { Quiz, QuizQuestion } from '@lyricling/shared';
import { api } from '../../lib/api';
import { useT } from '../../i18n';
import { compareAnswers, cn } from '../../lib/utils';

interface FillState { type: 'fill-blank'; values: string[]; submitted: boolean; correct: boolean }
interface MatchState { type: 'match'; mapping: Record<string, string>; submitted: boolean; correct: boolean }
interface TranslateState { type: 'translate-line'; value: string; submitted: boolean; correct: boolean }

type QState = FillState | MatchState | TranslateState;

export function QuizPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [states, setStates] = useState<QState[]>([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.quiz
      .forSong(Number(id))
      .then((q) => {
        setQuiz(q);
        setStates(q.questions.map(initState));
        setError(null);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-ink-dim">{t('common.loading')}</div>;
  if (error) return <div className="text-rose-400">{t('common.error', { message: error })}</div>;
  if (!quiz) return null;

  if (quiz.questions.length === 0) {
    return (
      <div className="panel p-8 text-center">
        <p className="text-ink-muted">{t('quiz.empty')}</p>
        <Link to={`/songs/${id}`} className="btn-outline mt-4">
          {t('quiz.result.toLibrary')}
        </Link>
      </div>
    );
  }

  const score = states.filter((s) => s.correct).length;

  if (done) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto">
        <div className="font-display text-3xl font-bold mb-2">{t('quiz.result.title')}</div>
        <div className="text-5xl font-display font-bold bg-gradient-to-r from-brand to-brand-glow bg-clip-text text-transparent">
          {Math.round((score / quiz.questions.length) * 100)}%
        </div>
        <div className="mt-2 text-ink-muted">
          {t('quiz.result.score', { score, total: quiz.questions.length })}
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            className="btn-outline"
            onClick={() => {
              setStates(quiz.questions.map(initState));
              setStep(0);
              setDone(false);
            }}
          >
            {t('quiz.result.again')}
          </button>
          <Link to={`/songs/${id}`} className="btn-outline">
            {t('quiz.result.toLibrary')}
          </Link>
          <Link to="/progress" className="btn-primary">
            {t('quiz.result.toProgress')}
          </Link>
        </div>
      </div>
    );
  }

  const q = quiz.questions[step];
  const s = states[step];

  const updateState = (next: QState) => {
    setStates((arr) => arr.map((x, i) => (i === step ? next : x)));
  };

  const submitCurrent = () => {
    const correct = checkAnswer(q, s);
    updateState({ ...s, submitted: true, correct } as QState);
  };

  const goNext = async () => {
    if (step + 1 < quiz.questions.length) {
      setStep(step + 1);
    } else {
      setDone(true);
      try {
        await api.quiz.submit({
          songId: quiz.songId,
          score: states.filter((x) => x.correct).length,
          total: quiz.questions.length,
        });
      } catch { /* ignore */ }
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-3 flex items-center justify-between text-sm text-ink-muted">
        <Link to={`/songs/${id}`} className="hover:text-ink">
          ← {t('player.back')}
        </Link>
        <span>{step + 1} / {quiz.questions.length}</span>
      </div>

      <div className="h-1 rounded-full bg-bg-soft overflow-hidden mb-4">
        <div
          className="h-full bg-gradient-to-r from-brand to-brand-glow transition-all"
          style={{ width: `${((step + (s.submitted ? 1 : 0)) / quiz.questions.length) * 100}%` }}
        />
      </div>

      <div className="panel p-6">
        <QuestionView q={q} state={s} onChange={updateState} />

        {s.submitted && (
          <div
            className={cn(
              'mt-4 rounded-xl px-4 py-3 text-sm',
              s.correct
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-300',
            )}
          >
            {s.correct ? t('quiz.correct') : t('quiz.incorrect')}
            {!s.correct && <ExpectedAnswer q={q} t={t as any} />}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          {!s.submitted ? (
            <button className="btn-primary" onClick={submitCurrent} disabled={isEmpty(q, s)}>
              {step + 1 === quiz.questions.length ? t('quiz.submit') : t('quiz.next')}
            </button>
          ) : (
            <button className="btn-primary" onClick={goNext}>
              {step + 1 === quiz.questions.length ? t('quiz.submit') : t('quiz.next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function initState(q: QuizQuestion): QState {
  if (q.type === 'fill-blank') {
    const blanks = (q.prompt.match(/___/g) ?? ['']).length;
    return { type: 'fill-blank', values: Array(blanks).fill(''), submitted: false, correct: false };
  }
  if (q.type === 'match') {
    return { type: 'match', mapping: {}, submitted: false, correct: false };
  }
  return { type: 'translate-line', value: '', submitted: false, correct: false };
}

function isEmpty(q: QuizQuestion, s: QState): boolean {
  if (q.type === 'fill-blank' && s.type === 'fill-blank') return s.values.some((v) => !v.trim());
  if (q.type === 'match' && s.type === 'match') return Object.keys(s.mapping).length < q.left.length;
  if (q.type === 'translate-line' && s.type === 'translate-line') return !s.value.trim();
  return true;
}

function checkAnswer(q: QuizQuestion, s: QState): boolean {
  if (q.type === 'fill-blank' && s.type === 'fill-blank') {
    return q.answers.every((a, i) => compareAnswers(a, s.values[i] ?? ''));
  }
  if (q.type === 'match' && s.type === 'match') {
    return q.left.every((en) => compareAnswers(s.mapping[en] ?? '', q.answer[en] ?? ''));
  }
  if (q.type === 'translate-line' && s.type === 'translate-line') {
    if (!q.expected) return s.value.trim().length > 0; // accept any if no reference
    return compareAnswers(q.expected, s.value);
  }
  return false;
}

function ExpectedAnswer({ q, t }: { q: QuizQuestion; t: (key: any) => string }) {
  if (q.type === 'fill-blank') {
    return <div className="mt-1 text-ink-muted">{t('quiz.expected')}: <span className="text-ink">{q.answers.join(', ')}</span></div>;
  }
  if (q.type === 'translate-line' && q.expected) {
    return <div className="mt-1 text-ink-muted">{t('quiz.expected')}: <span className="text-ink">{q.expected}</span></div>;
  }
  return null;
}

function QuestionView({
  q,
  state,
  onChange,
}: {
  q: QuizQuestion;
  state: QState;
  onChange: (s: QState) => void;
}) {
  const t = useT();

  if (q.type === 'fill-blank' && state.type === 'fill-blank') {
    const parts = q.prompt.split('___');
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
          {t('quiz.fillBlank.title')}
        </div>
        <div className="font-display text-xl leading-relaxed flex flex-wrap items-center gap-2">
          {parts.map((part, i) => (
            <span key={i}>
              {part}
              {i < parts.length - 1 && (
                <input
                  className="input inline-block w-32 mx-1 text-center"
                  value={state.values[i] ?? ''}
                  disabled={state.submitted}
                  onChange={(e) => {
                    const next = state.values.slice();
                    next[i] = e.target.value;
                    onChange({ ...state, values: next });
                  }}
                />
              )}
            </span>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === 'match' && state.type === 'match') {
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-3">
          {t('quiz.match.title')}
        </div>
        <div className="space-y-2">
          {q.left.map((en) => (
            <div key={en} className="flex items-center gap-3">
              <div className="w-1/2 font-display text-lg">{en}</div>
              <select
                value={state.mapping[en] ?? ''}
                disabled={state.submitted}
                onChange={(e) =>
                  onChange({ ...state, mapping: { ...state.mapping, [en]: e.target.value } })
                }
                className="input flex-1"
              >
                <option value="">—</option>
                {q.right.map((ru) => (
                  <option key={ru} value={ru}>
                    {ru}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === 'translate-line' && state.type === 'translate-line') {
    return (
      <div>
        <div className="text-[11px] uppercase tracking-wider text-ink-dim mb-2">
          {t('quiz.translate.title')}
        </div>
        <div className="font-display text-xl mb-3">{q.text}</div>
        <textarea
          className="input min-h-[100px]"
          value={state.value}
          disabled={state.submitted}
          onChange={(e) => onChange({ ...state, value: e.target.value })}
        />
      </div>
    );
  }

  return null;
}
