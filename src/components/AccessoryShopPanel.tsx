import { useEffect, useMemo, useState } from 'react';
import { Check, Lock, Sparkles } from 'lucide-react';
import {
  ACCESSORY_DAILY_PURCHASE_LIMIT,
  ACCESSORY_DAILY_SHOP_SIZE,
  ACCESSORY_SLOT_ICONS,
  ACCESSORY_SLOT_LABELS,
  getAccessoryById,
  getAccessorySlotKey,
  getDailyAccessoryShopRotation,
  getOwnedAccessoryIds,
  getUserAccessoryDailyPurchasesCount,
  SECONDARY_CURRENCY_COLOR,
  SECONDARY_CURRENCY_ICON,
  SECONDARY_CURRENCY_NAME,
} from '../data/accessoriesCatalog';
import { toShopLocalDateKey } from '../data/shopCatalog';
import {
  AccessorySlot,
  AnimeAccessoryDef,
  ShopItemRarity,
  UserProfile,
} from '../types/animefit';

interface AccessoryShopPanelProps {
  user: UserProfile;
  onBuyAccessory: (accessoryId: string) => void;
  onEquipAccessory: (
    accessoryId: string | null,
    slotOverride?: keyof NonNullable<UserProfile['equippedAccessories']>
  ) => void;
  compact?: boolean;
}

function formatCountdownToLocalMidnight(now: Date): string {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const diffSec = Math.max(
    0,
    Math.floor((tomorrow.getTime() - now.getTime()) / 1000)
  );
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(
    s
  ).padStart(2, '0')}`;
}

function getRarityMeta(rarity: ShopItemRarity): {
  label: string;
  textClass: string;
  borderHex: string;
} {
  switch (rarity) {
    case 'legendario':
      return {
        label: 'Legendario',
        textClass: 'text-amber-300',
        borderHex: '#F59E0B',
      };
    case 'épico':
      return {
        label: 'Épico',
        textClass: 'text-violet-300',
        borderHex: '#A855F7',
      };
    case 'raro':
      return {
        label: 'Raro',
        textClass: 'text-sky-300',
        borderHex: '#38BDF8',
      };
    default:
      return {
        label: 'Común',
        textClass: 'text-slate-300',
        borderHex: '#94A3B8',
      };
  }
}

export function AccessoryShopPanel({
  user,
  onBuyAccessory,
  onEquipAccessory,
  compact = false,
}: AccessoryShopPanelProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'owned'>('daily');
  const [slotFilter, setSlotFilter] = useState<'all' | AccessorySlot>('all');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const localDateKey = toShopLocalDateKey(now);
  const rotation = useMemo(
    () => getDailyAccessoryShopRotation(localDateKey),
    [localDateKey]
  );
  const countdown = formatCountdownToLocalMidnight(now);

  const secondaryBalance = Math.max(
    0,
    Math.floor(Number(user.secondaryCoins || 0))
  );
  const ownedIds = useMemo(() => getOwnedAccessoryIds(user), [user]);
  const ownedSet = useMemo(() => new Set(ownedIds), [ownedIds]);
  const dailyBought = getUserAccessoryDailyPurchasesCount(user, localDateKey);
  const dailyRemaining = Math.max(
    0,
    ACCESSORY_DAILY_PURCHASE_LIMIT - dailyBought
  );

  const equippedMap = user.equippedAccessories || {};
  const equippedById = useMemo(
    () =>
      new Set(
        [
          equippedMap.helmId,
          equippedMap.armorId,
          equippedMap.ringId,
          equippedMap.amuletId,
        ].filter(Boolean) as string[]
      ),
    [equippedMap]
  );

  const ownedDefs = useMemo(
    () =>
      ownedIds
        .map((id) => getAccessoryById(id))
        .filter((a): a is AnimeAccessoryDef => Boolean(a))
        .filter((a) => (slotFilter === 'all' ? true : a.slot === slotFilter)),
    [ownedIds, slotFilter]
  );

  const slots: AccessorySlot[] = ['helm', 'armor', 'ring', 'amulet'];

  return (
    <div className="space-y-4">
      {/* Header & Secondary Currency Banner */}
      <section
        className={`rounded-2xl border bg-[#0A0B0F] ${
          compact ? 'p-4' : 'p-4 sm:p-5'
        } space-y-4`}
        style={{ borderColor: `${SECONDARY_CURRENCY_COLOR}44` }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div
              className="text-[11px] font-black uppercase tracking-wider"
              style={{ color: SECONDARY_CURRENCY_COLOR }}
            >
              Mini-Tienda de Accesorios Anime · Moneda Secundaria
            </div>
            <h3 className="text-lg sm:text-xl font-black text-[#F1F5F9]">
              Reliquias & Accesorios Diarios ({ACCESSORY_DAILY_SHOP_SIZE}/día)
            </h3>
            <p className="text-xs text-[#8A92A2] mt-0.5">
              Se compran solo con{' '}
              <strong style={{ color: SECONDARY_CURRENCY_COLOR }}>
                {SECONDARY_CURRENCY_ICON} {SECONDARY_CURRENCY_NAME}
              </strong>{' '}
              (ganados en Torre Anime y Modo Historia). Presencia visual en salas y perfil · Sin efecto en PvP.
            </p>
          </div>

          <div
            className="flex items-center gap-2.5 rounded-xl border px-4 py-2.5 shrink-0 bg-[#05080D]"
            style={{ borderColor: `${SECONDARY_CURRENCY_COLOR}66` }}
          >
            <span className="text-2xl" aria-hidden="true">
              {SECONDARY_CURRENCY_ICON}
            </span>
            <div>
              <div
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: SECONDARY_CURRENCY_COLOR }}
              >
                Tus {SECONDARY_CURRENCY_NAME}
              </div>
              <div
                className="text-xl font-black tabular-nums leading-tight"
                style={{ color: SECONDARY_CURRENCY_COLOR }}
              >
                {secondaryBalance.toLocaleString('es-ES')}
              </div>
            </div>
          </div>
        </div>

        {/* Daily KPI Strip */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Fecha Local
            </div>
            <div className="text-xs sm:text-sm font-black text-white tabular-nums mt-0.5">
              {localDateKey}
            </div>
            <div className="text-[10px] text-slate-400 tabular-nums">
              Cambia en {countdown}
            </div>
          </div>

          <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Cupo Diario
            </div>
            <div
              className={`text-xs sm:text-sm font-black tabular-nums mt-0.5 ${
                dailyRemaining === 0 ? 'text-rose-400' : 'text-teal-300'
              }`}
            >
              {dailyBought} / {ACCESSORY_DAILY_PURCHASE_LIMIT} hoy
            </div>
            <div className="text-[10px] text-slate-400">
              {dailyRemaining === 0
                ? 'Vuelve mañana (00:00)'
                : `${dailyRemaining} compra${dailyRemaining === 1 ? '' : 's'} libre${dailyRemaining === 1 ? '' : 's'}`}
            </div>
          </div>

          <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-3 py-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Colección
            </div>
            <div className="text-xs sm:text-sm font-black text-white tabular-nums mt-0.5">
              {ownedIds.length} accesorios
            </div>
            <div className="text-[10px] text-slate-400">
              {equippedById.size} / 4 equipados
            </div>
          </div>
        </div>

        {/* Equipped 4 Slots Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {slots.map((slot) => {
            const slotKey = getAccessorySlotKey(slot);
            const eqId = equippedMap[slotKey];
            const eqDef = getAccessoryById(eqId);
            return (
              <div
                key={slot}
                className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-2.5 py-2 flex items-center justify-between gap-2 min-w-0"
              >
                <div className="min-w-0">
                  <div className="text-[10px] font-bold text-slate-400 truncate">
                    {ACCESSORY_SLOT_ICONS[slot]} {ACCESSORY_SLOT_LABELS[slot]}
                  </div>
                  <div
                    className="text-xs font-extrabold truncate mt-0.5"
                    style={{ color: eqDef ? eqDef.accentColor : '#64748B' }}
                  >
                    {eqDef ? `${eqDef.icon} ${eqDef.name}` : 'Vacío'}
                  </div>
                </div>
                {eqDef && (
                  <button
                    type="button"
                    onClick={() => onEquipAccessory(null, slotKey)}
                    className="text-[10px] font-bold px-2 py-1 rounded-md border border-[#1B1E26] bg-[#101218] text-slate-300 hover:text-white shrink-0"
                  >
                    Quitar
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sub-view switcher */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#1B1E26]">
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-black border transition ${
              viewMode === 'daily'
                ? 'text-slate-950 border-teal-300'
                : 'bg-[#07080B] text-slate-300 border-[#1B1E26] hover:text-white'
            }`}
            style={
              viewMode === 'daily'
                ? { backgroundColor: SECONDARY_CURRENCY_COLOR }
                : undefined
            }
          >
            Rotación Diaria ({ACCESSORY_DAILY_SHOP_SIZE})
          </button>
          <button
            type="button"
            onClick={() => setViewMode('owned')}
            className={`min-h-[38px] px-3.5 rounded-lg text-xs font-black border transition ${
              viewMode === 'owned'
                ? 'text-slate-950 border-teal-300'
                : 'bg-[#07080B] text-slate-300 border-[#1B1E26] hover:text-white'
            }`}
            style={
              viewMode === 'owned'
                ? { backgroundColor: SECONDARY_CURRENCY_COLOR }
                : undefined
            }
          >
            Mis Accesorios ({ownedIds.length})
          </button>
        </div>
      </section>

      {viewMode === 'daily' ? (
        <div className="space-y-3">
          {dailyRemaining === 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-200">
              Ya realizaste tus {ACCESSORY_DAILY_PURCHASE_LIMIT} compras de accesorios permitidas hoy ({localDateKey}). Se reinicia a las 00:00 hora local.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rotation.items.map((item) => {
              const owned = ownedSet.has(item.id);
              const equipped = equippedById.has(item.id);
              const rarity = getRarityMeta(item.rarity);
              const canAfford = secondaryBalance >= item.price;
              const capped = dailyBought >= ACCESSORY_DAILY_PURCHASE_LIMIT;
              const blockedReason = owned
                ? null
                : capped
                ? `Tope diario (${ACCESSORY_DAILY_PURCHASE_LIMIT}/${ACCESSORY_DAILY_PURCHASE_LIMIT})`
                : !canAfford
                ? `Faltan ${item.price - secondaryBalance} ${SECONDARY_CURRENCY_NAME}`
                : null;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 flex flex-col justify-between gap-3 transition-colors ${
                    owned
                      ? 'bg-[#081312] border-teal-500/45'
                      : 'bg-[#0A0B0F] border-[#1B1E26]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className="w-11 h-11 rounded-xl border flex items-center justify-center text-2xl shrink-0"
                        style={{
                          borderColor: `${item.accentColor}66`,
                          background: `radial-gradient(circle, ${item.accentColor}24 0%, #05070B 75%)`,
                        }}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400">
                            {item.anime}
                          </span>
                          <span className="text-[10px] text-slate-600">·</span>
                          <span className={`text-[10px] font-black ${rarity.textClass}`}>
                            {rarity.label}
                          </span>
                          <span className="text-[10px] text-slate-600">·</span>
                          <span className="text-[10px] font-bold text-slate-300">
                            {ACCESSORY_SLOT_ICONS[item.slot]} {ACCESSORY_SLOT_LABELS[item.slot]}
                          </span>
                        </div>
                        <h4 className="text-sm font-black text-white truncate mt-0.5">
                          {item.name}
                        </h4>
                        <p className="text-[11px] text-slate-400 leading-snug mt-0.5">
                          {item.description}
                        </p>
                        <p
                          className="text-[10px] font-semibold mt-1"
                          style={{ color: item.accentColor }}
                        >
                          ✦ {item.roomVisualNote}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-[#1B1E26]/80 flex items-center justify-between gap-2">
                    {owned ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-xs font-black text-teal-300">
                          <Check className="w-3.5 h-3.5" />
                          Ya en tu inventario
                        </span>
                        <button
                          type="button"
                          onClick={() => onEquipAccessory(item.id)}
                          className={`min-h-[38px] px-3.5 rounded-lg text-xs font-black border transition ${
                            equipped
                              ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                              : 'bg-[#101218] border-[#1B1E26] text-white hover:border-teal-400'
                          }`}
                        >
                          {equipped ? 'Equipado (Quitar)' : 'Equipar ahora'}
                        </button>
                      </>
                    ) : (
                      <>
                        <div
                          className="text-sm font-black tabular-nums"
                          style={{ color: SECONDARY_CURRENCY_COLOR }}
                        >
                          {SECONDARY_CURRENCY_ICON} {item.price} {SECONDARY_CURRENCY_NAME}
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(blockedReason)}
                          onClick={() => onBuyAccessory(item.id)}
                          className={`min-h-[38px] px-3.5 rounded-lg text-xs font-black inline-flex items-center gap-1.5 transition ${
                            blockedReason
                              ? 'bg-[#101218] border border-[#1B1E26] text-slate-400 cursor-not-allowed opacity-70'
                              : 'text-slate-950 hover:brightness-110 active:scale-[0.98]'
                          }`}
                          style={
                            !blockedReason
                              ? { backgroundColor: SECONDARY_CURRENCY_COLOR }
                              : undefined
                          }
                        >
                          {blockedReason ? (
                            <>
                              <Lock className="w-3.5 h-3.5" />
                              <span>{blockedReason}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Comprar</span>
                            </>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(['all', 'helm', 'armor', 'ring', 'amulet'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setSlotFilter(f)}
                className={`min-h-[34px] px-3 rounded-lg text-xs font-bold border transition ${
                  slotFilter === f
                    ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                    : 'bg-[#0A0B0F] border-[#1B1E26] text-slate-400 hover:text-white'
                }`}
              >
                {f === 'all'
                  ? `Todos (${ownedIds.length})`
                  : `${ACCESSORY_SLOT_ICONS[f]} ${ACCESSORY_SLOT_LABELS[f]}`}
              </button>
            ))}
          </div>

          {ownedDefs.length === 0 ? (
            <div className="rounded-xl border border-[#1B1E26] bg-[#0A0B0F] p-6 text-center text-xs text-slate-400">
              Todavía no tienes accesorios en esta categoría. Revisa la rotación diaria y junta{' '}
              <strong style={{ color: SECONDARY_CURRENCY_COLOR }}>
                {SECONDARY_CURRENCY_ICON} {SECONDARY_CURRENCY_NAME}
              </strong>{' '}
              en la Torre Anime o Modo Historia.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {ownedDefs.map((item) => {
                const equipped = equippedById.has(item.id);
                const rarity = getRarityMeta(item.rarity);
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-3.5 flex items-center justify-between gap-3 ${
                      equipped
                        ? 'bg-[#081312] border-teal-400/60'
                        : 'bg-[#0A0B0F] border-[#1B1E26]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-xl border flex items-center justify-center text-xl shrink-0"
                        style={{
                          borderColor: `${item.accentColor}66`,
                          background: `radial-gradient(circle, ${item.accentColor}24 0%, #05070B 75%)`,
                        }}
                      >
                        {item.icon}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[10px] font-bold text-slate-400 truncate">
                          {item.anime} ·{' '}
                          <span className={rarity.textClass}>{rarity.label}</span>
                        </div>
                        <div className="text-sm font-black text-white truncate">
                          {item.name}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          {ACCESSORY_SLOT_ICONS[item.slot]} {ACCESSORY_SLOT_LABELS[item.slot]}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onEquipAccessory(item.id)}
                      className={`min-h-[38px] px-3 rounded-lg text-xs font-black border shrink-0 transition ${
                        equipped
                          ? 'bg-teal-500/20 border-teal-400 text-teal-200'
                          : 'bg-[#101218] border-[#1B1E26] text-white hover:border-teal-400'
                      }`}
                    >
                      {equipped ? 'Equipado' : 'Equipar'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
