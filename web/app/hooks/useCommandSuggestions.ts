"use client";

import { useCallback, useReducer } from "react";
import {
  MarkovChain,
  createEmptyChain,
  addCommandToChain,
  getSuggestions,
  loadChainFromStorage,
  saveChainToStorage,
  getCommandCount,
} from "../utils/markov";
import { SUGGESTED_COMMANDS_LINUX, SUGGESTED_COMMANDS_WINDOWS } from "../constants/console";

interface UseCommandSuggestionsOptions {
  userId: string | null;
  platform?: string;
  fallbackCommands?: readonly string[];
  maxSuggestions?: number;
}

interface UseCommandSuggestionsReturn {
  /** Get suggestions for a partial command input */
  getSuggestionsForInput: (input: string) => string[];
  /** Record a command to the Markov chain */
  recordCommand: (command: string) => void;
  /** Number of commands in the user's history */
  commandCount: number;
  /** Whether the chain has enough data for meaningful suggestions */
  hasEnoughHistory: boolean;
}

// Minimum number of commands before we prioritize Markov suggestions over fallback
const MIN_COMMANDS_FOR_MARKOV = 5;

// In-memory cache of chains per user to avoid repeated localStorage reads
const chainCache = new Map<string, MarkovChain>();

function getOrLoadChain(userId: string | null): MarkovChain {
  if (!userId) return createEmptyChain();
  
  if (!chainCache.has(userId)) {
    const loaded = loadChainFromStorage(userId);
    chainCache.set(userId, loaded);
  }
  
  return chainCache.get(userId) || createEmptyChain();
}

interface ChainState {
  chain: MarkovChain;
  userId: string | null;
}

type ChainAction = 
  | { type: 'ADD_COMMAND'; command: string; userId: string }
  | { type: 'CHANGE_USER'; userId: string | null };

function chainReducer(state: ChainState, action: ChainAction): ChainState {
  switch (action.type) {
    case 'CHANGE_USER': {
      if (action.userId === state.userId) return state;
      return {
        userId: action.userId,
        chain: getOrLoadChain(action.userId),
      };
    }
    case 'ADD_COMMAND': {
      if (!action.userId) return state;
      const newChain = addCommandToChain(state.chain, action.command);
      chainCache.set(action.userId, newChain);
      saveChainToStorage(action.userId, newChain);
      return { ...state, chain: newChain };
    }
    default:
      return state;
  }
}

function createInitialState(userId: string | null): ChainState {
  return {
    userId,
    chain: getOrLoadChain(userId),
  };
}

/**
 * Hook for managing per-user command suggestions using a Markov chain.
 * 
 * The Markov chain learns from the user's command history and generates
 * intelligent autocomplete suggestions based on common patterns.
 * 
 * Falls back to predefined commands for new users with limited history.
 */
export function useCommandSuggestions({
  userId,
  platform,
  fallbackCommands,
  maxSuggestions = 8,
}: UseCommandSuggestionsOptions): UseCommandSuggestionsReturn {
  // Select platform-appropriate fallback commands
  const effectiveFallback = fallbackCommands ?? (
    platform && platform.toLowerCase().includes('win')
      ? SUGGESTED_COMMANDS_WINDOWS
      : SUGGESTED_COMMANDS_LINUX
  );
  const [state, dispatch] = useReducer(
    chainReducer,
    userId,
    createInitialState
  );

  // Keep chain in sync with userId changes
  const chain = state.userId === userId ? state.chain : getOrLoadChain(userId);
  
  // Trigger user change if needed (this is a render-time check)
  if (state.userId !== userId) {
    dispatch({ type: 'CHANGE_USER', userId });
  }

  // Record a new command to the chain
  const recordCommand = useCallback((command: string) => {
    if (!userId || !command.trim()) return;
    dispatch({ type: 'ADD_COMMAND', command: command.trim(), userId });
  }, [userId]);

  // Get the count of recorded commands
  const commandCount = getCommandCount(chain);

  // Whether we have enough history for meaningful Markov suggestions
  const hasEnoughHistory = commandCount >= MIN_COMMANDS_FOR_MARKOV;

  // Get suggestions for a partial input
  const getSuggestionsForInput = useCallback((input: string): string[] => {
    const trimmedInput = input.trim();
    if (!trimmedInput) return [];

    // Get current chain (in case it was just updated)
    const currentChain = userId ? getOrLoadChain(userId) : createEmptyChain();
    
    const results: string[] = [];
    const seen = new Set<string>();

    // Get Markov chain suggestions
    const markovSuggestions = getSuggestions(currentChain, trimmedInput, maxSuggestions);
    
    for (const suggestion of markovSuggestions) {
      if (!seen.has(suggestion) && suggestion !== trimmedInput) {
        seen.add(suggestion);
        results.push(suggestion);
      }
    }

    // If we don't have enough history or Markov didn't give us enough results,
    // supplement with fallback commands
    if (results.length < maxSuggestions) {
      const remaining = maxSuggestions - results.length;
      const fallbackMatches = effectiveFallback
        .filter(cmd => 
          cmd.toLowerCase().startsWith(trimmedInput.toLowerCase()) && 
          cmd !== trimmedInput &&
          !seen.has(cmd)
        )
        .slice(0, remaining);
      
      for (const cmd of fallbackMatches) {
        seen.add(cmd);
        results.push(cmd);
      }
    }

    return results.slice(0, maxSuggestions);
  }, [userId, effectiveFallback, maxSuggestions]);

  return {
    getSuggestionsForInput,
    recordCommand,
    commandCount,
    hasEnoughHistory,
  };
}
