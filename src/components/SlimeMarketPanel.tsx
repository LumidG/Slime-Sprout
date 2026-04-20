import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  Activity,
  Gavel,
  Heart,
  Sword,
  Wind,
  TrendingUp,
  Sparkles,
  Coins,
} from 'lucide-react';
import type { Slime, SlimeMarketAuction } from '../types';
import type { SlimeMarketTrend } from '../constants';
import { getInstantNpcBuyPrice, getNextMarketBid } from '../constants';

function timeLeftMs(endsAt: number): number {
  return Math.max(0, endsAt - Date.now());
}

function formatDuration(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

type MarketTab = 'selling' | 'bidding';

type Props = {
  coins: number;
  slimes: Slime[];
  trend: SlimeMarketTrend;
  auctions: SlimeMarketAuction[];
  onListSlime: (slimeId: string) => void;
  onBid: (auctionId: string) => void;
  onInstantBuy: (auctionId: string) => void;
};

export function SlimeMarketPanel({
  coins,
  slimes,
  trend,
  auctions,
  onListSlime,
  onBid,
  onInstantBuy,
}: Props) {
  const [listOpen, setListOpen] = useState(false);
  const [marketTab, setMarketTab] = useState<MarketTab>('bidding');
  const dayIndex = Math.floor(Date.now() / 86_400_000);

  const npcAuctions = auctions.filter((x) => x.seller === 'npc');
  const playerAuctions = auctions.filter((x) => x.seller === 'player');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Market intel — top */}
      <div className="shrink-0 space-y-2 border-b border-amber-100/90 bg-gradient-to-b from-amber-50/95 via-white to-emerald-50/40 px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md shadow-orange-900/15">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-800/90">
                Slime market
              </p>
              <p className="text-[11px] font-black text-emerald-950">Pulse: {trend.mood}</p>
            </div>
          </div>
          <div className="rounded-full bg-white/80 px-2 py-0.5 text-[8px] font-black uppercase tracking-tight text-emerald-700 ring-1 ring-emerald-200/80">
            Day {dayIndex % 1000}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-orange-100/90 bg-white/90 p-2 shadow-sm">
            <p className="mb-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-wide text-gray-500">
              <Sparkles className="h-3 w-3 text-amber-500" /> Hot traits
            </p>
            <p className="text-[10px] font-bold leading-tight text-emerald-900">
              {trend.hotTraitA}, {trend.hotTraitB}
            </p>
          </div>
          <div className="rounded-xl border border-orange-100/90 bg-white/90 p-2 shadow-sm">
            <p className="mb-1 flex items-center gap-1 text-[8px] font-black uppercase tracking-wide text-gray-500">
              <TrendingUp className="h-3 w-3 text-emerald-500" /> Sought stat
            </p>
            <p className="text-[10px] font-bold text-emerald-900">{trend.hotStatLabel}</p>
          </div>
        </div>

        <p className="text-[9px] leading-snug text-gray-600">
          Typical closing prices today land around{' '}
          <span className="font-black text-amber-800">{trend.avgSaleBand} 💰</span>. {trend.footnote}
        </p>
      </div>

      <div className="shrink-0 border-b border-amber-100/80 bg-white/60 px-3 pb-2 pt-1">
        <div className="flex rounded-2xl bg-emerald-100/50 p-0.5 ring-1 ring-emerald-200/60">
          <button
            type="button"
            onClick={() => setMarketTab('selling')}
            className={`flex-1 rounded-[14px] py-2 text-[10px] font-black uppercase tracking-wide transition ${
              marketTab === 'selling'
                ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80'
                : 'text-emerald-700/70'
            }`}
          >
            Selling
          </button>
          <button
            type="button"
            onClick={() => setMarketTab('bidding')}
            className={`flex-1 rounded-[14px] py-2 text-[10px] font-black uppercase tracking-wide transition ${
              marketTab === 'bidding'
                ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80'
                : 'text-emerald-700/70'
            }`}
          >
            Bidding
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 no-scrollbar">
        {marketTab === 'selling' && (
          <>
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setListOpen((o) => !o)}
                className="flex w-full items-center justify-between rounded-2xl border-2 border-dashed border-emerald-200/90 bg-gradient-to-r from-emerald-50/80 to-amber-50/50 px-3 py-2.5 text-left transition hover:border-emerald-300"
              >
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-emerald-900">
                  <Gavel className="h-4 w-4 text-orange-500" />
                  Auction your slimes
                </span>
                <span className="text-[9px] font-bold text-emerald-600">{listOpen ? 'Hide' : 'Choose'}</span>
              </button>

              {listOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="mt-2 space-y-2 overflow-hidden"
                >
                  {slimes.length === 0 ? (
                    <p className="text-center text-[10px] font-bold text-gray-400">No slimes to list.</p>
                  ) : (
                    <div className="grid max-h-48 grid-cols-3 gap-2 overflow-y-auto pr-0.5">
                      {slimes.map((slime) => (
                        <button
                          type="button"
                          key={slime.id}
                          onClick={() => {
                            onListSlime(slime.id);
                            setListOpen(false);
                          }}
                          className="flex flex-col items-center gap-1 rounded-xl border border-emerald-100 bg-white p-2 shadow-sm transition hover:border-orange-300"
                        >
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-full shadow-inner"
                            style={{ backgroundColor: slime.color }}
                          >
                            <div className="flex gap-0.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            </div>
                          </div>
                          <span className="line-clamp-1 w-full text-center text-[8px] font-black text-gray-800">
                            {slime.name}
                          </span>
                          <span className="text-[7px] font-bold text-gray-400">Min ~{slime.value}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {playerAuctions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 py-10 text-center">
                <p className="text-[10px] font-black uppercase tracking-wide text-gray-500">Your listings</p>
                <p className="mt-1 px-4 text-[9px] font-bold text-gray-400">
                  Nothing listed yet. Auction a slime above, or switch to Bidding to shop NPC listings.
                </p>
              </div>
            ) : (
              <>
                <h4 className="mb-2 text-[10px] font-black uppercase tracking-widest text-gray-700">
                  Your listings
                </h4>
                <div className="space-y-2 pb-8">
                  {playerAuctions.map((a) => {
                    const left = timeLeftMs(a.endsAt);
                    return (
                      <div
                        key={a.id}
                        className="rounded-2xl border border-orange-200/90 bg-gradient-to-br from-orange-50/90 to-amber-50/50 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-10 w-10 items-center justify-center rounded-xl shadow-inner"
                            style={{ backgroundColor: a.slime.color }}
                          >
                            <div className="flex gap-1">
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                              <div className="h-1.5 w-1.5 rounded-full bg-white" />
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[11px] font-black text-emerald-950">{a.slime.name}</p>
                            <p className="text-[9px] font-bold text-gray-600">
                              Top offer:{' '}
                              <span className="font-black text-amber-800">
                                {a.currentBid > 0 ? `${a.currentBid} 💰` : 'Waiting for bidders'}
                              </span>
                            </p>
                            <p className="text-[8px] font-bold text-gray-500">Closes in {formatDuration(left)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}

        {marketTab === 'bidding' && (
          <>
            <h4 className="mb-2 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-700">
              <Gavel className="h-4 w-4 text-orange-500" />
              Buy at auction (NPC sellers)
            </h4>
            <div className="space-y-2 pb-4">
              {npcAuctions.length === 0 && (
                <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 py-8 text-center text-[10px] font-bold text-gray-400">
                  New listings are on the way…
                </div>
              )}
              {npcAuctions.map((a) => {
                const next = getNextMarketBid(a);
                const instant = getInstantNpcBuyPrice(a);
                const spendable =
                  coins + (a.highBidder === 'player' ? a.playerBidAmount : 0);
                const affordableBid = spendable >= next;
                const affordableInstant = spendable >= instant;
                const left = timeLeftMs(a.endsAt);
                return (
                  <div
                    key={a.id}
                    className="rounded-2xl border border-emerald-100/90 bg-white p-3 shadow-sm ring-1 ring-emerald-50/80"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-inner"
                        style={{ backgroundColor: a.slime.color }}
                      >
                        <div className="flex gap-1">
                          <div className="h-2 w-2 rounded-full bg-white" />
                          <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[11px] font-black text-gray-900">{a.slime.name}</p>
                        <p className="text-[8px] font-bold uppercase tracking-tight text-amber-700">
                          {a.slime.trait} · Lv.{a.slime.level}
                        </p>
                        <div className="mt-1 grid grid-cols-3 gap-1 text-[8px] font-black text-gray-500">
                          <span className="flex items-center gap-0.5">
                            <Heart className="h-2.5 w-2.5 text-red-400" />
                            {a.slime.stats.health}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Sword className="h-2.5 w-2.5 text-orange-400" />
                            {a.slime.stats.strength}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Wind className="h-2.5 w-2.5 text-sky-400" />
                            {a.slime.stats.agility}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2">
                      <div>
                        <p className="text-[8px] font-black uppercase text-gray-400">High bid</p>
                        <p className="text-[11px] font-black tabular-nums text-emerald-800">
                          {a.currentBid > 0 ? `${a.currentBid} 💰` : '—'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[8px] font-black uppercase text-gray-400">Ends</p>
                        <p className="text-[10px] font-bold text-orange-700">{formatDuration(left)}</p>
                      </div>
                    </div>
                    <p className="mt-1.5 text-[8px] font-bold leading-snug text-gray-500">
                      Instant sale: pay less than the next bid and take the slime now. Bidding costs more per step but
                      can close higher if you win.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!affordableInstant || left <= 0}
                        onClick={() => onInstantBuy(a.id)}
                        title="Close the listing now at this price (less than the next bid)"
                        className="ui-afford-disabled flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border-2 border-emerald-400/90 bg-gradient-to-br from-emerald-100 to-teal-100 py-2 pl-2 pr-1.5 text-[9px] font-black leading-tight text-emerald-950 shadow-sm disabled:border-zinc-300 disabled:from-zinc-200 disabled:to-zinc-200 disabled:text-zinc-600"
                      >
                        <Coins className="h-3 w-3 shrink-0 opacity-80" />
                        <span className="min-w-0 text-center">
                          Instant sale
                          <span className="block tabular-nums text-[8px] font-black text-emerald-800/90">
                            {instant.toLocaleString()} 💰
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={!affordableBid || left <= 0}
                        onClick={() => onBid(a.id)}
                        className="ui-afford-disabled flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 py-2 text-[10px] font-black text-white shadow-sm disabled:border-zinc-300 disabled:from-zinc-200 disabled:to-zinc-300 disabled:text-zinc-800"
                      >
                        <Coins className="h-3.5 w-3.5 shrink-0" />
                        <span className="min-w-0 text-center leading-tight">
                          Bid
                          <span className="block tabular-nums text-[9px] opacity-95">{next.toLocaleString()} 💰</span>
                        </span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
