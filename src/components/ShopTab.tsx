import { useEffect, useMemo, useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { getCharacterEnergyProfile } from '../data/movesets';
import {
  DAILY_ITEM_PURCHASE_LIMIT,
  DAILY_PVP_XP_CAP,
  getCategoryLabel,
  getCharacterShopPrice,
  getDailyShopRotation,
  getResaleValue,
  getShopItemById,
  getUnlockedCharacterIds,
  getUserDailyShopPurchasesCount,
  getUserPvpDailyXpEarned,
  isSingleOwnershipCosmetic,
  RESALE_RATE,
  toShopLocalDateKey,
} from '../data/shopCatalog';
import {
  EquippedCosmetics,
  ShopItemDef,
  ShopItemRarity,
  UserProfile,
} from '../types/animefit';
import {
  getOwnedAccessoryIds,
  SECONDARY_CURRENCY_ICON,
  SECONDARY_CURRENCY_NAME,
} from '../data/accessoriesCatalog';
import { getActiveCharacterStage, getCharacterById } from '../utils/animefit';
import { AccessoryShopPanel } from './AccessoryShopPanel';
import { CharacterAvatar } from './CharacterAvatar';

interface ShopTabProps {
  user: UserProfile;
  onBuyItem: (itemId: string) => void;
  onBuyCharacter: (charId: string) => void;
  onSellItem: (itemId: string) => void;
  onUseXpCapsule: (itemId: string) => void;
  onEquipCosmetic: (slot: keyof EquippedCosmetics, itemId: string | undefined) => void;
  onSwitchCharacter: (charId: string) => void;
  onBuyAccessory: (accessoryId: string) => void;
  onEquipAccessory: (
    accessoryId: string | null,
    slotOverride?: keyof NonNullable<UserProfile['equippedAccessories']>
  ) => void;
}

type ShopSubTab = 'daily' | 'inventory' | 'warriors' | 'accessories';

function getRarityLabel(rarity: ShopItemRarity): { label: string; colorClass: string } {
  switch (rarity) {
    case 'legendario':
      return { label: 'Legendario', colorClass: 'text-amber-300' };
    case 'épico':
      return { label: 'Épico', colorClass: 'text-violet-300' };
    case 'raro':
      return { label: 'Raro', colorClass: 'text-sky-300' };
    default:
      return { label: 'Común', colorClass: 'text-slate-300' };
  }
}

function getRarityAccent(rarity: ShopItemRarity): string {
  switch (rarity) {
    case 'legendario':
      return '#F59E0B';
    case 'épico':
      return '#A855F7';
    case 'raro':
      return '#38BDF8';
    default:
      return '#94A3B8';
  }
}

function getCosmeticSlotForItem(item: ShopItemDef): keyof EquippedCosmetics | null {
  switch (item.category) {
    case 'cosmetic_aura':
      return 'auraId';
    case 'cosmetic_title':
      return 'titleId';
    case 'cosmetic_emblem':
      return 'emblemId';
    case 'pvp_intro':
      return 'pvpIntroId';
    case 'pvp_finisher':
      return 'pvpFinisherId';
    default:
      return null;
  }
}

function formatCountdownToLocalMidnight(now: Date): string {
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0);
  const diffSec = Math.max(0, Math.floor((tomorrow.getTime() - now.getTime()) / 1000));
  const h = Math.floor(diffSec / 3600);
  const m = Math.floor((diffSec % 3600) / 60);
  const s = diffSec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ShopTab({
  user,
  onBuyItem,
  onBuyCharacter,
  onSellItem,
  onUseXpCapsule,
  onEquipCosmetic,
  onSwitchCharacter,
  onBuyAccessory,
  onEquipAccessory,
}: ShopTabProps) {
  const [subTab, setSubTab] = useState<ShopSubTab>('daily');
  const [now, setNow] = useState(() => new Date());
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const localDateKey = toShopLocalDateKey(now);
  const rotation = useMemo(() => getDailyShopRotation(localDateKey), [localDateKey]);
  const countdown = formatCountdownToLocalMidnight(now);

  const coins = Math.max(0, Math.floor(Number(user.coins || 0)));
  const dailyPurchasesUsed = getUserDailyShopPurchasesCount(user, localDateKey);
  const dailyPurchasesLeft = Math.max(0, DAILY_ITEM_PURCHASE_LIMIT - dailyPurchasesUsed);
  const dailyPvpXpEarned = getUserPvpDailyXpEarned(user, localDateKey);
  const unlockedIds = useMemo(() => getUnlockedCharacterIds(user), [user]);
  const unlockedSet = useMemo(() => new Set(unlockedIds), [unlockedIds]);

  const inventoryEntries = useMemo(() => {
    const raw = Array.isArray(user.inventory) ? user.inventory : [];
    return raw
      .filter((e) => Number(e.quantity || 0) > 0)
      .map((entry) => ({
        entry,
        item: getShopItemById(entry.itemId),
      }))
      .filter((row): row is { entry: (typeof raw)[number]; item: ShopItemDef } => Boolean(row.item));
  }, [user.inventory]);

  const filteredInventory = useMemo(() => {
    if (categoryFilter === 'all') return inventoryEntries;
    if (categoryFilter === 'consumables') {
      return inventoryEntries.filter(
        ({ item }) =>
          item.category === 'xp_capsule' ||
          item.category === 'combat_consumable' ||
          item.category === 'survival_support'
      );
    }
    if (categoryFilter === 'cosmetics') {
      return inventoryEntries.filter(
        ({ item }) =>
          item.category === 'cosmetic_aura' ||
          item.category === 'cosmetic_title' ||
          item.category === 'cosmetic_emblem' ||
          item.category === 'victory_quote'
      );
    }
    if (categoryFilter === 'pvp') {
      return inventoryEntries.filter(
        ({ item }) =>
          item.category === 'pvp_intro' ||
          item.category === 'pvp_emote' ||
          item.category === 'pvp_finisher'
      );
    }
    return inventoryEntries;
  }, [inventoryEntries, categoryFilter]);

  const equipped = user.equippedCosmetics || {};
  const equippedSummary = [
    { slot: 'auraId' as const, label: 'Aura', id: equipped.auraId },
    { slot: 'titleId' as const, label: 'Título', id: equipped.titleId },
    { slot: 'emblemId' as const, label: 'Emblema', id: equipped.emblemId },
    { slot: 'pvpIntroId' as const, label: 'Intro PvP', id: equipped.pvpIntroId },
    { slot: 'pvpFinisherId' as const, label: 'Remate PvP', id: equipped.pvpFinisherId },
  ];

  const isCosmeticEquipped = (itemId: string): boolean =>
    equipped.auraId === itemId ||
    equipped.titleId === itemId ||
    equipped.emblemId === itemId ||
    equipped.pvpIntroId === itemId ||
    equipped.pvpFinisherId === itemId;

  return (
    <div className="space-y-5 animate-fadeIn pb-8">
      {/* Encabezado y LEDGER claro */}
      <section className="rounded-xl border border-[#1B1E26] bg-[#07080B] p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-amber-400">
              Bazar Multiverso Animefit
            </p>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Tienda Diaria e Inventario
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              6 ítems + 2 guerreros Fase 1 rotan cada medianoche según tu reloj local · Reventa al {Math.round(RESALE_RATE * 100)}%.
            </p>
          </div>
          <div className="flex items-center gap-3 self-start sm:self-auto rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5">
            <span className="text-2xl leading-none" aria-hidden="true">🪙</span>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300/80">
                Saldo Disponible
              </div>
              <div className="text-xl font-black text-amber-300 tabular-nums leading-tight">
                {coins.toLocaleString('es-ES')} <span className="text-xs font-bold">monedas</span>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs diarios sin ruido visual */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="rounded-lg border border-[#1B1E26] bg-[#0A0B0F] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Rotación Local
            </div>
            <div className="mt-1 text-sm font-black text-white tabular-nums">
              {localDateKey}
            </div>
            <div className="text-[11px] text-slate-400 tabular-nums">
              Renueva en {countdown}
            </div>
          </div>

          <div className="rounded-lg border border-[#1B1E26] bg-[#0A0B0F] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Compras Diarias Ítems
            </div>
            <div
              className={`mt-1 text-sm font-black tabular-nums ${
                dailyPurchasesLeft === 0 ? 'text-rose-400' : 'text-emerald-300'
              }`}
            >
              {dailyPurchasesUsed} / {DAILY_ITEM_PURCHASE_LIMIT} hoy
            </div>
            <div className="text-[11px] text-slate-400">
              {dailyPurchasesLeft === 0
                ? 'Límite diario alcanzado'
                : `Te quedan ${dailyPurchasesLeft} compras hoy`}
            </div>
          </div>

          <div className="rounded-lg border border-[#1B1E26] bg-[#0A0B0F] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Tope XP PvP Hoy
            </div>
            <div
              className={`mt-1 text-sm font-black tabular-nums ${
                dailyPvpXpEarned >= DAILY_PVP_XP_CAP ? 'text-amber-300' : 'text-sky-300'
              }`}
            >
              {dailyPvpXpEarned} / {DAILY_PVP_XP_CAP} XP
            </div>
            <div className="text-[11px] text-slate-400">
              {dailyPvpXpEarned >= DAILY_PVP_XP_CAP
                ? 'Duelos libres (0 XP hasta mañana)'
                : 'Solo en Arena Pública'}
            </div>
          </div>

          <div className="rounded-lg border border-[#1B1E26] bg-[#0A0B0F] px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Guerreros & Mochila
            </div>
            <div className="mt-1 text-sm font-black text-white tabular-nums">
              {unlockedIds.length}/{CHARACTERS.length} · {inventoryEntries.reduce((s, r) => s + r.entry.quantity, 0)} ítems
            </div>
            <div className="text-[11px] text-slate-400 truncate">
              Activo: {getCharacterById(user.charId).name}
            </div>
          </div>
        </div>

        {/* Sub-navegación */}
        <div className="flex flex-wrap gap-2 border-t border-[#1B1E26] pt-3">
          {(
            [
              { id: 'daily', label: 'Tienda Diaria (6 + 2)' },
              {
                id: 'accessories',
                label: `${SECONDARY_CURRENCY_ICON} Accesorios (${SECONDARY_CURRENCY_NAME} · ${getOwnedAccessoryIds(user).length})`,
              },
              {
                id: 'inventory',
                label: `Inventario y Estética (${inventoryEntries.reduce((s, r) => s + r.entry.quantity, 0)})`,
              },
              {
                id: 'warriors',
                label: `Guerreros (${unlockedIds.length}/${CHARACTERS.length})`,
              },
            ] as const
          ).map((tab) => {
            const active = subTab === tab.id;
            const isAccTab = tab.id === 'accessories';
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSubTab(tab.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition whitespace-nowrap shrink-0 border ${
                  active
                    ? isAccTab
                      ? 'bg-[#2DD4BF] text-slate-950 border-teal-300'
                      : 'bg-amber-500 text-slate-950 border-amber-400'
                    : isAccTab
                    ? 'bg-[#071112] text-teal-300 border-teal-500/40 hover:border-teal-300'
                    : 'bg-[#0A0B0F] text-slate-300 border-[#1B1E26] hover:border-slate-500 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* SUBTAB 1: TIENDA DIARIA */}
      {subTab === 'daily' && (
        <div className="space-y-6">
          {dailyPurchasesLeft === 0 && (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
              Alcanzaste el límite diario de compras de ítems ({DAILY_ITEM_PURCHASE_LIMIT}/{DAILY_ITEM_PURCHASE_LIMIT} hoy). Volverá a habilitarse a las 00:00 según tu reloj local.
            </div>
          )}

          {/* 6 Ítems Diarios */}
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-white">
                  Selección Diaria de Ítems (6 disponibles hoy)
                </h3>
                <p className="text-xs text-slate-400">
                  Todos los objetos pertenecen a los animes del juego · Los cosméticos PvP no alteran daño ni HP en PvP.
                </p>
              </div>
              <span className="text-xs font-bold text-slate-400 tabular-nums whitespace-nowrap">
                {dailyPurchasesLeft}/{DAILY_ITEM_PURCHASE_LIMIT} cupos hoy
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rotation.items.map((item) => {
                const rarityInfo = getRarityLabel(item.rarity);
                const accent = getRarityAccent(item.rarity);
                const ownedEntry = (user.inventory || []).find((e) => e.itemId === item.id);
                const ownedQty = ownedEntry ? Math.max(0, Number(ownedEntry.quantity || 0)) : 0;
                const singleOwned = isSingleOwnershipCosmetic(item.category) && ownedQty > 0;
                const canAfford = coins >= item.price;
                const dailyCapped = dailyPurchasesUsed >= DAILY_ITEM_PURCHASE_LIMIT;
                const resale = getResaleValue(item.price);
                const balanceAfter = coins - item.price;
                const blockedReason = singleOwned
                  ? 'Ya lo tienes en inventario'
                  : dailyCapped
                  ? `Tope diario (${DAILY_ITEM_PURCHASE_LIMIT}/5)`
                  : !canAfford
                  ? `Faltan ${(item.price - coins).toLocaleString('es-ES')} monedas`
                  : null;

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#1B1E26] bg-[#0A0B0F] p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3 min-w-0">
                          <div
                            className="w-11 h-11 rounded-lg border flex items-center justify-center text-2xl shrink-0"
                            style={{
                              borderColor: `${accent}55`,
                              backgroundColor: `${accent}14`,
                            }}
                          >
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-white leading-snug">
                              {item.name}
                            </h4>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                              {item.anime} · {getCategoryLabel(item.category)} ·{' '}
                              <span className={`font-bold ${rarityInfo.colorClass}`}>
                                {rarityInfo.label}
                              </span>
                            </p>
                          </div>
                        </div>
                        {ownedQty > 0 && (
                          <span className="text-[11px] font-bold text-emerald-300 tabular-nums whitespace-nowrap">
                            En mochila: x{ownedQty}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300 leading-relaxed">
                        {item.description}
                      </p>

                      {item.effectKind === 'auto_revive' && (
                        <p className="text-[11px] text-amber-300/90">
                          Límite estricto: máx. 1 uso por combate de Historia · máx. 2 usos acumulados en toda la racha de Supervivencia.
                        </p>
                      )}
                      {item.category.startsWith('pvp_') && (
                        <p className="text-[11px] text-sky-300/80">
                          Ambiental PvP: efecto visual/sonoro sin ventaja estadística en combate.
                        </p>
                      )}
                    </div>

                    <div className="border-t border-[#1B1E26] pt-3 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                        <div>
                          <span className="text-slate-400">Precio: </span>
                          <span className="font-black text-amber-300 tabular-nums">
                            {item.price.toLocaleString('es-ES')} 🪙
                          </span>
                        </div>
                        <div className="text-slate-400 tabular-nums">
                          Reventa 70%: <span className="text-slate-200 font-bold">+{resale} 🪙</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="text-[11px] text-slate-400 tabular-nums">
                          {canAfford ? (
                            <>
                              Saldo: <span className="text-slate-200">{coins}</span> →{' '}
                              <span className="text-amber-300 font-bold">{balanceAfter} 🪙</span>
                            </>
                          ) : (
                            <span className="text-rose-400">
                              Faltan {(item.price - coins).toLocaleString('es-ES')} 🪙
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          disabled={Boolean(blockedReason)}
                          onClick={() => onBuyItem(item.id)}
                          className={`px-3.5 py-2 rounded-lg text-xs font-black transition whitespace-nowrap shrink-0 ${
                            blockedReason
                              ? 'bg-[#151820] text-slate-500 border border-[#1B1E26] cursor-not-allowed'
                              : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          }`}
                        >
                          {blockedReason ? blockedReason : `Comprar (${item.price} 🪙)`}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* 2 Personajes Diarios (Fase 1) */}
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-black text-white">
                Guerreros Destacados del Día (2 disponibles hoy · Fase 1)
              </h3>
              <p className="text-xs text-slate-400">
                Los personajes desbloqueados en tienda arrancan en Fase 1 y evolucionan por sus fases conforme sumas XP entrenando y combatiendo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rotation.characters.map((char) => {
                const price = getCharacterShopPrice(char);
                const energy = getCharacterEnergyProfile(char.id);
                const phase1 = char.stages[0];
                const isUnlocked = unlockedSet.has(char.id);
                const isActive = user.charId === char.id;
                const canAfford = coins >= price;
                const balanceAfter = coins - price;

                return (
                  <div
                    key={char.id}
                    className="rounded-xl border border-[#1B1E26] bg-[#0A0B0F] p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start gap-3.5">
                      <CharacterAvatar
                        charId={char.id}
                        stageName={phase1.phase}
                        level={1}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-base font-black text-white truncate">
                            {char.name}
                          </h4>
                          {isUnlocked && (
                            <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap">
                              Desbloqueado
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {char.anime} · Energía: <span className="text-slate-200 font-semibold">{energy.name}</span>
                        </p>
                        <p className="text-xs text-slate-300 mt-1.5">
                          Inicia en <strong className="text-white">{phase1.phase}</strong> (Fase 1 de {char.stages.length})
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          Recarga: {energy.chargeLabel} · Desbloqueo permanente en roster
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-[#1B1E26] pt-3 flex items-center justify-between gap-3">
                      <div className="text-xs tabular-nums">
                        {isUnlocked ? (
                          <span className="text-emerald-300 font-bold">
                            {isActive ? 'Guerrero activo actualmente' : 'Listo en tu roster'}
                          </span>
                        ) : (
                          <div>
                            <div className="font-black text-amber-300">
                              {price.toLocaleString('es-ES')} 🪙
                            </div>
                            <div className="text-[11px] text-slate-400">
                              {canAfford
                                ? `Saldo: ${coins} → ${balanceAfter} 🪙`
                                : `Faltan ${(price - coins).toLocaleString('es-ES')} 🪙`}
                            </div>
                          </div>
                        )}
                      </div>

                      {isUnlocked ? (
                        <button
                          type="button"
                          disabled={isActive}
                          onClick={() => onSwitchCharacter(char.id)}
                          className={`px-3.5 py-2 rounded-lg text-xs font-black transition whitespace-nowrap shrink-0 ${
                            isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                              : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                          }`}
                        >
                          {isActive ? 'Activo ✓' : 'Usar Guerrero'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={!canAfford}
                          onClick={() => onBuyCharacter(char.id)}
                          className={`px-3.5 py-2 rounded-lg text-xs font-black transition whitespace-nowrap shrink-0 ${
                            canAfford
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                              : 'bg-[#151820] text-slate-500 border border-[#1B1E26] cursor-not-allowed'
                          }`}
                        >
                          {canAfford ? `Reclutar Fase 1 (${price} 🪙)` : 'Monedas insuficientes'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      {/* SUBTAB 2: INVENTARIO Y ESTÉTICA */}
      {subTab === 'inventory' && (
        <div className="space-y-5">
          {/* Equipamiento activo */}
          <section className="rounded-xl border border-[#1B1E26] bg-[#07080B] p-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-white">
                  Estética y Cosméticos Equipados
                </h3>
                <p className="text-xs text-slate-400">
                  Se muestran en Guerrero, Historia, Supervivencia y PvP (sin alterar stats de combate PvP).
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
              {equippedSummary.map((slotRow) => {
                const item = slotRow.id ? getShopItemById(slotRow.id) : undefined;
                return (
                  <div
                    key={slotRow.slot}
                    className="rounded-lg border border-[#1B1E26] bg-[#0A0B0F] p-3 flex flex-col justify-between gap-2"
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {slotRow.label}
                      </div>
                      <div className="mt-1 text-xs font-bold text-white truncate">
                        {item ? `${item.icon} ${item.name}` : 'Sin equipar'}
                      </div>
                    </div>
                    {item && (
                      <button
                        type="button"
                        onClick={() => onEquipCosmetic(slotRow.slot, undefined)}
                        className="self-start text-[11px] font-bold text-rose-300 hover:text-rose-200"
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          {/* Filtro */}
          <div className="flex flex-wrap gap-2">
            {(
              [
                { id: 'all', label: 'Todo' },
                { id: 'consumables', label: 'Cápsulas & Tácticos' },
                { id: 'cosmetics', label: 'Auras, Títulos & Frases' },
                { id: 'pvp', label: 'Estilo PvP' },
              ] as const
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setCategoryFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition whitespace-nowrap shrink-0 ${
                  categoryFilter === f.id
                    ? 'bg-slate-200 text-slate-950 border-slate-200'
                    : 'bg-[#0A0B0F] text-slate-400 border-[#1B1E26] hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredInventory.length === 0 ? (
            <div className="rounded-xl border border-[#1B1E26] bg-[#0A0B0F] p-6 text-center space-y-2">
              <p className="text-sm font-bold text-white">Tu mochila está vacía en esta categoría</p>
              <p className="text-xs text-slate-400">
                Entrena, supera capítulos de Historia o compite en Supervivencia y PvP Público para ganar monedas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredInventory.map(({ entry, item }) => {
                const slot = getCosmeticSlotForItem(item);
                const equippedNow = isCosmeticEquipped(item.id);
                const resale = getResaleValue(entry.lastBuyPrice ?? item.price);
                const balanceAfterSell = coins + resale;
                const rarityInfo = getRarityLabel(item.rarity);

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#1B1E26] bg-[#0A0B0F] p-4 flex flex-col justify-between gap-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-lg border border-[#1B1E26] bg-[#07080B] flex items-center justify-center text-xl shrink-0">
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-sm font-black text-white">
                              {item.name} <span className="text-amber-300 tabular-nums">x{entry.quantity}</span>
                            </h4>
                            <p className="text-[11px] text-slate-400">
                              {item.anime} · {getCategoryLabel(item.category)} ·{' '}
                              <span className={`font-bold ${rarityInfo.colorClass}`}>
                                {rarityInfo.label}
                              </span>
                            </p>
                          </div>
                        </div>
                        {equippedNow && (
                          <span className="text-[11px] font-bold text-emerald-300 whitespace-nowrap">
                            Equipado ✓
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-300">{item.description}</p>
                    </div>

                    <div className="border-t border-[#1B1E26] pt-3 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.category === 'xp_capsule' && (
                          <button
                            type="button"
                            onClick={() => onUseXpCapsule(item.id)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black whitespace-nowrap shrink-0"
                          >
                            Usar (+{item.effectValue || 0} XP)
                          </button>
                        )}
                        {slot && (
                          <button
                            type="button"
                            onClick={() =>
                              onEquipCosmetic(slot, equippedNow ? undefined : item.id)
                            }
                            className={`px-3 py-1.5 rounded-lg text-xs font-black whitespace-nowrap shrink-0 ${
                              equippedNow
                                ? 'bg-[#151820] text-slate-200 border border-[#1B1E26] hover:border-slate-500'
                                : 'bg-sky-500 hover:bg-sky-400 text-slate-950'
                            }`}
                          >
                            {equippedNow ? 'Desequipar' : 'Equipar'}
                          </button>
                        )}
                        {item.category === 'victory_quote' && (
                          <span className="text-[11px] text-emerald-300">
                            Activa al ganar duelos
                          </span>
                        )}
                        {item.category === 'pvp_emote' && (
                          <span className="text-[11px] text-sky-300">
                            Disponible en barra de Emotes PvP
                          </span>
                        )}
                        {(item.category === 'combat_consumable' ||
                          item.category === 'survival_support') && (
                          <span className="text-[11px] text-amber-300">
                            Úsalo en combate de Historia / Supervivencia
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => onSellItem(item.id)}
                        className="px-3 py-1.5 rounded-lg border border-amber-500/35 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 text-xs font-bold tabular-nums whitespace-nowrap shrink-0"
                      >
                        Vender 1 (+{resale} 🪙 · {coins}→{balanceAfterSell})
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 3: GUERREROS DESBLOQUEADOS */}
      {subTab === 'warriors' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-[#1B1E26] bg-[#07080B] px-4 py-3 text-xs text-slate-300">
            Cambia entre tus guerreros desbloqueados. Cada personaje adquirido en la tienda comienza en <strong>Fase 1</strong> y avanza sus transformaciones conforme sigues ganando XP.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {CHARACTERS.filter((c) => unlockedSet.has(c.id)).map((char) => {
              const stageInfo = getActiveCharacterStage(user, char.id);
              const isActive = user.charId === char.id;
              const energy = getCharacterEnergyProfile(char.id);
              const hasOffset = Number(user.charXpOffsets?.[char.id] || 0) > 0;

              return (
                <div
                  key={char.id}
                  className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
                    isActive
                      ? 'border-amber-400/60 bg-amber-500/10'
                      : 'border-[#1B1E26] bg-[#0A0B0F]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CharacterAvatar
                      charId={char.id}
                      stageName={stageInfo.stageName}
                      level={stageInfo.effectiveLevel}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-white truncate">
                        {char.name}
                      </h4>
                      <p className="text-xs text-slate-300 truncate">
                        {stageInfo.stageName} (Fase {stageInfo.stageIndex + 1}/{char.stages.length})
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {char.anime} · {energy.name}
                        {hasOffset ? ' · Desbloqueado en Fase 1' : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={isActive}
                    onClick={() => onSwitchCharacter(char.id)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-black transition whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 cursor-default'
                        : 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                    }`}
                  >
                    {isActive ? 'Activo ✓' : 'Elegir'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* SUBTAB 4: MINI-TIENDA SEPARADA DE ACCESORIOS (MONEDA SECUNDARIA) */}
      {subTab === 'accessories' && (
        <AccessoryShopPanel
          user={user}
          onBuyAccessory={onBuyAccessory}
          onEquipAccessory={onEquipAccessory}
        />
      )}
    </div>
  );
}
