/**
 * DEBUG MENU — disabled / stored for later re-integration
 *
 * To restore:
 * 1. Add the state, functions, button, and overlay back into App.tsx (see comments below).
 * 2. Re-add the lucide-react imports: Bug, Trash2, Gift
 * 3. Delete this file.
 */

// ─── lucide-react imports to re-add ──────────────────────────────────────────
// Bug, Trash2, Gift

// ─── State (inside App component) ────────────────────────────────────────────
// const [isDebugOpen, setIsDebugOpen] = useState(false);

// ─── Debug action handlers (inside App component) ────────────────────────────
/*
  // Debug Actions
  const debugAddCoins = (amount: number) => {
    setState(prev => ({ ...prev, coins: prev.coins + amount }));
  };

  const debugAddTickets = (amount: number) => {
    setState(prev => ({ ...prev, tickets: (prev.tickets ?? 0) + amount }));
  };

  const debugAddEggs = (amount: number) => {
    setState(prev => ({ ...prev, eggs: prev.eggs + amount }));
  };

  const debugReset = () => {
    if (confirm('Reset all progress?')) {
      setState(INITIAL_STATE);
      localStorage.removeItem('slime_sprout_state');
      window.location.reload();
    }
  };

  const debugUnlockAll = () => {
    setState(prev => {
      const caps = getMaxGameUpgradeLevelForWorld(prev.gameWorldIndex);
      return {
        ...prev,
        upgrades: {
          automation: 1,
          movementSpeed: caps.movementSpeed,
          slimeMovementSpeed: caps.slimeMovementSpeed,
          respawnTime: caps.respawnTime,
          coinValue: caps.coinValue,
          coinCap: caps.coinCap,
          slimeCap: caps.slimeCap,
        },
      };
    });
  };

  const debugCompleteCurrentGoal = () => {
    setState((prev) => {
      const activeGoalIndex = (prev.worldGoalsClaimed ?? [false, false, false, false, false, false, false, false]).findIndex((claimed) => !claimed);
      if (activeGoalIndex === -1) return prev;
      const goal = getLevelGoal(activeGoalIndex, prev.maxUnlockedGameWorld);
      if (!goal) return prev;
      const needed = goal.threshold;
      if ((prev.worldCoinsCollected ?? 0) >= needed) return prev;
      return { ...prev, worldCoinsCollected: needed };
    });
  };

  /** Same outcome as claiming the final goal: unlock next world, go there, reset upgrades. */
  const debugCompleteLevel = () => {
    setState((prev) => {
      if (prev.maxUnlockedGameWorld >= 5) return prev;
      const nextIndex = prev.maxUnlockedGameWorld + 1;
      queueMicrotask(() =>
        setWorldUnlockCelebration({
          worldIndex: nextIndex,
          worldName: GAME_WORLDS[nextIndex].name,
        })
      );
      return {
        ...prev,
        coins: 0,
        maxUnlockedGameWorld: nextIndex,
        gameWorldIndex: nextIndex,
        upgrades: { ...INITIAL_STATE.upgrades },
      };
    });
  };

  const debugAddSlime = () => {
    setState(prev => {
      const newSlime: Slime = {
        id: Math.random().toString(36).substr(2, 9),
        name: getUniqueName(prev.slimes),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        ...rollNewSlimeVisuals(),
        stats: {
          health: 5 + Math.floor(Math.random() * 5),
          strength: 5 + Math.floor(Math.random() * 5),
          agility: 5 + Math.floor(Math.random() * 5),
        },
        statLevels: { health: 1, strength: 1, agility: 1 },
        trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as SlimeTrait,
        arenaAbility: rollRandomArenaAbility(),
        level: 1,
        value: 50,
        hatchedAt: Date.now()
      };
      return {
        ...prev,
        slimes: [...prev.slimes, newSlime]
      };
    });
  };
*/

// ─── Header button (replaces the empty <div> placeholder in the left header slot) ───
/*
  <button
    type="button"
    onClick={() => setIsDebugOpen(true)}
    className={
      isGameTab
        ? 'ui-emerald-outline-soft pointer-events-auto justify-self-start rounded-xl bg-white/25 p-2 text-emerald-900/45 backdrop-blur-sm transition-colors hover:text-orange-600'
        : 'pointer-events-auto justify-self-start p-2 text-emerald-900/45 transition-colors hover:text-orange-600'
    }
    aria-label="Debug menu"
  >
    <Bug className="h-4 w-4" />
  </button>
*/

// ─── Debug Menu Overlay (place after the Options overlay in App JSX) ──────────
/*
  {/* Debug Menu Overlay * /}
  <AnimatePresence>
    {isDebugOpen && (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[100] flex items-center justify-center bg-black/50 p-6 backdrop-blur-sm"
      >
        <motion.div 
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          className="relative w-full max-w-xs overflow-hidden rounded-3xl border border-emerald-100/90 bg-gradient-to-b from-white to-orange-50/40 p-6 pt-7 shadow-2xl shadow-emerald-900/15 ring-1 ring-orange-100/70"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-500 to-orange-400" />
          <div className="mb-6 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-black text-gray-800">
              <Bug className="text-orange-500" /> Debug Menu
            </h2>
            <button onClick={() => setIsDebugOpen(false)} className="rounded-lg border border-gray-200 bg-gray-50/60 p-1 text-gray-400 transition-colors hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-3">
            <div className="rounded-2xl border border-emerald-100/80 bg-emerald-50/50 p-3">
              <p className="mb-2 text-[10px] font-black text-emerald-600/80 uppercase">Currency</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => debugAddCoins(1000)} className="rounded-xl bg-gradient-to-br from-amber-100 to-orange-100 py-2 text-xs font-bold text-orange-800">+1k 💰</button>
                <button onClick={() => debugAddCoins(20000)} className="rounded-xl bg-gradient-to-br from-amber-200 to-orange-200 py-2 text-xs font-bold text-orange-900">+20k 💰</button>
                <button onClick={() => debugAddTickets(5)} className="rounded-xl bg-gradient-to-br from-violet-100 to-purple-100 py-2 text-xs font-bold text-purple-800">+5 🎟️</button>
                <button onClick={() => debugAddTickets(20)} className="rounded-xl bg-gradient-to-br from-violet-200 to-purple-200 py-2 text-xs font-bold text-purple-900">+20 🎟️</button>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-100/80 bg-orange-50/40 p-3">
              <p className="mb-2 text-[10px] font-black text-orange-700/90 uppercase">Items</p>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => debugAddEggs(1)} className="rounded-xl bg-emerald-100 py-2 text-xs font-bold text-emerald-800">+1 Egg 🥚</button>
                <button onClick={() => debugAddEggs(10)} className="rounded-xl bg-teal-100 py-2 text-xs font-bold text-teal-800">+10 Eggs 🥚</button>
                <button 
                  onClick={debugAddSlime} 
                  className="col-span-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-200 to-lime-100 py-2.5 text-sm font-bold text-emerald-900"
                >
                  <Sparkles className="h-4 w-4 shrink-0" /> Add Random Slime
                </button>
              </div>
            </div>

            <button 
              onClick={debugUnlockAll}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-100 py-3 text-base font-bold text-emerald-800"
            >
              <Zap className="h-5 w-5 shrink-0" /> Max Upgrades
            </button>

            <button
              type="button"
              onClick={debugCompleteCurrentGoal}
              disabled={(state.worldGoalsClaimed ?? [false, false, false, false, false, false, false, false]).every(Boolean)}
              title={
                (state.worldGoalsClaimed ?? [false, false, false, false, false, false, false, false]).every(Boolean)
                  ? 'All goals already completed'
                  : 'Set coin progress to reach the current goal threshold'
              }
              className="ui-afford-disabled flex w-full items-center justify-center gap-2.5 rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 py-3 text-base font-bold text-teal-900 disabled:border-zinc-200 disabled:from-zinc-100 disabled:to-zinc-100 disabled:text-zinc-500"
            >
              <Gift className="h-5 w-5 shrink-0" /> Complete Current Goal
            </button>

            <button
              type="button"
              onClick={debugCompleteLevel}
              disabled={state.maxUnlockedGameWorld >= 5}
              title={
                state.maxUnlockedGameWorld >= 5
                  ? 'All worlds already unlocked'
                  : 'Unlock the next area and reset shop upgrades (normal level completion)'
              }
              className="ui-afford-disabled flex w-full items-center justify-center gap-2.5 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 py-3 text-base font-bold text-amber-900 disabled:border-zinc-200 disabled:from-zinc-100 disabled:to-zinc-100 disabled:text-zinc-500"
            >
              <Trophy className="h-5 w-5 shrink-0" /> Complete level
            </button>

            <button 
              onClick={debugReset}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 py-3 text-base font-bold text-red-700"
            >
              <Trash2 className="h-5 w-5 shrink-0" /> Reset Game
            </button>
          </div>

          <button 
            onClick={() => setIsDebugOpen(false)}
            className="mt-6 w-full rounded-2xl bg-gradient-to-r from-emerald-700 to-teal-800 py-4 text-base font-bold text-white shadow-lg shadow-emerald-900/20"
          >
            Close
          </button>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
*/
