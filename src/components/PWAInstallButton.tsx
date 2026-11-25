import { useState } from 'react';
import { Check, Copy, Download, Globe, RefreshCw, Share2, Smartphone, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { Modal } from './Modal';

interface PWAInstallButtonProps {
  compact?: boolean;
  onNotify?: (msg: string) => void;
}

export function PWAInstallButton({
  compact = false,
  onNotify,
}: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, isInIframe, isOnline, install } =
    usePWAInstall();
  const [guideOpen, setGuideOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const appUrl =
    typeof window !== 'undefined' ? window.location.origin : '';
  const isPrivatePreview =
    appUrl.includes('://ais-dev-') || appUrl.includes('://ais-pre-');

  const handleCopyUrl = async () => {
    if (!appUrl) return;
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      onNotify?.('Enlace copiado al portapapeles.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      onNotify?.('Copia manualmente el enlace mostrado en pantalla.');
    }
  };

  const handleTrigger = async () => {
    if (isInstallable) {
      const ok = await install();
      if (ok) {
        onNotify?.('⚡ ¡AnimeFit instalada! Se actualizará automáticamente.');
        return;
      }
    }
    setGuideOpen(true);
  };

  return (
    <>
      {!isOnline && (
        <span
          title="Modo sin conexión activo"
          className="min-h-[32px] px-2 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/40 text-[#FBBF24] text-[11px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
        >
          <WifiOff className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden sm:inline">Sin red</span>
        </span>
      )}

      {!isInstalled && (
        <button
          type="button"
          onClick={() => void handleTrigger()}
          title="Instalar AnimeFit (actualización automática)"
          className={
            compact
              ? 'min-h-[36px] px-2.5 sm:px-3 rounded-lg bg-[#38BDF8]/12 border border-[#38BDF8]/40 text-xs font-bold text-[#38BDF8] hover:bg-[#38BDF8]/20 inline-flex items-center gap-1.5 whitespace-nowrap transition-colors'
              : 'min-h-[40px] px-3.5 rounded-xl bg-[#38BDF8]/15 border border-[#38BDF8]/45 text-xs sm:text-sm font-bold text-[#38BDF8] hover:bg-[#38BDF8]/25 inline-flex items-center gap-2 whitespace-nowrap transition-colors'
          }
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>{compact ? 'Instalar' : 'Instalar App'}</span>
        </button>
      )}

      <Modal
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        title="Instalar AnimeFit en tu celular"
      >
        <div className="space-y-3.5 text-sm text-[#8A92A2]">
          <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3.5 space-y-2">
            <div className="flex items-center gap-2 text-[#FACC15] font-bold text-xs uppercase tracking-wider">
              <Smartphone className="w-4 h-4 shrink-0" />
              1. Instalar ya mismo sin PWABuilder (Chrome / Brave)
            </div>
            {isInIframe ? (
              <p className="text-xs leading-relaxed">
                Estás viendo la app dentro del recuadro de vista previa. Para
                instalarla en tu Android, abre este enlace directo en{' '}
                <strong className="text-[#F1F5F9]">Chrome o Brave</strong> y
                toca{' '}
                <strong className="text-[#F1F5F9]">
                  Menú ⋮ → Instalar aplicación
                </strong>{' '}
                (o <strong className="text-[#F1F5F9]">Agregar a inicio</strong>).
              </p>
            ) : isIOS ? (
              <p className="text-xs leading-relaxed">
                En Safari toca{' '}
                <strong className="text-[#F1F5F9] inline-flex items-center gap-1">
                  <Share2 className="w-3.5 h-3.5" /> Compartir
                </strong>{' '}
                y selecciona{' '}
                <strong className="text-[#F1F5F9]">
                  Agregar a pantalla de inicio
                </strong>
                .
              </p>
            ) : (
              <p className="text-xs leading-relaxed">
                En Chrome o Brave abre el menú{' '}
                <strong className="text-[#F1F5F9]">⋮</strong> y elige{' '}
                <strong className="text-[#F1F5F9]">Instalar aplicación</strong>.
              </p>
            )}

            {appUrl && (
              <div className="pt-1 flex items-center gap-2">
                <input
                  readOnly
                  value={appUrl}
                  aria-label="Enlace actual de AnimeFit"
                  className="flex-1 min-w-0 bg-[#0A0B0F] border border-[#1B1E26] rounded-lg px-2.5 py-2 text-xs text-[#F1F5F9] font-mono"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="min-h-[36px] px-3 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar URL
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#38BDF8]">
              <Globe className="w-3.5 h-3.5 shrink-0" />
              2. ¿Por qué PWABuilder dio &quot;Missing Name&quot;?
            </div>
            <p className="text-xs leading-relaxed">
              {isPrivatePreview ? (
                <>
                  Los enlaces de vista previa y compartir de AI Studio (
                  <code className="text-[#F1F5F9]">ais-dev / ais-pre</code>)
                  pasan primero por una verificación de cookies de Google, y el
                  escáner de PWABuilder no puede cruzar esa pantalla.{' '}
                </>
              ) : null}
              Para generar el <strong className="text-[#FACC15]">.APK</strong> en{' '}
              <strong className="text-[#38BDF8]">pwabuilder.com</strong>,
              despliega la app con el botón{' '}
              <strong className="text-[#F1F5F9]">Deploy (Cloud Run)</strong> de
              AI Studio (que crea una URL directa sin verificación previa) o en
              Vercel/Netlify, y pega esa URL en PWABuilder.
            </p>
          </div>

          <div className="rounded-xl bg-[#07080B] border border-[#1B1E26] p-3.5 space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#22C55E]">
              <RefreshCw className="w-3.5 h-3.5 shrink-0" />
              Actualizaciones automáticas
            </div>
            <p className="text-xs leading-relaxed">
              Con la app publicada en una URL pública, tanto la app instalada
              desde Chrome/Brave como el{' '}
              <strong className="text-[#F1F5F9]">.APK</strong> de PWABuilder se
              actualizarán solos cada vez que hagamos cambios.
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}
