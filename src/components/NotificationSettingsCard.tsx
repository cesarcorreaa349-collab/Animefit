import {
  AlertTriangle,
  Bell,
  BellOff,
  CheckCircle2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';

interface NotificationSettingsCardProps {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  enabled: boolean;
  hoursSinceActivity: number | null;
  onRequestPermission: () => void | Promise<unknown>;
  onRefreshPermission: () => void;
  onToggleReminder: () => void;
  onTestReminder: () => void;
  variant?: 'card' | 'modal';
}

function getPlatformHints() {
  if (typeof navigator === 'undefined') {
    return { isIOS: false, isAndroid: false, isStandalone: false };
  }
  const ua = navigator.userAgent.toLowerCase();
  const isIOS =
    /iphone|ipad|ipod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /android/.test(ua);
  const isStandalone =
    (typeof window !== 'undefined' &&
      window.matchMedia?.('(display-mode: standalone)').matches) ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  return { isIOS, isAndroid, isStandalone };
}

export function NotificationSettingsCard({
  supported,
  permission,
  enabled,
  hoursSinceActivity,
  onRequestPermission,
  onRefreshPermission,
  onToggleReminder,
  onTestReminder,
  variant = 'card',
}: NotificationSettingsCardProps) {
  const { isIOS, isAndroid, isStandalone } = getPlatformHints();

  const statusMeta = !supported
    ? {
        label: 'No soportado',
        colorClass: 'text-[#8A92A2] border-[#1B1E26] bg-[#07080B]',
      }
    : permission === 'granted'
    ? {
        label: 'Permitido',
        colorClass: 'text-[#22C55E] border-[#22C55E]/40 bg-[#22C55E]/10',
      }
    : permission === 'denied'
    ? {
        label: 'Bloqueado',
        colorClass: 'text-[#FCA5A5] border-[#EF4444]/40 bg-[#EF4444]/10',
      }
    : {
        label: 'Pendiente',
        colorClass: 'text-[#FACC15] border-[#FACC15]/40 bg-[#FACC15]/10',
      };

  const containerClass =
    variant === 'card'
      ? 'bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5 flex flex-col gap-3.5'
      : 'flex flex-col gap-3.5';

  return (
    <section className={containerClass}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-extrabold text-[#F1F5F9]">
            Notificaciones y Recordatorios
          </h3>
          <p className="text-xs text-[#8A92A2] mt-0.5 leading-snug">
            Recibe avisos locales (PWA / web / .apk) si pasan 24 horas sin entrenar ni registrar actividad.
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-lg border text-[11px] font-extrabold whitespace-nowrap shrink-0 ${statusMeta.colorClass}`}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-[#8A92A2]">
          {permission === 'granted' ? (
            <CheckCircle2 className="w-4 h-4 text-[#22C55E] shrink-0" />
          ) : permission === 'denied' ? (
            <ShieldAlert className="w-4 h-4 text-[#FCA5A5] shrink-0" />
          ) : (
            <Bell className="w-4 h-4 text-[#38BDF8] shrink-0" />
          )}
          <span>
            Recordatorio 24h:{' '}
            <strong className="text-[#F1F5F9]">
              {!supported
                ? 'No disponible'
                : permission !== 'granted'
                ? 'Requiere permiso'
                : enabled
                ? 'Activo'
                : 'Pausado'}
            </strong>
          </span>
        </div>

        {hoursSinceActivity !== null && (
          <span className="text-[11px] text-[#8A92A2] tabular-nums">
            Última actividad:{' '}
            <strong className="text-[#38BDF8]">
              {hoursSinceActivity === 0
                ? 'hace < 1 h'
                : `hace ${hoursSinceActivity} h`}
            </strong>
          </span>
        )}
      </div>

      {/* Unsupported device/browser notice */}
      {!supported && (
        <div className="rounded-xl bg-[#101218] border border-[#1B1E26] p-3 text-xs text-[#8A92A2] leading-relaxed flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
          <div>
            <strong className="text-[#F1F5F9] block mb-0.5">
              Notificaciones no soportadas en este entorno
            </strong>
            {isIOS && !isStandalone ? (
              <span>
                En iPhone y iPad, Apple solo habilita notificaciones web cuando instalás la app: tocá{' '}
                <strong className="text-[#F1F5F9]">Compartir → Agregar a pantalla de inicio</strong>{' '}
                y ábrela desde ese ícono.
              </span>
            ) : (
              <span>
                Este navegador, WebView o conexión no expone la API de notificaciones del sistema. Abrí AnimeFit en Chrome/Brave (HTTPS) o desde la app instalada.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Blocked permission guidance */}
      {supported && permission === 'denied' && (
        <div
          role="alert"
          className="rounded-xl bg-[#EF4444]/10 border border-[#EF4444]/35 p-3.5 text-xs text-[#F1F5F9] leading-relaxed flex flex-col gap-2"
        >
          <div className="flex items-center gap-2 font-extrabold text-[#FCA5A5]">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            Permiso bloqueado en el dispositivo o navegador
          </div>
          <p className="text-[#E2E8F0]">
            Por seguridad del sistema, una vez bloqueado el permiso no podemos volver a mostrar la ventana emergente. Habilítalo manualmente así:
          </p>
          <ul className="list-disc pl-4 space-y-1 text-[#CBD5E1]">
            {isAndroid && (
              <li>
                <strong className="text-[#F1F5F9]">Android (.apk o app instalada):</strong>{' '}
                <em>Ajustes del teléfono → Aplicaciones → AnimeFit</em> (o Chrome/Brave) →{' '}
                <em>Notificaciones → Permitir notificaciones</em>.
              </li>
            )}
            {isIOS && (
              <li>
                <strong className="text-[#F1F5F9]">iPhone / iPad:</strong>{' '}
                <em>Ajustes de iOS → Notificaciones → AnimeFit → Permitir notificaciones</em>.
              </li>
            )}
            <li>
              <strong className="text-[#F1F5F9]">Navegador web (Chrome / Brave / Edge):</strong>{' '}
              Tocá el ícono de <strong className="text-[#F1F5F9]">candado o ajustes del sitio</strong> junto a la barra de dirección →{' '}
              <em>Permisos / Notificaciones → Permitir</em> y vuelve aquí.
            </li>
          </ul>
          <div className="pt-1">
            <button
              type="button"
              onClick={onRefreshPermission}
              className="min-h-[38px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#38BDF8] inline-flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Ya las habilité, comprobar estado
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {permission === 'default' && supported && (
          <button
            type="button"
            onClick={() => void onRequestPermission()}
            className="min-h-[42px] flex-1 px-4 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap shadow-[0_0_14px_rgba(29,78,216,0.28)]"
          >
            <Bell className="w-4 h-4" />
            Activar notificaciones
          </button>
        )}

        {permission === 'granted' && supported && (
          <>
            <button
              type="button"
              onClick={onToggleReminder}
              className={`min-h-[42px] flex-1 px-3.5 rounded-xl text-xs font-extrabold inline-flex items-center justify-center gap-1.5 whitespace-nowrap ${
                enabled
                  ? 'bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-[#F1F5F9]'
                  : 'bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9]'
              }`}
            >
              {enabled ? (
                <>
                  <BellOff className="w-3.5 h-3.5 text-[#8A92A2]" />
                  Desactivar recordatorio 24h
                </>
              ) : (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  Activar recordatorio 24h
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onTestReminder}
              className="min-h-[42px] px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#38BDF8] whitespace-nowrap"
            >
              Probar aviso
            </button>
          </>
        )}

        {!supported && (
          <button
            type="button"
            disabled
            className="min-h-[40px] flex-1 px-3.5 rounded-xl bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#8A92A2] opacity-55 cursor-not-allowed inline-flex items-center justify-center gap-1.5"
          >
            <BellOff className="w-3.5 h-3.5" />
            Notificaciones no disponibles
          </button>
        )}
      </div>
    </section>
  );
}
