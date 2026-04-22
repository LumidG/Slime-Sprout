import React, { useState } from 'react';
import { Gavel, Heart, Sword, Wind, Coins } from 'lucide-react';
import type { Slime, SlimeMarketAuction } from '../types';
import {
  getInstantNpcBuyPrice,
  getNextMarketBid,
  getPlayerAuctionOpeningMinBid,
  getPlayerSellNowPrice,
} from '../constants';
import { SlimeStackSprite } from './SlimeStackSprite';

function timeLeftMs(endsAt: number): number {
  return Math.max(0, endsAt - Date.now());
}

function formatDuration(ms: number): string {
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
}

type MarketTab = 'sell' | 'buy';

type Props = {
  coins: number;
  slimes: Slime[];
  auctions: SlimeMarketAuction[];
  onSellSlimeNow: (slimeId: string) => void;
  onListSlimeAuction: (slimeId: string) => void;
  onBid: (auctionId: string) => void;
  onInstantBuy: (auctionId: string) => void;
};

export function SlimeMarketPanel({
  coins,
  slimes,
  auctions,
  onSellSlimeNow,
  onListSlimeAuction,
  onBid,
  onInstantBuy,
}: Props) {
  const [marketTab, setMarketTab] = useState<MarketTab>('buy');

  const npcAuctions = auctions.filter((x) => x.seller === 'npc');
  const playerAuctions = auctions.filter((x) => x.seller === 'player');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="shrink-0 border-b border-emerald-100/80 bg-white/90 px-3 pb-2 pt-2">
        <div className="flex rounded-2xl bg-emerald-100/50 p-0.5 ring-1 ring-emerald-200/60">
          <button
            type="button"
            onClick={() => setMarketTab('sell')}
            className={`flex-1 rounded-[14px] py-2 text-[11px] font-bold transition ${
              marketTab === 'sell'
                ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80'
                : 'text-emerald-700/70'
            }`}
          >
            Sell
          </button>
          <button
            type="button"
            onClick={() => setMarketTab('buy')}
            className={`flex-1 rounded-[14px] py-2 text-[11px] font-bold transition ${
              marketTab === 'buy'
                ? 'bg-white text-emerald-900 shadow-sm ring-1 ring-emerald-200/80'
                : 'text-emerald-700/70'
            }`}
          >
            Buy
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 no-scrollbar">
        {marketTab === 'sell' && (
          <div className="space-y-2 pb-4">
            {playerAuctions.map((a) => {
              const left = timeLeftMs(a.endsAt);
              const high = a.currentBid > 0 ? `${a.currentBid} 💰` : '—';
              const snap = a.playerSellNowSnapshot;
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-amber-100/90 bg-white p-3 shadow-sm ring-1 ring-amber-50/80"
                >
                  <div className="flex items-start gap-3">
                    <SlimeStackSprite
                      slime={a.slime}
                      size="lg"
                      className="shrink-0 shadow-inner"
                      roundedClassName="rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-black text-gray-900">{a.slime.name}</p>
                      <p className="text-[9px] font-bold text-gray-600">
                        {a.slime.trait} · Lv.{a.slime.level}
                        <span className="text-gray-400"> · </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-2.5 w-2.5 text-red-400" />
                          {a.slime.stats.health}
                        </span>
                        <span className="text-gray-300"> </span>
                        <span className="inline-flex items-center gap-1">
                          <Sword className="h-2.5 w-2.5 text-orange-400" />
                          {a.slime.stats.strength}
                        </span>
                        <span className="text-gray-300"> </span>
                        <span className="inline-flex items-center gap-1">
                          <Wind className="h-2.5 w-2.5 text-sky-400" />
                          {a.slime.stats.agility}
                        </span>
                      </p>
                      <p className="mt-1 text-[9px] font-bold text-gray-500">
                        High {high}
                        <span className="text-gray-300"> · </span>
                        {formatDuration(left)}
                      </p>
                      {snap != null && (
                        <p className="mt-0.5 text-[8px] font-bold text-amber-800/90">
                          Quick sale was {snap.toLocaleString()} 💰
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {slimes.map((slime) => {
              const sellNow = getPlayerSellNowPrice(slime);
              const auctionOpenMin = getPlayerAuctionOpeningMinBid(slime, sellNow);
              return (
                <div
                  key={slime.id}
                  className="rounded-2xl border border-emerald-100/90 bg-white p-3 shadow-sm ring-1 ring-emerald-50/80"
                >
                  <div className="flex items-start gap-3">
                    <SlimeStackSprite
                      slime={slime}
                      size="lg"
                      className="shrink-0 shadow-inner"
                      roundedClassName="rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-black text-gray-900">{slime.name}</p>
                      <p className="text-[9px] font-bold text-gray-600">
                        {slime.trait} · Lv.{slime.level}
                        <span className="text-gray-400"> · </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-2.5 w-2.5 text-red-400" />
                          {slime.stats.health}
                        </span>
                        <span className="text-gray-300"> </span>
                        <span className="inline-flex items-center gap-1">
                          <Sword className="h-2.5 w-2.5 text-orange-400" />
                          {slime.stats.strength}
                        </span>
                        <span className="text-gray-300"> </span>
                        <span className="inline-flex items-center gap-1">
                          <Wind className="h-2.5 w-2.5 text-sky-400" />
                          {slime.stats.agility}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onSellSlimeNow(slime.id)}
                      className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border-2 border-emerald-400/90 bg-gradient-to-br from-emerald-100 to-teal-100 py-2 pl-2 pr-1.5 text-[10px] font-black leading-tight text-emerald-950 shadow-sm"
                    >
                      <Coins className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="min-w-0 text-center">
                        Sell now
                        <span className="block tabular-nums text-[9px] font-black text-emerald-800/90">
                          {sellNow.toLocaleString()} 💰
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onListSlimeAuction(slime.id)}
                      className="flex min-w-0 flex-1 items-center justify-center rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 py-2 pl-2 pr-1.5 text-[10px] font-black leading-tight text-white shadow-sm"
                    >
                      <span className="min-w-0 text-center">
                        Auction
                        <span className="block tabular-nums text-[9px] font-black opacity-95">
                          {auctionOpenMin.toLocaleString()} 🔨
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}

            {slimes.length === 0 && playerAuctions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 py-8 text-center text-[11px] font-bold text-gray-400">
                No slimes to sell.
              </div>
            )}
          </div>
        )}

        {marketTab === 'buy' && (
          <div className="space-y-2 pb-4">
            {npcAuctions.length === 0 && (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 py-8 text-center text-[11px] font-bold text-gray-400">
                Nothing for sale.
              </div>
            )}
            {npcAuctions.map((a) => {
              const next = getNextMarketBid(a);
              const instant = getInstantNpcBuyPrice(a);
              const spendable = coins + (a.highBidder === 'player' ? a.playerBidAmount : 0);
              const affordableBid = spendable >= next;
              const instantLocked = a.npcInstantBuyLocked === true;
              const affordableInstant = !instantLocked && spendable >= instant;
              const left = timeLeftMs(a.endsAt);
              const high =
                a.currentBid > 0 ? `${a.currentBid} 💰` : '—';
              const isWinning = a.highBidder === 'player';
              return (
                <div
                  key={a.id}
                  className="rounded-2xl border border-emerald-100/90 bg-white p-3 shadow-sm ring-1 ring-emerald-50/80"
                >
                  <div className="flex items-start gap-3">
                    <SlimeStackSprite
                      slime={a.slime}
                      size="lg"
                      className="shrink-0 shadow-inner"
                      roundedClassName="rounded-2xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-black text-gray-900">{a.slime.name}</p>
                      <p className="text-[9px] font-bold text-gray-600">
                        {a.slime.trait} · Lv.{a.slime.level}
                        <span className="text-gray-400"> · </span>
                        <span className="inline-flex items-center gap-1">
                          <Heart className="h-2.5 w-2.5 text-red-400" />
                          {a.slime.stats.health}
                        </span>
                        <span className="text-gray-300"> </span>
                        <span className="inline-flex items-center gap-1">
                          <Sword className="h-2.5 w-2.5 text-orange-400" />
                          {a.slime.stats.strength}
                        </span>
                        <span className="text-gray-300"> </span>
                        <span className="inline-flex items-center gap-1">
                          <Wind className="h-2.5 w-2.5 text-sky-400" />
                          {a.slime.stats.agility}
                        </span>
                      </p>
                      <p className="mt-1 text-[9px] font-bold text-gray-500">
                        High {high}
                        <span className="text-gray-300"> · </span>
                        {formatDuration(left)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={instantLocked || !affordableInstant || left <= 0}
                      onClick={() => onInstantBuy(a.id)}
                      title={
                        instantLocked
                          ? 'Unavailable after you bid — wait for the auction to end.'
                          : undefined
                      }
                      className="ui-afford-disabled flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border-2 border-emerald-400/90 bg-gradient-to-br from-emerald-100 to-teal-100 py-2 pl-2 pr-1.5 text-[10px] font-black leading-tight text-emerald-950 shadow-sm disabled:border-zinc-300 disabled:from-zinc-200 disabled:to-zinc-200 disabled:text-zinc-600"
                    >
                      <Coins className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="min-w-0 text-center">
                        Buy now
                        <span className="block tabular-nums text-[9px] font-black text-emerald-800/90">
                          {instant.toLocaleString()} 💰
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={isWinning || !affordableBid || left <= 0}
                      onClick={() => onBid(a.id)}
                      title={
                        isWinning
                          ? 'You can bid again after someone outbids you.'
                          : undefined
                      }
                      className="ui-afford-disabled flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border-2 border-orange-500 bg-gradient-to-br from-amber-400 to-orange-500 py-2 text-[10px] font-black text-white shadow-sm disabled:border-zinc-300 disabled:from-zinc-200 disabled:to-zinc-300 disabled:text-zinc-800"
                    >
                      <Gavel className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 text-center leading-tight">
                        {isWinning ? 'Winning' : 'Bid'}
                        <span className="block tabular-nums text-[9px] opacity-95">
                          {isWinning
                            ? `${a.playerBidAmount.toLocaleString()} 💰`
                            : `${next.toLocaleString()} 💰`}
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
