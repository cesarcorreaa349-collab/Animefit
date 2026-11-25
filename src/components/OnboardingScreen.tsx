import { useState } from 'react';
import { Check, Sparkles, UserCheck } from 'lucide-react';
import {
  AthleteProfileSetup,
  AthleteSex,
  ExperienceUnit,
} from '../types/animefit';
import { TRAINING_STYLE_OPTIONS } from '../utils/animefit';

interface OnboardingScreenProps {
  username: string;
  initialSetup?: AthleteProfileSetup;
  isEditing?: boolean;
  onCancel?: () => void;
  onSubmit: (setup: AthleteProfileSetup) => void;
}

export function OnboardingScreen({
  username,
  initialSetup,
  isEditing = false,
  onCancel,
  onSubmit,
}: OnboardingScreenProps) {
  const [age, setAge] = useState(
    initialSetup ? String(initialSetup.age) : ''
  );
  const [sex, setSex] = useState<AthleteSex | ''>(
    initialSetup ? initialSetup.sex : ''
  );
  const [weightKg, setWeightKg] = useState(
    initialSetup ? String(initialSetup.weightKg) : ''
  );
  const [heightCm, setHeightCm] = useState(
    initialSetup ? String(initialSetup.heightCm) : ''
  );
  const [expVal, setExpVal] = useState(
    initialSetup ? String(initialSetup.experienceValue) : ''
  );
  const [expUnit, setExpUnit] = useState<ExperienceUnit>(
    initialSetup ? initialSetup.experienceUnit : 'meses'
  );
  const [styles, setStyles] = useState<string[]>(
    initialSetup ? initialSetup.trainingStyles : ['hipertrofia']
  );
  const [error, setError] = useState('');

  const toggleStyle = (id: string) => {
    setStyles((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ageNum = Number(age);
    const weightNum = Number(weightKg);
    const heightNum = Number(heightCm);
    const expNum = Number(expVal);

    if (!Number.isFinite(ageNum) || ageNum < 10 || ageNum > 100) {
      setError('Ingresa una edad válida (entre 10 y 100 años).');
      return;
    }
    if (!sex) {
      setError('Selecciona tu sexo (Masculino o Femenino) para asignar tu guerrero.');
      return;
    }
    if (!Number.isFinite(weightNum) || weightNum < 25 || weightNum > 350) {
      setError('Ingresa tu peso en kg (entre 25 y 350 kg).');
      return;
    }
    if (!Number.isFinite(heightNum) || heightNum < 100 || heightNum > 240) {
      setError('Ingresa tu altura en cm (entre 100 y 240 cm).');
      return;
    }
    if (expVal.trim() === '' || !Number.isFinite(expNum) || expNum < 0 || expNum > 80) {
      setError('Indica cuánto tiempo llevas entrenando (0 o más).');
      return;
    }
    if (styles.length === 0) {
      setError('Elige al menos una forma en la que te gustaría entrenar.');
      return;
    }

    setError('');
    onSubmit({
      age: Math.round(ageNum),
      sex,
      weightKg: Math.round(weightNum * 10) / 10,
      heightCm: Math.round(heightNum),
      experienceValue: Math.round(expNum * 10) / 10,
      experienceUnit: expUnit,
      trainingStyles: styles,
      completedAt: new Date().toISOString(),
    });
  };

  return (
    <div className="min-h-screen relative pb-12">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(14,165,233,0.04),transparent_40%),radial-gradient(circle_at_85%_80%,rgba(202,138,4,0.035),transparent_40%)]"
      />

      <header className="sticky top-0 z-30 bg-[#030406]/92 backdrop-blur-md border-b border-[#1B1E26]">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="text-lg font-black tracking-tight whitespace-nowrap font-[family-name:var(--font-display)]">
            ⚡ ANIME<span className="text-[#FACC15]">FIT</span>
          </div>
          <span className="text-xs font-bold text-[#38BDF8] truncate">
            Perfil de {username}
          </span>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-4 py-6">
        <form
          onSubmit={handleSubmit}
          className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-5 sm:p-6 flex flex-col gap-5"
        >
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-[#FACC15] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              {isEditing ? 'Actualizar Ficha Física' : 'Registro del Guerrero'}
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#F1F5F9] mt-1">
              {isEditing
                ? 'Edita tus datos y estilo de entreno'
                : `¡Bienvenido, ${username}! Cuéntanos sobre ti`}
            </h1>
            <p className="text-xs sm:text-sm text-[#8A92A2] mt-1">
              Con estos datos calibramos tus rutinas iniciales y te asignamos un guerrero anime acorde a tu perfil.
            </p>
          </div>

          {/* Sexo */}
          <div>
            <label className="block text-xs font-bold text-[#F1F5F9] mb-2">
              Sexo <span className="text-[#8A92A2] font-normal">(define si tu personaje será masculino o femenino)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSex('masculino')}
                className={`min-h-[54px] rounded-xl border px-4 py-3 text-left transition-all flex items-center justify-between ${
                  sex === 'masculino'
                    ? 'bg-[#38BDF8]/15 border-[#38BDF8] text-[#F1F5F9]'
                    : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2] hover:border-[#38BDF8]/50'
                }`}
              >
                <div>
                  <div className="text-sm font-extrabold text-[#F1F5F9]">
                    ♂️ Masculino
                  </div>
                  <div className="text-[11px] text-[#8A92A2]">
                    Guerrero anime masculino
                  </div>
                </div>
                {sex === 'masculino' && (
                  <Check className="w-4 h-4 text-[#38BDF8] shrink-0" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setSex('femenino')}
                className={`min-h-[54px] rounded-xl border px-4 py-3 text-left transition-all flex items-center justify-between ${
                  sex === 'femenino'
                    ? 'bg-[#EC4899]/15 border-[#EC4899] text-[#F1F5F9]'
                    : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2] hover:border-[#EC4899]/50'
                }`}
              >
                <div>
                  <div className="text-sm font-extrabold text-[#F1F5F9]">
                    ♀️ Femenino
                  </div>
                  <div className="text-[11px] text-[#8A92A2]">
                    Guerrera anime femenina
                  </div>
                </div>
                {sex === 'femenino' && (
                  <Check className="w-4 h-4 text-[#EC4899] shrink-0" />
                )}
              </button>
            </div>
          </div>

          {/* Edad, Peso, Altura */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Edad (años)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={100}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="Ej: 22"
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Peso (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min={25}
                max={350}
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="Ej: 72.5"
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
                Altura (cm)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={100}
                max={240}
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="Ej: 175"
                className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
            </div>
          </div>

          {/* Tiempo entrenando */}
          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Tiempo entrenando
            </label>
            <div className="grid grid-cols-12 gap-2.5">
              <input
                type="number"
                inputMode="decimal"
                step="0.5"
                min={0}
                max={80}
                value={expVal}
                onChange={(e) => setExpVal(e.target.value)}
                placeholder="Ej: 6 (o 0 si empiezas hoy)"
                className="col-span-6 sm:col-span-7 min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 py-2.5 text-sm text-[#F1F5F9] tabular-nums focus:outline-none focus:border-[#38BDF8]"
              />
              <div className="col-span-6 sm:col-span-5 grid grid-cols-2 gap-1.5 p-1 bg-[#07080B] border border-[#1B1E26] rounded-xl">
                <button
                  type="button"
                  onClick={() => setExpUnit('meses')}
                  className={`min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                    expUnit === 'meses'
                      ? 'bg-[#1E40AF] text-[#F1F5F9]'
                      : 'text-[#8A92A2] hover:text-[#F1F5F9]'
                  }`}
                >
                  Meses
                </button>
                <button
                  type="button"
                  onClick={() => setExpUnit('años')}
                  className={`min-h-[36px] rounded-lg text-xs font-bold transition-colors ${
                    expUnit === 'años'
                      ? 'bg-[#1E40AF] text-[#F1F5F9]'
                      : 'text-[#8A92A2] hover:text-[#F1F5F9]'
                  }`}
                >
                  Años
                </button>
              </div>
            </div>
          </div>

          {/* Formas de entrenar */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold text-[#F1F5F9]">
                ¿Cómo te gustaría entrenar?
              </label>
              <span className="text-[11px] text-[#38BDF8] font-semibold">
                Elige 1 o varias ({styles.length})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {TRAINING_STYLE_OPTIONS.map((opt) => {
                const selected = styles.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleStyle(opt.id)}
                    className={`min-h-[54px] px-3 py-2.5 rounded-xl border text-left transition-all flex items-start gap-2.5 ${
                      selected
                        ? 'bg-[#FACC15]/12 border-[#FACC15] text-[#F1F5F9]'
                        : 'bg-[#07080B] border-[#1B1E26] text-[#8A92A2] hover:border-[#38BDF8]/50'
                    }`}
                  >
                    <span className="text-base leading-none mt-0.5" aria-hidden="true">
                      {opt.icon}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-extrabold text-[#F1F5F9] truncate">
                        {opt.label}
                      </div>
                      <div className="text-[11px] text-[#8A92A2] leading-tight mt-0.5">
                        {opt.desc}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/40 px-3.5 py-2.5 text-xs font-bold text-[#FCA5A5]">
              {error}
            </div>
          )}

          <div className="flex gap-2.5">
            {isEditing && onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="min-h-[48px] px-5 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9]"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              className="min-h-[48px] flex-1 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] font-black text-sm inline-flex items-center justify-center gap-2 shadow-[0_0_18px_rgba(29,78,216,0.28)]"
            >
              <UserCheck className="w-4 h-4" />
              {isEditing
                ? 'Guardar Cambios'
                : 'Guardar Perfil y Asignar Mi Guerrero'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
