import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Settings, 
  ShoppingBag, 
  Ghost,
  Dna, 
  TrendingUp, 
  Package, 
  ChevronRight,
  Zap,
  Timer,
  Coins,
  Egg,
  Heart,
  Sword,
  Wind,
  Bug,
  Trash2,
  Sparkles,
  Trophy,
  PartyPopper,
  Plus,
  CircleDollarSign,
  MessageCircle
} from 'lucide-react';
import { GameState, INITIAL_STATE, Slime, SlimeTrait, SlimeStats } from './types';
import { GameWorld } from './components/GameWorld';
import { 
  COLORS, 
  TRAITS, 
  UPGRADE_COSTS, 
  EGG_COST, 
  SLIME_UPGRADE_COST,
  BASE_RESPAWN_TIME,
  COIN_CAP,
  SLIME_NAMES,
  TRAIT_EFFECTS,
  MAX_EQUIPPED_SLIMES
} from './constants';

export default function App() {
  const [state, setState] = useState<GameState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isUpgradesOpen, setIsUpgradesOpen] = useState(false);
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [selectedSlimeDetail, setSelectedSlimeDetail] = useState<Slime | null>(null);
  const [breedingSelection, setBreedingSelection] = useState<string[]>([]);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const onboardingMessages = [
    "Welcome! Collect golden coins to buy eggs and hatch cute slimes.",
    "Upgrade your slimes or breed them to create powerful hybrids!",
    "Let's start collecting. Have fun!"
  ];

  const completeOnboarding = () => {
    setState(prev => ({ ...prev, hasCompletedOnboarding: true }));
  };

  const nextOnboarding = () => {
    if (onboardingStep < onboardingMessages.length - 1) {
      setOnboardingStep(prev => prev + 1);
    } else {
      completeOnboarding();
    }
  };

  // Notification Logic
  const canAffordEgg = state.coins >= EGG_COST;
  const canAffordAnyGameUpgrade = 
    (state.upgrades.automation === 0 && state.coins >= UPGRADE_COSTS.automation) ||
    state.coins >= UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed) ||
    state.coins >= UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime) ||
    state.coins >= UPGRADE_COSTS.coinValue(state.upgrades.coinValue);
  
  const canAffordAnySlimeUpgrade = state.slimes.some(s => state.coins >= SLIME_UPGRADE_COST(s.level));
  const canAffordBreeding = state.slimes.length >= 2 && state.coins >= 500;

  const hasMarketNotification = canAffordEgg || canAffordAnyGameUpgrade || canAffordAnySlimeUpgrade || canAffordBreeding;
  const hasSlimesNotification = state.eggs > 0 || state.hatchingEgg?.progress === 100; // Not strictly purchase, but important action


  // Load state
  useEffect(() => {
    const saved = localStorage.getItem('slime_sprout_state');
    if (saved) {
      const parsed = JSON.parse(saved);
      const now = Date.now();
      const diff = Math.min(now - parsed.lastSavedTime, 12 * 60 * 60 * 1000); // Cap at 12 hours
      
      // Calculate idle progress
      if (parsed.upgrades.automation > 0) {
        const respawnInterval = BASE_RESPAWN_TIME / (1 + parsed.upgrades.respawnTime * 0.2);
        const coinsPerSecond = 1 / (respawnInterval / 1000);
        const idleCoins = Math.floor((diff / 1000) * coinsPerSecond);
        const coinValue = Math.pow(2, parsed.upgrades.coinValue - 1);
        parsed.coins += idleCoins * coinValue;
        parsed.totalCoinsCollected += idleCoins;
      }
      
      setState({ ...parsed, lastSavedTime: now });
    }

    // Fake loading
    const interval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 30);

    return () => clearInterval(interval);
  }, []);

  // Save state
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('slime_sprout_state', JSON.stringify({
        ...state,
        lastSavedTime: Date.now()
      }));
    }
  }, [state, isLoading]);

  const addCoins = useCallback((count: number) => {
    setState(prev => {
      const upgradeValue = Math.pow(2, prev.upgrades.coinValue - 1);
      
      // Calculate trait bonus
      let traitBonus = 0;
      prev.equippedSlimeIds.forEach(id => {
        const slime = prev.slimes.find(s => s.id === id);
        if (slime && slime.trait) {
          traitBonus += TRAIT_EFFECTS[slime.trait].coinValue || 0;
        }
      });

      const totalValuePerCoin = upgradeValue + traitBonus;
      return {
        ...prev,
        coins: prev.coins + count * totalValuePerCoin,
        totalCoinsCollected: prev.totalCoinsCollected + count
      };
    });
  }, []);

  const toggleEquipSlime = (id: string) => {
    setState(prev => {
      const isEquipped = prev.equippedSlimeIds.includes(id);
      if (isEquipped) {
        return {
          ...prev,
          equippedSlimeIds: prev.equippedSlimeIds.filter(i => i !== id)
        };
      } else {
        if (prev.equippedSlimeIds.length >= MAX_EQUIPPED_SLIMES) {
          // Maybe show a toast or just swap? Let's swap the first one for simplicity or just block
          return {
            ...prev,
            equippedSlimeIds: [...prev.equippedSlimeIds.slice(1), id]
          };
        }
        return {
          ...prev,
          equippedSlimeIds: [...prev.equippedSlimeIds, id]
        };
      }
    });
  };

  const buyUpgrade = (key: keyof GameState['upgrades']) => {
    const currentLevel = state.upgrades[key];
    const cost = key === 'automation' ? UPGRADE_COSTS.automation : (UPGRADE_COSTS as any)[key](currentLevel);
    
    if (state.coins >= cost) {
      setState(prev => ({
        ...prev,
        coins: prev.coins - cost,
        upgrades: {
          ...prev.upgrades,
          [key]: prev.upgrades[key] + 1
        }
      }));
    }
  };

  const buyEgg = (amount: number = 1) => {
    const totalCost = EGG_COST * amount;
    if (state.coins >= totalCost) {
      setState(prev => ({
        ...prev,
        coins: prev.coins - totalCost,
        eggs: prev.eggs + amount
      }));
    }
  };

  const startHatching = () => {
    if (state.eggs > 0 && !state.hatchingEgg) {
      setState(prev => ({
        ...prev,
        eggs: prev.eggs - 1,
        hatchingEgg: {
          progress: 0,
          startTime: Date.now()
        }
      }));
    }
  };

  const getUniqueName = (existingSlimes: Slime[]) => {
    const usedNames = new Set(existingSlimes.map(s => s.name));
    const availableNames = SLIME_NAMES.filter(name => !usedNames.has(name));
    
    if (availableNames.length > 0) {
      return availableNames[Math.floor(Math.random() * availableNames.length)];
    }
    
    // Fallback if all names are used: Name + Random number
    let fallbackName = '';
    do {
      const baseName = SLIME_NAMES[Math.floor(Math.random() * SLIME_NAMES.length)];
      fallbackName = `${baseName} ${Math.floor(Math.random() * 1000)}`;
    } while (usedNames.has(fallbackName));
    
    return fallbackName;
  };

  const pokeEgg = () => {
    if (state.hatchingEgg) {
      setState(prev => {
        if (!prev.hatchingEgg) return prev;
        const newProgress = prev.hatchingEgg.progress + 10;
        if (newProgress >= 100) {
          const newSlime: Slime = {
            id: Math.random().toString(36).substr(2, 9),
            name: getUniqueName(prev.slimes),
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            stats: {
              health: 10 + Math.floor(Math.random() * 10),
              strength: 5 + Math.floor(Math.random() * 5),
              agility: 5 + Math.floor(Math.random() * 5),
            },
            statLevels: { health: 1, strength: 1, agility: 1 },
            trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as SlimeTrait,
            level: 1,
            value: 50,
            hatchedAt: Date.now()
          };
          return {
            ...prev,
            hatchingEgg: null,
            slimes: [...prev.slimes, newSlime],
            newlyHatchedSlime: newSlime
          };
        }
        return {
          ...prev,
          hatchingEgg: {
            ...prev.hatchingEgg,
            progress: newProgress
          }
        };
      });
    }
  };

  const upgradeSlimeStat = (id: string, stat: keyof SlimeStats) => {
    const slime = state.slimes.find(s => s.id === id);
    if (!slime) return;
    const currentStatLevel = slime.statLevels[stat];
    const cost = SLIME_UPGRADE_COST(currentStatLevel);
    
    if (state.coins >= cost) {
      setState(prev => {
        const updatedSlimes = prev.slimes.map(s => s.id === id ? {
          ...s,
          level: s.level + 1,
          value: Math.floor(s.value * 1.2),
          stats: {
            ...s.stats,
            [stat]: s.stats[stat] + (stat === 'health' ? 5 : 2),
          },
          statLevels: {
            ...s.statLevels,
            [stat]: s.statLevels[stat] + 1
          }
        } : s);
        
        // Update detail popup if open
        if (selectedSlimeDetail && selectedSlimeDetail.id === id) {
          const newSlime = updatedSlimes.find(s => s.id === id);
          if (newSlime) setSelectedSlimeDetail(newSlime);
        }
        
        return {
          ...prev,
          coins: prev.coins - cost,
          slimes: updatedSlimes
        };
      });
    }
  };

  const sellSlime = (id: string) => {
    const slime = state.slimes.find(s => s.id === id);
    if (!slime) return;
    setState(prev => ({
      ...prev,
      coins: prev.coins + slime.value,
      slimes: prev.slimes.filter(s => s.id !== id)
    }));
  };

  const breedSlimes = () => {
    if (breedingSelection.length !== 2) return;
    const id1 = breedingSelection[0];
    const id2 = breedingSelection[1];
    const s1 = state.slimes.find(s => s.id === id1);
    const s2 = state.slimes.find(s => s.id === id2);
    if (!s1 || !s2 || state.coins < 500) return;

    const newSlime: Slime = {
      id: Math.random().toString(36).substr(2, 9),
      name: getUniqueName(state.slimes),
      color: s1.color, // Could mix colors
      stats: {
        health: Math.floor((s1.stats.health + s2.stats.health) / 2) + 5,
        strength: Math.floor((s1.stats.strength + s2.stats.strength) / 2) + 2,
        agility: Math.floor((s1.stats.agility + s2.stats.agility) / 2) + 2,
      },
      statLevels: { health: 1, strength: 1, agility: 1 },
      trait: Math.random() > 0.5 ? s1.trait : s2.trait,
      level: 1,
      value: 100,
      hatchedAt: Date.now()
    };

    setState(prev => ({
      ...prev,
      coins: prev.coins - 500,
      slimes: [...prev.slimes, newSlime],
      newlyHatchedSlime: newSlime
    }));
    setBreedingSelection([]);
    setState(s => ({ ...s, activeSubTab: 'collection' }));
  };

  const toggleBreedingSelection = (id: string) => {
    setBreedingSelection(prev => {
      if (prev.includes(id)) return prev.filter(i => i !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  // Debug Actions
  const debugAddCoins = (amount: number) => {
    setState(prev => ({ ...prev, coins: prev.coins + amount }));
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
    setState(prev => ({
      ...prev,
      upgrades: {
        automation: 1,
        movementSpeed: 10,
        respawnTime: 10,
        coinValue: 10,
      }
    }));
  };

  const debugAddSlime = () => {
    setState(prev => {
      const newSlime: Slime = {
        id: Math.random().toString(36).substr(2, 9),
        name: getUniqueName(prev.slimes),
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        stats: {
          health: 10 + Math.floor(Math.random() * 10),
          strength: 5 + Math.floor(Math.random() * 5),
          agility: 5 + Math.floor(Math.random() * 5),
        },
        statLevels: { health: 1, strength: 1, agility: 1 },
        trait: TRAITS[Math.floor(Math.random() * TRAITS.length)] as SlimeTrait,
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

  if (isLoading && loadingProgress < 100) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center p-8 select-none" style={{ backgroundColor: '#86EFAC' }}>
        <motion.h1 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-4xl font-bold text-green-800 mb-8"
        >
          Slime Sprouts
        </motion.h1>
        <div className="w-full max-w-xs h-4 bg-white/30 rounded-full overflow-hidden border-2 border-green-800 backdrop-blur-sm">
          <motion.div 
            className="h-full bg-green-500"
            initial={{ width: 0 }}
            animate={{ width: `${loadingProgress}%` }}
          />
        </div>
        <p className="mt-4 text-green-600 font-medium">Loading {loadingProgress}%</p>
      </div>
    );
  }

  if (!hasStarted) {
    return (
      <div 
        className="h-screen w-screen flex flex-col items-center justify-center p-8 cursor-pointer select-none"
        style={{ backgroundColor: '#86EFAC' }}
        onClick={() => setHasStarted(true)}
      >
        <motion.h1 
          animate={{ y: [0, -10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          className="text-5xl font-bold text-green-800 mb-4 text-center"
        >
          Slime Sprouts
        </motion.h1>
        <motion.p 
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-green-600 text-xl font-bold mt-12"
        >
          Tap to continue
        </motion.p>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-white flex flex-col overflow-hidden max-w-md mx-auto shadow-2xl relative select-none">
      {/* Onboarding Overlay */}
      <AnimatePresence>
        {!state.hasCompletedOnboarding && hasStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm z-[200] flex items-end justify-center p-6 pb-24"
          >
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white w-full rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="absolute -top-16 left-6 w-20 h-20 bg-green-400 rounded-full shadow-lg flex items-center justify-center border-4 border-white">
                <div className="flex gap-2">
                  <div className="w-2 h-2 bg-white rounded-full relative">
                    <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-black rounded-full" />
                  </div>
                  <div className="w-2 h-2 bg-white rounded-full relative">
                    <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-black rounded-full" />
                  </div>
                </div>
              </div>
              
              <div className="pt-4">
                <h3 className="text-lg font-black text-gray-800 mb-2 flex items-center gap-2">
                  <MessageCircle className="w-5 h-5 text-green-500" />
                  Glim
                </h3>
                <p className="text-gray-600 font-medium leading-relaxed mb-6">
                  {onboardingMessages[onboardingStep]}
                </p>
                
                <div className="flex justify-between items-center">
                  <div className="flex gap-1">
                    {onboardingMessages.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full transition-all ${i === onboardingStep ? 'w-6 bg-green-500' : 'w-2 bg-gray-200'}`} 
                      />
                    ))}
                  </div>
                  <button 
                    onClick={nextOnboarding}
                    className="px-6 py-3 bg-green-500 text-white font-bold rounded-xl shadow-lg hover:scale-105 active:scale-95 transition-all"
                  >
                    {onboardingStep === onboardingMessages.length - 1 ? "Got it!" : "Next"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Stats */}
      <div className="bg-white/80 backdrop-blur-md p-4 flex justify-between items-center border-b z-10">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsDebugOpen(true)}
            className="p-1 text-gray-300 hover:text-red-400 transition-colors"
          >
            <Bug className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <div className="bg-yellow-100 p-2 rounded-full">
              <CircleDollarSign className="w-5 h-5 text-yellow-600" />
            </div>
            <span className="font-bold text-xl text-gray-800">{state.coins.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Hatching Celebration Overlay */}
      <AnimatePresence>
        {state.newlyHatchedSlime && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-green-500/90 backdrop-blur-md z-[110] flex items-center justify-center p-6 text-center"
          >
            <motion.div 
              initial={{ scale: 0.5, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              className="flex flex-col items-center"
            >
              <motion.div 
                animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.1, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="mb-8"
              >
                <PartyPopper className="w-16 h-16 text-white mb-4" />
              </motion.div>
              
              <h2 className="text-4xl font-black text-white mb-2">NEW SLIME!</h2>
              <p className="text-green-100 font-bold mb-8">A beautiful new friend has joined your collection!</p>

              <div className="relative mb-8">
                <motion.div 
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 3 }}
                  className="absolute inset-0 bg-white rounded-full blur-3xl"
                />
                <div 
                  className="w-40 h-40 rounded-full shadow-2xl relative flex items-center justify-center"
                  style={{ backgroundColor: state.newlyHatchedSlime.color }}
                >
                  {/* Cute Eyes */}
                  <div className="flex gap-6">
                    <div className="w-6 h-6 bg-white rounded-full relative">
                      <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full" />
                      <div className="absolute top-1 left-1 w-1 h-1 bg-black/20 rounded-full" />
                    </div>
                    <div className="w-6 h-6 bg-white rounded-full relative">
                      <div className="absolute top-1 right-1 w-2 h-2 bg-black rounded-full" />
                      <div className="absolute top-1 left-1 w-1 h-1 bg-black/20 rounded-full" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white/20 backdrop-blur-sm p-4 rounded-2xl mb-8 w-full max-w-xs">
                <h3 className="text-white font-black text-xl mb-1">{state.newlyHatchedSlime.name}</h3>
                <div className="flex justify-center gap-2">
                  <span className="bg-white/30 px-3 py-1 rounded-full text-xs font-bold text-white">
                    {state.newlyHatchedSlime.trait}
                  </span>
                </div>
              </div>

              <button 
                onClick={() => setState(s => ({ ...s, newlyHatchedSlime: null }))}
                className="px-12 py-4 bg-white text-green-600 font-black rounded-2xl shadow-xl hover:scale-105 transition-transform"
              >
                AWESOME!
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Menu Overlay */}
      <AnimatePresence>
        {isDebugOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-xs rounded-3xl p-6 shadow-2xl"
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black text-gray-800 flex items-center gap-2">
                  <Bug className="text-red-500" /> Debug Menu
                </h2>
                <button onClick={() => setIsDebugOpen(false)} className="text-gray-400">
                  <ChevronRight className="rotate-90" />
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Currency</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => debugAddCoins(1000)} className="py-2 bg-yellow-100 text-yellow-700 rounded-xl text-xs font-bold">+1k 💰</button>
                    <button onClick={() => debugAddCoins(10000)} className="py-2 bg-yellow-200 text-yellow-800 rounded-xl text-xs font-bold">+10k 💰</button>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-2xl">
                  <p className="text-[10px] font-black text-gray-400 uppercase mb-2">Items</p>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => debugAddEggs(1)} className="py-2 bg-blue-100 text-blue-700 rounded-xl text-xs font-bold">+1 Egg 🥚</button>
                    <button onClick={() => debugAddEggs(10)} className="py-2 bg-blue-200 text-blue-800 rounded-xl text-xs font-bold">+10 Eggs 🥚</button>
                    <button 
                      onClick={debugAddSlime} 
                      className="col-span-2 py-2 bg-purple-100 text-purple-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
                    >
                      <Sparkles className="w-3 h-3" /> Add Random Slime
                    </button>
                  </div>
                </div>

                <button 
                  onClick={debugUnlockAll}
                  className="w-full py-3 bg-green-100 text-green-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Zap className="w-4 h-4" /> Max Upgrades
                </button>

                <button 
                  onClick={debugReset}
                  className="w-full py-3 bg-red-100 text-red-700 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Reset Game
                </button>
              </div>

              <button 
                onClick={() => setIsDebugOpen(false)}
                className="w-full mt-6 py-4 bg-gray-800 text-white rounded-2xl font-bold"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Slime Detail Popup */}
      <AnimatePresence>
        {selectedSlimeDetail && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-6"
            onClick={() => setSelectedSlimeDetail(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 shadow-2xl relative"
              onClick={e => e.stopPropagation()}
            >
              <button 
                onClick={() => setSelectedSlimeDetail(null)}
                className="absolute top-4 right-4 p-2 bg-gray-100 rounded-full text-gray-400 hover:text-gray-600"
              >
                <Plus className="w-5 h-5 rotate-45" />
              </button>

              <div className="flex flex-col items-center pt-2">
                <motion.div 
                  initial={{ rotate: -5, scale: 0.8 }}
                  animate={{ rotate: 0, scale: 1 }}
                  className="w-20 h-20 rounded-full mb-4 shadow-xl relative flex items-center justify-center overflow-hidden" 
                  style={{ backgroundColor: selectedSlimeDetail.color }}
                >
                  <div className="flex gap-2.5">
                    <div className="w-2.5 h-2.5 bg-white rounded-full relative">
                      <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-black rounded-full" />
                    </div>
                    <div className="w-2.5 h-2.5 bg-white rounded-full relative">
                      <div className="absolute top-0.5 right-0.5 w-1 h-1 bg-black rounded-full" />
                    </div>
                  </div>
                  <div className="absolute bottom-2.5 w-6 h-1 bg-black/20 rounded-full" />
                </motion.div>

                <h3 className="text-xl font-black text-gray-800 mb-1">{selectedSlimeDetail.name}</h3>
                <div className="flex gap-2 mb-4">
                  <span className="bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                    Level {selectedSlimeDetail.level}
                  </span>
                  <span className="bg-green-100 text-green-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">
                    {selectedSlimeDetail.trait}
                  </span>
                </div>

                <div className="w-full bg-gray-50 rounded-[2rem] p-4 mb-4 space-y-4">
                  <div className="text-center mb-1">
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Ability</p>
                    <p className="text-xs font-bold text-gray-600 italic">"{TRAIT_EFFECTS[selectedSlimeDetail.trait].description}"</p>
                  </div>

                  <div className="text-center pt-1">
                    <p className="text-[8px] font-black text-gray-400 uppercase tracking-[0.15em] border-t border-gray-100 pt-2 mb-1">Tap skills to upgrade</p>
                  </div>
                      {/* Stat Upgrade Buttons */}
                      <div className="grid grid-cols-3 gap-2">
                        <button 
                          onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'health')}
                          disabled={state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.health)}
                          className="group relative bg-red-50 p-2 py-4 rounded-2xl flex flex-col items-center border-2 border-red-100 hover:border-red-300 disabled:opacity-50 transition-all shadow-sm"
                        >
                          <div className="text-red-500 mb-2 group-active:scale-110 transition-transform"><Heart className="w-6 h-6" /></div>
                          <div className="text-sm font-black text-gray-800 leading-none mb-0.5">{selectedSlimeDetail.stats.health}</div>
                          <div className="text-[9px] font-black text-red-400 uppercase mb-2">HP UP</div>
                          <div className="text-[10px] font-black text-yellow-700 bg-white px-2 py-0.5 rounded-lg border border-yellow-100 shadow-sm">{SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.health)}💰</div>
                        </button>
                        <button 
                          onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'strength')}
                          disabled={state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.strength)}
                          className="group relative bg-orange-50 p-2 py-4 rounded-2xl flex flex-col items-center border-2 border-orange-100 hover:border-orange-300 disabled:opacity-50 transition-all shadow-sm"
                        >
                          <div className="text-orange-500 mb-2 group-active:scale-110 transition-transform"><Sword className="w-6 h-6" /></div>
                          <div className="text-sm font-black text-gray-800 leading-none mb-0.5">{selectedSlimeDetail.stats.strength}</div>
                          <div className="text-[9px] font-black text-orange-400 uppercase mb-2">STR UP</div>
                          <div className="text-[10px] font-black text-yellow-700 bg-white px-2 py-0.5 rounded-lg border border-yellow-100 shadow-sm">{SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.strength)}💰</div>
                        </button>
                        <button 
                          onClick={() => upgradeSlimeStat(selectedSlimeDetail.id, 'agility')}
                          disabled={state.coins < SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.agility)}
                          className="group relative bg-blue-50 p-2 py-4 rounded-2xl flex flex-col items-center border-2 border-blue-100 hover:border-blue-300 disabled:opacity-50 transition-all shadow-sm"
                        >
                          <div className="text-blue-500 mb-2 group-active:scale-110 transition-transform"><Wind className="w-6 h-6" /></div>
                          <div className="text-sm font-black text-gray-800 leading-none mb-0.5">{selectedSlimeDetail.stats.agility}</div>
                          <div className="text-[9px] font-black text-blue-400 uppercase mb-2">AGI UP</div>
                          <div className="text-[10px] font-black text-yellow-700 bg-white px-2 py-0.5 rounded-lg border border-yellow-100 shadow-sm">{SLIME_UPGRADE_COST(selectedSlimeDetail.statLevels.agility)}💰</div>
                        </button>
                      </div>
                    </div>

                    <div className="w-full mt-2">
                      <button 
                        onClick={() => {
                          toggleEquipSlime(selectedSlimeDetail.id);
                        }}
                        className={`w-full py-3 rounded-xl font-black uppercase tracking-widest shadow-md transition-all text-xs ${
                          state.equippedSlimeIds.includes(selectedSlimeDetail.id)
                          ? 'bg-red-500 text-white hover:bg-red-600'
                          : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                      >
                        {state.equippedSlimeIds.includes(selectedSlimeDetail.id) ? 'Unequip' : 'Equip'}
                      </button>
                    </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden bg-gray-50">
        <AnimatePresence mode="wait">
          {state.activeTab === 'game' && (
            <motion.div 
              key="game"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full w-full relative"
            >
              <GameWorld 
                onCollect={addCoins}
                automationLevel={state.upgrades.automation}
                movementSpeedLevel={state.upgrades.movementSpeed}
                respawnTimeLevel={state.upgrades.respawnTime}
                equippedSlimes={state.slimes.filter(s => state.equippedSlimeIds.includes(s.id))}
              />
              
              {/* Upgrades Toggle Button */}
              <button 
                onClick={() => setIsUpgradesOpen(!isUpgradesOpen)}
                className="absolute top-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-white/50 z-20 text-green-600 hover:scale-110 transition-transform"
              >
                <TrendingUp className={`w-6 h-6 transition-transform ${isUpgradesOpen ? 'rotate-180' : ''}`} />
                {canAffordAnyGameUpgrade && (
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
                )}
              </button>
              
              {/* Game Sub-Tab: Upgrades */}
              <AnimatePresence>
                {isUpgradesOpen && (
                  <motion.div 
                    initial={{ y: 300, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 300, opacity: 0 }}
                    className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md rounded-2xl p-4 shadow-xl border border-white/50 z-20"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4" /> Upgrades
                      </h3>
                      <button 
                        onClick={() => setIsUpgradesOpen(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <ChevronRight className="w-5 h-5 rotate-90" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <UpgradeButton 
                        icon={<Zap className="w-4 h-4" />}
                        name="Speed"
                        level={state.upgrades.movementSpeed}
                        cost={UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed)}
                        canAfford={state.coins >= UPGRADE_COSTS.movementSpeed(state.upgrades.movementSpeed)}
                        onClick={() => buyUpgrade('movementSpeed')}
                      />
                      <UpgradeButton 
                        icon={<Timer className="w-4 h-4" />}
                        name="Respawn"
                        level={state.upgrades.respawnTime}
                        cost={UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime)}
                        canAfford={state.coins >= UPGRADE_COSTS.respawnTime(state.upgrades.respawnTime)}
                        onClick={() => buyUpgrade('respawnTime')}
                      />
                      <UpgradeButton 
                        icon={<CircleDollarSign className="w-4 h-4 text-yellow-500" />}
                        name="Value"
                        level={state.upgrades.coinValue}
                        cost={UPGRADE_COSTS.coinValue(state.upgrades.coinValue)}
                        canAfford={state.coins >= UPGRADE_COSTS.coinValue(state.upgrades.coinValue)}
                        onClick={() => buyUpgrade('coinValue')}
                      />
                      <UpgradeButton 
                        icon={<Settings className="w-4 h-4" />}
                        name="Auto"
                        level={state.upgrades.automation}
                        cost={state.upgrades.automation > 0 ? 0 : UPGRADE_COSTS.automation}
                        canAfford={state.upgrades.automation === 0 && state.coins >= UPGRADE_COSTS.automation}
                        onClick={() => buyUpgrade('automation')}
                        maxed={state.upgrades.automation > 0}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {state.activeTab === 'slimes' && (
            <motion.div 
              key="slimes"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="h-full w-full flex flex-col overflow-hidden"
            >
              {/* Upper Half: Eggs and Hatching */}
              <div className="flex-none p-3 bg-gradient-to-b from-yellow-50/50 to-white border-b border-gray-100 min-h-[160px] flex flex-col justify-center">
                <div className="flex flex-col items-center justify-center gap-3">
                  {/* Middle: Hatching Area */}
                  <div className="flex flex-col items-center justify-center relative h-36">
                    {!state.hatchingEgg ? (
                      <div className="flex flex-col items-center justify-center h-full gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center border-2 border-dashed border-gray-300 relative group transition-all">
                          <Egg className="w-8 h-8 text-gray-300 group-hover:scale-110 transition-transform" />
                          <div className="absolute -top-1 -right-1 bg-yellow-400 text-white text-[8px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">
                            {state.eggs}
                          </div>
                        </div>
                        <div className="h-6 flex items-center justify-center">
                          {state.eggs > 0 ? (
                            <button 
                              onClick={startHatching}
                              className="text-[9px] font-black bg-green-500 text-white px-4 py-1.5 rounded-full shadow-md animate-pulse hover:bg-green-600 transition-colors"
                            >
                              HATCH NOW
                            </button>
                          ) : (
                            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">No Eggs to Hatch</span>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full">
                        <motion.div 
                          animate={{ 
                            scale: [1, 1.02, 1],
                            rotate: [0, -1, 1, 0]
                          }}
                          transition={{ repeat: Infinity, duration: 2.5 }}
                          whileTap={{ scale: 0.95, rotate: [-1, 1, 0] }}
                          onClick={pokeEgg}
                          className="relative cursor-pointer group flex items-center justify-center"
                        >
                          {/* Custom Filled Egg */}
                          <div className="relative w-24 h-28 flex items-center justify-center scale-75 origin-center">
                            {/* Solid Shell with Gradient/Detail */}
                            <div 
                              className="absolute w-20 h-28 bg-gradient-to-br from-yellow-50 to-yellow-200 border-4 border-yellow-600 rounded-[50%_50%_50%_50%/_60%_60%_40%_40%] shadow-2xl overflow-hidden"
                            >
                              {/* Shell Highlight */}
                              <div className="absolute top-4 left-4 w-5 h-8 bg-white/40 rounded-full blur-[2px] -rotate-12" />
                            </div>
                            
                            {/* Refined Cracks (SVG for Jagged Lines) */}
                            <svg 
                              className="absolute inset-0 w-full h-full z-10 pointer-events-none" 
                              viewBox="0 0 128 160"
                            >
                              <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="#713F12">
                                {/* Crack 1: Top Left */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 20 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 20 ? 1 : 0 
                                  }}
                                  d="M45,45 L50,55 L42,65 L55,75"
                                />
                                {/* Crack 2: Bottom Right */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 45 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 45 ? 1 : 0 
                                  }}
                                  d="M85,110 L75,100 L82,90 L70,80"
                                />
                                {/* Crack 3: Middle Left */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 70 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 70 ? 1 : 0 
                                  }}
                                  d="M30,85 L40,95 L32,105 L45,115"
                                />
                                {/* Crack 4: Top Center Split */}
                                <motion.path 
                                  initial={{ pathLength: 0, opacity: 0 }}
                                  animate={{ 
                                    pathLength: state.hatchingEgg.progress > 90 ? 1 : 0,
                                    opacity: state.hatchingEgg.progress > 90 ? 1 : 0 
                                  }}
                                  d="M64,32 L60,50 L68,70 L64,90 L70,110"
                                  strokeWidth="3"
                                />
                              </g>
                            </svg>

                            {/* POKE! Text */}
                            <div className="z-20 flex items-center justify-center">
                               <motion.span 
                                  animate={{ 
                                    scale: [1, 1.05 + (state.hatchingEgg.progress / 400), 1],
                                    color: state.hatchingEgg.progress > 80 ? ['#713F12', '#92400E', '#713F12'] : '#713F12'
                                  }} 
                                  transition={{ repeat: Infinity, duration: 0.8 }}
                                  className="text-yellow-900 font-extrabold text-sm drop-shadow-md select-none tracking-widest"
                               >
                                  POKE!
                               </motion.span>
                            </div>
                          </div>
                        </motion.div>
                        <div className="flex flex-col items-center">
                          <div className="w-32 h-1 bg-gray-200 rounded-full mt-0 overflow-hidden border border-gray-100 shadow-inner">
                            <motion.div 
                              className="h-full bg-green-500"
                              animate={{ width: `${state.hatchingEgg.progress}%` }}
                            />
                          </div>
                          <p className="mt-0.5 text-[8px] font-black text-green-600 uppercase tracking-tighter">{state.hatchingEgg.progress}% Hatched</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Buy Section: Below hatching area */}
                  <div className="flex gap-3 w-full max-w-sm">
                    <button 
                      onClick={() => buyEgg(1)}
                      disabled={state.coins < EGG_COST}
                      className="flex-1 py-2 bg-white border-2 border-yellow-200 hover:border-yellow-400 hover:bg-yellow-50 disabled:opacity-50 text-yellow-700 font-black rounded-xl shadow-sm transition-all flex flex-col items-center justify-center group"
                    >
                      <span className="text-[8px] uppercase opacity-70">Buy 1</span>
                      <span className="text-[10px] font-black">{EGG_COST} 💰</span>
                    </button>
                    <button 
                      onClick={() => buyEgg(10)}
                      disabled={state.coins < EGG_COST * 10}
                      className="flex-1 py-2 bg-yellow-400 border-2 border-yellow-500 hover:bg-yellow-500 disabled:bg-gray-100 disabled:border-gray-200 disabled:opacity-50 text-white disabled:text-gray-400 font-black rounded-xl shadow-md transition-all flex flex-col items-center justify-center group"
                    >
                      <span className="text-[8px] uppercase opacity-90">Buy 10</span>
                      <span className="text-[10px] font-black">{EGG_COST * 10} 💰</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Lower Half: Collection Overview */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
                <div className="flex justify-between items-center px-1">
                  <h3 className="text-[10px] font-black text-gray-800 uppercase tracking-widest flex items-center gap-1.5">
                    <Ghost className="w-4 h-4 text-green-500" /> My Collection ({state.slimes.length})
                  </h3>
                  <div className="bg-green-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <span className="text-[8px] font-black text-green-600 uppercase">Equipped</span>
                    <p className="text-[9px] font-black text-green-700 uppercase">
                      {state.equippedSlimeIds.length}/{MAX_EQUIPPED_SLIMES}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pb-8">
                  {state.slimes.map((slime: Slime) => (
                    <SlimeCard 
                      key={slime.id} 
                      slime={slime} 
                      isEquipped={state.equippedSlimeIds.includes(slime.id)}
                      onEquip={toggleEquipSlime}
                      onClick={setSelectedSlimeDetail}
                    />
                  ))}
                  {state.slimes.length === 0 && (
                    <div className="col-span-3 text-center py-16 bg-white rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center gap-3">
                      <Ghost className="w-12 h-12 text-gray-200" />
                      <div>
                        <p className="text-gray-400 font-medium">No slimes yet.</p>
                        <p className="text-[10px] text-gray-400 mt-1 uppercase font-black">Buy and hatch your first egg!</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {state.activeTab === 'market' && (
            <motion.div 
              key="market"
              initial={{ x: 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -100, opacity: 0 }}
              className="h-full w-full flex flex-col overflow-hidden pb-24"
            >
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-purple-100 text-center relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-2 bg-purple-500 h-full" />
                  <Dna className="w-16 h-16 text-purple-400 mx-auto mb-4" />
                  <h3 className="text-xl font-black text-gray-800 uppercase tracking-widest px-2">Ancient Breeding</h3>
                  <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-8">Fuse two slimes into a powerful hybrid</p>
                  
                  <div className="bg-purple-50 p-5 rounded-3xl border-2 border-purple-100 flex justify-between items-center mb-8 mx-2">
                    <div className="text-left">
                      <p className="text-[10px] font-black text-purple-400 uppercase">Research Fee</p>
                      <p className="text-2xl font-black text-purple-600">500 💰</p>
                    </div>
                    <button 
                      onClick={breedSlimes}
                      disabled={breedingSelection.length !== 2 || state.coins < 500}
                      className="px-8 py-4 bg-purple-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-xl disabled:opacity-50 disabled:shadow-none hover:bg-purple-600 active:scale-95 transition-all"
                    >
                      Fuse Slimes
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pb-12 px-2">
                    {state.slimes.map(slime => {
                      const isSelected = breedingSelection.includes(slime.id);
                      return (
                        <button 
                          key={slime.id}
                          onClick={() => toggleBreedingSelection(slime.id)}
                          className={`p-4 rounded-3xl border-2 transition-all flex flex-col items-center gap-3 relative overflow-hidden ${
                            isSelected 
                            ? 'border-purple-500 bg-purple-50 shadow-lg scale-105 z-10' 
                            : 'border-gray-50 bg-white hover:border-purple-200 shadow-sm'
                          }`}
                        >
                          <div 
                            className="w-14 h-14 rounded-full shadow-inner flex items-center justify-center relative"
                            style={{ backgroundColor: slime.color }}
                          >
                            <div className="flex gap-2">
                              <div className="w-2.5 h-2.5 bg-white rounded-full relative" />
                              <div className="w-2.5 h-2.5 bg-white rounded-full relative" />
                            </div>
                          </div>
                          <div className="text-center w-full">
                            <div className="text-xs font-black text-gray-800 truncate mb-1">{slime.name}</div>
                            <div className="text-[9px] font-black text-purple-400 uppercase">Lv.{slime.level}</div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2 bg-purple-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black shadow-lg">
                              {breedingSelection.indexOf(slime.id) + 1}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {state.slimes.length < 2 && (
                    <div className="py-16 px-6 border-2 border-dashed border-purple-100 rounded-[2rem] bg-purple-50/30 flex flex-col items-center gap-4">
                      <Ghost className="w-12 h-12 text-purple-200" />
                      <p className="text-purple-400 text-xs font-bold uppercase tracking-wider text-center">You need more slimes to begin research!</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <div className="bg-white border-t p-2 flex justify-around items-center pb-8 z-50">
        <NavButton 
          active={state.activeTab === 'game'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'game' }))}
          icon={<CircleDollarSign />}
        />
        <NavButton 
          active={state.activeTab === 'slimes'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'slimes' }))}
          icon={<Ghost />}
          hasNotification={hasSlimesNotification}
        />
        <NavButton 
          active={state.activeTab === 'market'} 
          onClick={() => setState(s => ({ ...s, activeTab: 'market', activeSubTab: 'market' }))}
          icon={<ShoppingBag />}
          hasNotification={hasMarketNotification}
        />
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, hasNotification }: { active: boolean, onClick: () => void, icon: React.ReactNode, hasNotification?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center gap-1 p-2 rounded-2xl transition-all relative ${active ? 'text-green-600' : 'text-gray-400'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-green-100' : ''}`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-6 h-6' })}
      </div>
      {hasNotification && (
        <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-sm" />
      )}
    </button>
  );
}

interface UpgradeButtonProps {
  icon: React.ReactNode;
  name: string;
  level: number;
  cost: number;
  canAfford: boolean;
  onClick: () => void;
  maxed?: boolean;
}

function UpgradeButton({ icon, name, level, cost, canAfford, onClick, maxed }: UpgradeButtonProps) {
  return (
    <button 
      onClick={onClick}
      disabled={!canAfford || maxed}
      className={`p-3 rounded-xl border flex flex-col gap-1 transition-all ${
        maxed ? 'bg-gray-50 border-gray-200 opacity-50' :
        canAfford ? 'bg-white border-green-100 hover:border-green-300' : 'bg-gray-50 border-gray-200 opacity-70'
      }`}
    >
      <div className="flex justify-between items-center w-full">
        <div className="text-green-600">{icon}</div>
        <span className="text-[10px] font-black text-gray-400">LV.{level}</span>
      </div>
      <div className="text-left">
        <div className="text-xs font-bold text-gray-800">{name}</div>
        <div className="text-[10px] font-bold text-green-600">
          {maxed ? 'MAX' : `${cost.toLocaleString()} 💰`}
        </div>
      </div>
    </button>
  );
}

const SlimeCard: React.FC<{ 
  slime: Slime; 
  isEquipped: boolean; 
  onEquip: (id: string) => void;
  onClick: (slime: Slime) => void;
}> = ({ slime, isEquipped, onEquip, onClick }) => {
  const trait = TRAIT_EFFECTS[slime.trait];
  return (
    <motion.div 
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      onClick={() => onClick(slime)}
      className={`p-2 rounded-2xl shadow-sm border flex flex-col items-center transition-all cursor-pointer active:scale-95 ${
        isEquipped ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-gray-100'
      }`}
    >
      <div 
        className="w-10 h-10 rounded-full mb-2 shadow-inner relative overflow-hidden flex items-center justify-center" 
        style={{ backgroundColor: slime.color }}
      >
        <div className="flex gap-1.5">
          <div className="w-2 h-2 bg-white rounded-full relative">
            <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-black rounded-full" />
          </div>
          <div className="w-2 h-2 bg-white rounded-full relative">
            <div className="absolute top-0.5 right-0.5 w-0.5 h-0.5 bg-black rounded-full" />
          </div>
        </div>
      </div>
      <h4 className="font-bold text-gray-800 text-[10px] mb-0.5 text-center truncate w-full px-1">
        {slime.name}
      </h4>
      <div className="w-full grid grid-cols-3 gap-0.5 mb-2 mt-1 px-1">
        <div className="flex flex-col items-center">
          <Heart className="w-2.5 h-2.5 text-red-500" />
          <span className="text-[8px] font-black">{slime.stats.health}</span>
        </div>
        <div className="flex flex-col items-center">
          <Sword className="w-2.5 h-2.5 text-orange-500" />
          <span className="text-[8px] font-black">{slime.stats.strength}</span>
        </div>
        <div className="flex flex-col items-center">
          <Wind className="w-2.5 h-2.5 text-blue-500" />
          <span className="text-[8px] font-black">{slime.stats.agility}</span>
        </div>
      </div>
      <button 
        onClick={(e) => {
          e.stopPropagation();
          onEquip(slime.id);
        }}
        className={`w-full py-1.5 text-[8px] font-black uppercase rounded-lg transition-all ${
          isEquipped 
          ? 'bg-yellow-500 text-white' 
          : 'bg-green-50 text-green-600 hover:bg-green-100'
        }`}
      >
        {isEquipped ? 'Equipped' : 'Equip'}
      </button>
    </motion.div>
  );
}

interface StatBarProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

function StatBar({ label, value, max, color }: StatBarProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[8px] font-black text-gray-400 w-6">{label}</span>
      <div className="flex-1 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  );
}

interface StatBadgeProps {
  icon: React.ReactNode;
  value: number;
  label: string;
}

function StatBadge({ icon, value, label }: StatBadgeProps) {
  return (
    <div className="bg-gray-50 p-2 rounded-xl flex flex-col items-center">
      <div className="text-gray-400 mb-1">{icon}</div>
      <div className="text-xs font-bold text-gray-800">{value}</div>
      <div className="text-[8px] font-black text-gray-400 uppercase">{label}</div>
    </div>
  );
}
