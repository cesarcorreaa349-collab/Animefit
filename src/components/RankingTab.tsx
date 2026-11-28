import { useMemo, useState } from 'react';
import { Bell, Check, UserPlus } from 'lucide-react';
import {
  CommunityGroup,
  RankingSubTab,
  UserProfile,
} from '../types/animefit';
import {
  getActiveCharacterStage,
  getCharacterById,
  getCharacterStage,
  getExerciseById,
  getLevelInfo,
} from '../utils/animefit';
import { CharacterAvatar } from './CharacterAvatar';
import { Modal } from './Modal';

interface RankingTabProps {
  currentUser: UserProfile;
  allUsers: Record<string, UserProfile>;
  groups: CommunityGroup[];
  onToggleFriend: (targetUsername: string) => void;
  onAddFriendByName: (targetUsername: string) => void;
  onCloneRoutine: (authorUsername: string, routineId: string) => void;
  onToggleGroup: (groupId: string) => void;
  onCreateGroup: (name: string, desc: string) => void;
  onChallengeFriend?: (username: string) => void;
  onMarkFriendNotificationsRead?: (ids?: string[]) => void;
}

export function RankingTab({
  currentUser,
  allUsers,
  groups,
  onToggleFriend,
  onAddFriendByName,
  onCloneRoutine,
  onToggleGroup,
  onCreateGroup,
  onChallengeFriend,
  onMarkFriendNotificationsRead,
}: RankingTabProps) {
  const [subTab, setSubTab] = useState<RankingSubTab>('global');
  const [friendInput, setFriendInput] = useState('');
  const [createGroupOpen, setCreateGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');

  const leaderboard = useMemo(
    () => Object.values(allUsers).sort((a, b) => (b.xp || 0) - (a.xp || 0)),
    [allUsers]
  );

  const publicRoutines = useMemo(() => {
    const list: { routine: UserProfile['routines'][number]; user: UserProfile }[] = [];
    Object.values(allUsers).forEach((u) => {
      (u.routines || []).forEach((r) => {
        if (r.published) list.push({ routine: r, user: u });
      });
    });
    return list;
  }, [allUsers]);

  const friends = currentUser.friends || [];
  const friendNotifications = useMemo(
    () =>
      (currentUser.friendNotifications || []).filter(
        (n) => !n.read && n.fromUsername !== currentUser.username
      ),
    [currentUser.friendNotifications, currentUser.username]
  );

  const otherUsers = useMemo(
    () =>
      Object.values(allUsers).filter(
        (u) => u.username !== currentUser.username
      ),
    [allUsers, currentUser.username]
  );

  return (
    <div className="flex flex-col gap-5">
      {friendNotifications.length > 0 && (
        <section className="bg-[#0A0B0F] border border-[#38BDF8]/50 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#101218] border border-[#1B1E26] flex items-center justify-center text-[#38BDF8] shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm font-extrabold text-[#F1F5F9]">
                  Nuevos amigos ({friendNotifications.length})
                </h2>
                <p className="text-xs text-[#8A92A2]">
                  Guerreros que te agregaron recientemente
                </p>
              </div>
            </div>
            {onMarkFriendNotificationsRead && (
              <button
                type="button"
                onClick={() => onMarkFriendNotificationsRead()}
                className="min-h-[36px] px-3 rounded-lg bg-[#101218] border border-[#1B1E26] hover:border-[#38BDF8] text-xs font-bold text-[#8A92A2] hover:text-[#F1F5F9] inline-flex items-center gap-1.5 whitespace-nowrap"
              >
                <Check className="w-3.5 h-3.5 text-[#22C55E]" />
                Marcar vistas
              </button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {friendNotifications.map((notif) => {
              const senderUser = allUsers[notif.fromUsername];
              const charId = senderUser?.charId || notif.fromCharId || 'goku';
              const level = senderUser
                ? getLevelInfo(senderUser.xp || 0).level
                : notif.fromLevel || 1;
              const alreadyFriend = friends.includes(notif.fromUsername);
              const dateLabel = new Date(notif.createdAt).toLocaleDateString(
                'es-ES',
                { day: 'numeric', month: 'short' }
              );
              return (
                <div
                  key={notif.id}
                  className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <CharacterAvatar
                      charId={charId}
                      stageName={getCharacterStage(charId, level).stageName}
                      level={level}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#F1F5F9] truncate">
                        {notif.fromUsername}{' '}
                        <span className="text-xs font-normal text-[#8A92A2]">
                          te agregó como amigo
                        </span>
                      </div>
                      <div className="text-xs text-[#8A92A2] tabular-nums">
                        Nv.{level} · {dateLabel}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {!alreadyFriend ? (
                      <button
                        type="button"
                        onClick={() => {
                          onToggleFriend(notif.fromUsername);
                          onMarkFriendNotificationsRead?.([notif.id]);
                        }}
                        className="min-h-[38px] px-3 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-extrabold inline-flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <UserPlus className="w-3.5 h-3.5" />
                        Agregar
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onMarkFriendNotificationsRead?.([notif.id])
                        }
                        className="min-h-[38px] px-3 rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#22C55E] whitespace-nowrap"
                      >
                        ✓ Amigo
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
      <div className="flex items-center justify-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSubTab('global')}
          className={`min-h-[42px] px-4 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 border transition-colors ${
            subTab === 'global'
              ? 'bg-[#FACC15]/18 text-[#FACC15] border-[#FACC15]'
              : 'bg-[#101218] text-[#8A92A2] border-[#1B1E26] hover:text-[#F1F5F9]'
          }`}
        >
          🏆 Ranking Global
        </button>
        <button
          type="button"
          onClick={() => setSubTab('publicas')}
          className={`min-h-[42px] px-4 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 border transition-colors ${
            subTab === 'publicas'
              ? 'bg-[#38BDF8]/18 text-[#38BDF8] border-[#38BDF8]'
              : 'bg-[#101218] text-[#8A92A2] border-[#1B1E26] hover:text-[#F1F5F9]'
          }`}
        >
          🌐 Rutinas Públicas ({publicRoutines.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('social')}
          className={`min-h-[42px] px-4 rounded-full text-xs sm:text-sm font-bold whitespace-nowrap shrink-0 border transition-colors ${
            subTab === 'social'
              ? 'bg-[#38BDF8]/18 text-[#38BDF8] border-[#38BDF8]'
              : 'bg-[#101218] text-[#8A92A2] border-[#1B1E26] hover:text-[#F1F5F9]'
          }`}
        >
          👥 Amigos y Grupos
        </button>
      </div>

      {subTab === 'global' && (
        <section className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-base font-extrabold text-[#F1F5F9]">
              Top Guerreros por Ki (XP)
            </h2>
            <span className="text-xs text-[#8A92A2] tabular-nums">
              {leaderboard.length} guerreros
            </span>
          </div>

          <div className="flex flex-col gap-2.5">
            {leaderboard.map((u, idx) => {
              const lv = getLevelInfo(u.xp || 0);
              const st = getActiveCharacterStage(u);
              const isMe = u.username === currentUser.username;
              const isFriend = friends.includes(u.username);
              return (
                <div
                  key={u.username}
                  className={`flex items-center justify-between gap-3 px-3.5 py-3 rounded-xl bg-[#07080B] border ${
                    isMe ? 'border-[#FACC15]' : 'border-[#1B1E26]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-7 text-center font-black text-base tabular-nums shrink-0 ${
                        idx < 3 ? 'text-[#FACC15]' : 'text-[#8A92A2]'
                      }`}
                    >
                      #{idx + 1}
                    </span>
                    <CharacterAvatar
                      charId={st.char.id}
                      stageName={st.stageName}
                      level={lv.level}
                      size="sm"
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-[#F1F5F9] truncate">
                        {u.username}{' '}
                        {isMe && (
                          <span className="text-xs font-extrabold text-[#FACC15]">
                            · Tú
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#8A92A2] truncate">
                        {st.char.name} · {st.stageName}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right tabular-nums">
                      <div className="text-sm font-black text-[#38BDF8]">
                        Nv.{lv.level}
                      </div>
                      <div className="text-xs text-[#8A92A2]">
                        {u.xp || 0} XP
                      </div>
                    </div>
                    {!isMe && (
                      <button
                        type="button"
                        onClick={() => onToggleFriend(u.username)}
                        className={`min-h-[40px] px-3 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
                          isFriend
                            ? 'bg-[#101218] border border-[#1B1E26] text-[#F1F5F9]'
                            : 'bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406]'
                        }`}
                      >
                        {isFriend ? '✓ Amigo' : '+ Amigo'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {subTab === 'publicas' && (
        <div className="flex flex-col gap-4">
          <div className="bg-[#0A0B0F] border border-[#38BDF8]/40 rounded-2xl p-4 sm:p-5">
            <h2 className="text-base font-extrabold text-[#F1F5F9]">
              Rutinas Publicadas por la Comunidad ({publicRoutines.length})
            </h2>
            <p className="text-sm text-[#8A92A2] mt-1">
              Copia cualquier rutina a tu perfil con 1 toque o publica las tuyas desde la pestaña Entrenar.
            </p>
          </div>

          {publicRoutines.length === 0 ? (
            <div className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-6 text-center text-sm text-[#8A92A2]">
              Aún no hay rutinas públicas. Publica una desde la pestaña Entrenar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {publicRoutines.map(({ routine, user }) => {
                const ch = getCharacterById(user.charId);
                const exNames = routine.exercises
                  .map((re) => {
                    const ex =
                      getExerciseById(re.exId, user) ||
                      getExerciseById(re.exId, currentUser);
                    return ex
                      ? `${ex.name} (${re.sets}×${re.targetReps})`
                      : '';
                  })
                  .filter(Boolean);

                return (
                  <article
                    key={`${user.username}_${routine.id}`}
                    className="bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 flex flex-col justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-base font-extrabold text-[#F1F5F9] leading-snug">
                            {routine.name}
                          </h3>
                          <div className="flex items-center gap-2 text-xs text-[#8A92A2] mt-1.5">
                            <CharacterAvatar
                              charId={ch.id}
                              stageName={getActiveCharacterStage(user).stageName}
                              level={getLevelInfo(user.xp || 0).level}
                              size="xs"
                            />
                            <span>
                              Por{' '}
                              <strong className="text-[#F1F5F9]">
                                {user.username}
                              </strong>{' '}
                              · {routine.exercises.length} ejercicios
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onCloneRoutine(user.username, routine.id)}
                          className="min-h-[40px] px-3.5 rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-bold whitespace-nowrap shrink-0"
                        >
                          📥 Copiar
                        </button>
                      </div>
                      <p className="text-xs text-[#8A92A2] mt-3 leading-relaxed">
                        {exNames.join(' · ')}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'social' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <section className="lg:col-span-6 bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5">
            <h2 className="text-base font-extrabold text-[#F1F5F9] mb-3">
              Mis Amigos ({friends.length})
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onAddFriendByName(friendInput);
                setFriendInput('');
              }}
              className="flex gap-2 mb-3"
            >
              <input
                value={friendInput}
                onChange={(e) => setFriendInput(e.target.value)}
                placeholder="Usuario a agregar (ej: vegeta_gym)"
                className="flex-1 min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
              />
              <button
                type="submit"
                className="min-h-[44px] px-4 rounded-xl bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406] text-xs font-bold whitespace-nowrap shrink-0"
              >
                Agregar
              </button>
            </form>

            {friends.length === 0 ? (
              <p className="text-sm text-[#8A92A2]">
                Agrega usuarios desde el Ranking o escribiendo su nombre arriba.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {friends.map((fn) => {
                  const fu = allUsers[fn];
                  if (!fu) return null;
                  const lv = getLevelInfo(fu.xp || 0);
                  const st = getActiveCharacterStage(fu);
                  return (
                    <div
                      key={fn}
                      className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CharacterAvatar
                          charId={st.char.id}
                          stageName={st.stageName}
                          level={lv.level}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-[#F1F5F9] truncate">
                            {fu.username}
                          </div>
                          <div className="text-xs text-[#8A92A2] truncate tabular-nums">
                            Nv.{lv.level} · {st.stageName} · {fu.workoutsDone || 0}{' '}
                            entrenos
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {onChallengeFriend && (
                          <button
                            type="button"
                            onClick={() => onChallengeFriend(fu.username)}
                            className="min-h-[38px] px-3 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-black whitespace-nowrap"
                          >
                            ⚔️ PvP
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onToggleFriend(fu.username)}
                          className="min-h-[38px] px-3 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/35 text-[#FCA5A5] text-xs font-bold whitespace-nowrap"
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {otherUsers.filter((u) => !friends.includes(u.username)).length > 0 && (
              <div className="mt-4 pt-3 border-t border-[#1B1E26]">
                <div className="text-xs text-[#8A92A2] mb-2">
                  Sugeridos de la comunidad:
                </div>
                <div className="flex flex-wrap gap-2">
                  {otherUsers
                    .filter((u) => !friends.includes(u.username))
                    .slice(0, 6)
                    .map((u) => (
                      <button
                        key={u.username}
                        type="button"
                        onClick={() => onToggleFriend(u.username)}
                        className="min-h-[36px] px-3 rounded-lg bg-[#101218] border border-[#1B1E26] text-xs font-bold text-[#F1F5F9] hover:border-[#38BDF8]"
                      >
                        + {u.username}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </section>

          <section className="lg:col-span-6 bg-[#0A0B0F] border border-[#1B1E26] rounded-2xl p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="text-base font-extrabold text-[#F1F5F9]">
                Grupos / Clanes de Entrenamiento
              </h2>
              <button
                type="button"
                onClick={() => {
                  setGroupName('');
                  setGroupDesc('');
                  setCreateGroupOpen(true);
                }}
                className="min-h-[40px] px-3 rounded-lg bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-xs font-bold whitespace-nowrap shrink-0"
              >
                + Crear Grupo
              </button>
            </div>

            <div className="flex flex-col gap-2.5">
              {groups.map((g) => {
                const isMember = g.members.includes(currentUser.username);
                return (
                  <div
                    key={g.id}
                    className="flex items-start justify-between gap-3 px-3.5 py-3 rounded-xl bg-[#07080B] border border-[#1B1E26]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-extrabold text-[#F1F5F9]">
                        ⚔️ {g.name}
                      </div>
                      <p className="text-xs text-[#8A92A2] mt-0.5">{g.desc}</p>
                      <div className="text-xs mt-1.5 tabular-nums">
                        <span className="text-[#38BDF8] font-semibold">
                          {g.members.length} miembros
                        </span>
                        {isMember && (
                          <span className="text-[#22C55E] font-bold">
                            {' '}
                            · ✓ Unido
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onToggleGroup(g.id)}
                      className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 ${
                        isMember
                          ? 'bg-[#101218] border border-[#1B1E26] text-[#F1F5F9]'
                          : 'bg-gradient-to-br from-[#0EA5E9] to-[#0369A1] text-[#030406]'
                      }`}
                    >
                      {isMember ? 'Salir' : 'Unirme'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      )}

      <Modal
        open={createGroupOpen}
        title="Crear Nuevo Grupo / Clan"
        onClose={() => setCreateGroupOpen(false)}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!groupName.trim()) return;
            onCreateGroup(groupName.trim(), groupDesc.trim());
            setCreateGroupOpen(false);
          }}
          className="flex flex-col gap-3.5"
        >
          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Nombre del Grupo
            </label>
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ej: División Saiyajin Argentina"
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#8A92A2] mb-1.5">
              Descripción / Objetivo
            </label>
            <input
              value={groupDesc}
              onChange={(e) => setGroupDesc(e.target.value)}
              placeholder="Ej: Entrenar 4 días por semana y romper PRs"
              className="w-full min-h-[44px] bg-[#07080B] border border-[#1B1E26] rounded-xl px-3.5 text-sm text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8]"
            />
          </div>
          <button
            type="submit"
            className="min-h-[46px] w-full rounded-xl bg-gradient-to-br from-[#1D4ED8] to-[#1E3A8A] text-[#F1F5F9] text-sm font-bold"
          >
            Crear Grupo
          </button>
        </form>
      </Modal>
    </div>
  );
}
