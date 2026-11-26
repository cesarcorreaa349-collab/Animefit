import { useState } from 'react';
import { CHARACTERS } from '../data/characters';

interface AuthScreenProps {
  onLogin: (identifier: string, pass: string) => void;
  onRegister: (username: string, email: string, pass: string) => void;
}

export function AuthScreen({ onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPass, setLoginPass] = useState('');

  const [regUser, setRegUser] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPass, setRegPass] = useState('');

  return (
    <div className="min-h-screen relative">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.035),transparent_38%),radial-gradient(circle_at_85%_80%,rgba(202,138,4,0.035),transparent_38%)]"
      />

      <header className="sticky top-0 z-30 bg-[#030406]/92 backdrop-blur-md border-b border-[#1B1E26]">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="text-lg font-black tracking-tight whitespace-nowrap shrink-0 font-[family-name:var(--font-display)]">
            ⚡ ANIME<span className="text-[#FACC15]">FIT</span>
          </div>
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-medium text-[#8A92A2] whitespace-nowrap">
              Ki Workout Tracker
            </span>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-6 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-[#0A0B0F] border border-[#FACC15]/35 rounded-2xl p-6 text-center bg-[radial-gradient(circle_at_50%_20%,rgba(14,165,233,0.06),#0A0B0F_75%)]">
          <div className="text-4xl mb-3" aria-hidden="true">
            🔥⚡🥋
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#F1F5F9] text-balance leading-tight">
            Entrena y Evoluciona tu Guerrero Anime
          </h1>
          <p className="text-sm text-[#8A92A2] mt-3 leading-relaxed">
            Al registrarte con tu correo recibirás un guerrero asignado automáticamente entre{' '}
            <strong className="text-[#F1F5F9]">{CHARACTERS.length} personajes</strong>{' '}
            con retrato propio. Sube de nivel con cada serie y récord personal para desbloquear sus transformaciones.
          </p>

          <div className="mt-6 pt-5 border-t border-[#1B1E26] grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-xl font-black text-[#FACC15] tabular-nums">
                {CHARACTERS.length}
              </div>
              <div className="text-xs text-[#8A92A2]">Guerreros</div>
            </div>
            <div>
              <div className="text-xl font-black text-[#38BDF8] tabular-nums">
                125+
              </div>
              <div className="text-xs text-[#8A92A2]">Ejercicios</div>
            </div>
            <div>
              <div className="text-xl font-black text-[#22C55E] tabular-nums">
                100%
              </div>
              <div className="text-xs text-[#8A92A2]">Autoguardado</div>
            </div>
          </div>

          <div className="mt-5 text-xs text-[#8A92A2]">
            Cuenta demo para comunidad:{' '}
            <strong className="text-[#F1F5F9]">vegeta_gym</strong> · clave{' '}
            <strong className="text-[#F1F5F9]">123</strong>
          </div>
        </section>

        <section className="lg:col-span-7 bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-5 sm:p-6">
          <div className="grid grid-cols-2 gap-2 p-1 bg-[#07080B] border border-[#1B1E26] rounded-xl mb-5">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`min-h-[44px] rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9]'
                  : 'text-[#8A92A2] hover:text-[#F1F5F9]'
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`min-h-[44px] rounded-lg text-sm font-bold transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9]'
                  : 'text-[#8A92A2] hover:text-[#F1F5F9]'
              }`}
            >
              Crear Cuenta
            </button>
          </div>

          {mode === 'login' ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onLogin(loginIdentifier, loginPass);
              }}
              className="flex flex-col gap-4"
            >
              <div>
                <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                  Usuario o correo electrónico
                </label>
                <input
                  value={loginIdentifier}
                  onChange={(e) => setLoginIdentifier(e.target.value)}
                  placeholder="Ej: Saiyajin99 o tu@correo.com"
                  className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                  Contraseña
                </label>
                <input
                  type="password"
                  value={loginPass}
                  onChange={(e) => setLoginPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>
              <button
                type="submit"
                className="min-h-[48px] w-full rounded-xl font-bold text-sm bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] shadow-[0_0_16px_rgba(29,78,216,0.28)] active:scale-[0.98] transition-transform"
              >
                ⚡ Entrar al Dojo
              </button>
              <p className="text-xs text-[#8A92A2] text-center">
                Tus rutinas, récords personales y evolución se guardan automáticamente en este dispositivo.
              </p>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onRegister(regUser, regEmail, regPass);
              }}
              className="flex flex-col gap-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                    Nombre de usuario único
                  </label>
                  <input
                    value={regUser}
                    onChange={(e) => setRegUser(e.target.value)}
                    placeholder="Tu alias guerrero"
                    className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                    Contraseña
                  </label>
                  <input
                    type="password"
                    value={regPass}
                    onChange={(e) => setRegPass(e.target.value)}
                    placeholder="Mín. 3 caracteres"
                    className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                  Correo electrónico (opcional — puedes agregarlo luego en Mi usuario)
                </label>
                <input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Opcional: ejemplo@gmail.com"
                  className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
                />
              </div>

              <div className="rounded-xl bg-[#07080B] border border-[#38BDF8]/35 p-4 flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-full bg-[#0A0B0F] border border-[#FACC15]/50 flex items-center justify-center text-2xl shrink-0">
                  🎲
                </div>
                <div>
                  <div className="text-sm font-extrabold text-[#F1F5F9]">
                    Asignación Automática de Guerrero
                  </div>
                  <p className="text-xs text-[#8A92A2] mt-1 leading-relaxed">
                    El sistema asignará tu personaje automáticamente al crear la cuenta (Nivel 1 · 0 XP). Los nombres de usuario son únicos y puedes vincular tu correo ahora o después en Mi usuario.
                  </p>
                </div>
              </div>

              <button
                type="submit"
                className="min-h-[48px] w-full rounded-xl font-bold text-sm bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] shadow-[0_0_16px_rgba(29,78,216,0.28)] active:scale-[0.98] transition-transform"
              >
                🚀 Crear Cuenta y Descubrir Mi Guerrero
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
