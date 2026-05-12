import { useEffect } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { Header } from './components/Header';
import { HomePage } from './features/home/HomePage';
import { LibraryPage } from './features/library/LibraryPage';
import { ProfilePage } from './features/profile/ProfilePage';
import { PlayerPage } from './features/player/PlayerPage';
import { QuizPage } from './features/quiz/QuizPage';
import { DictionaryPage } from './features/dictionary/DictionaryPage';
import { ProgressPage } from './features/progress/ProgressPage';
import { LoginPage } from './features/auth/LoginPage';
import { RegisterPage } from './features/auth/RegisterPage';
import { RequireAuth } from './features/auth/RequireAuth';
import { StudentsPage } from './features/teacher/StudentsPage';
import { StudentDetailPage } from './features/teacher/StudentDetailPage';
import { useAuthStore } from './stores/authStore';

const PUBLIC_PATHS = new Set(['/login', '/register']);

export default function App() {
  const status = useAuthStore((s) => s.status);
  const fetchMe = useAuthStore((s) => s.fetchMe);
  const location = useLocation();
  const isPublic = PUBLIC_PATHS.has(location.pathname);

  useEffect(() => {
    if (status === 'idle') {
      void fetchMe();
    }
  }, [status, fetchMe]);

  return (
    <div className="min-h-full flex flex-col">
      {!isPublic && <Header />}
      <main className="flex-1 mx-auto w-full max-w-6xl px-4 py-6">
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/"
            element={
              <RequireAuth>
                <HomePage />
              </RequireAuth>
            }
          />
          <Route
            path="/library"
            element={
              <RequireAuth>
                <LibraryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/profile"
            element={
              <RequireAuth>
                <ProfilePage />
              </RequireAuth>
            }
          />
          <Route
            path="/songs/:id"
            element={
              <RequireAuth>
                <PlayerPage />
              </RequireAuth>
            }
          />
          <Route
            path="/songs/:id/quiz"
            element={
              <RequireAuth>
                <QuizPage />
              </RequireAuth>
            }
          />
          <Route
            path="/dictionary"
            element={
              <RequireAuth>
                <DictionaryPage />
              </RequireAuth>
            }
          />
          <Route
            path="/progress"
            element={
              <RequireAuth>
                <ProgressPage />
              </RequireAuth>
            }
          />
          <Route
            path="/students"
            element={
              <RequireAuth>
                <StudentsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/students/:id"
            element={
              <RequireAuth>
                <StudentDetailPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<div className="text-ink-dim">404</div>} />
        </Routes>
      </main>
      {!isPublic && (
        <footer className="text-center text-xs text-ink-dim py-6">
          TeachFlow · learn english through music · inVisionU
        </footer>
      )}
    </div>
  );
}
