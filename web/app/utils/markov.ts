/**
 * Per-user Markov chain for command suggestions.
 * 
 * The chain works by:
 * 1. Tokenizing commands into words
 * 2. Building transition probabilities between consecutive tokens
 * 3. Suggesting completions based on partial input
 */

// Represents transition probabilities from one token to possible next tokens
export interface MarkovChain {
  // token -> { nextToken: count }
  transitions: Record<string, Record<string, number>>;
  // Track command frequencies for direct prefix matching
  commandCounts: Record<string, number>;
}

const STORAGE_KEY_PREFIX = "dpf_markov_chain_";

/**
 * Creates an empty Markov chain
 */
export function createEmptyChain(): MarkovChain {
  return {
    transitions: {},
    commandCounts: {},
  };
}

/**
 * Tokenizes a command into words/tokens for Markov chain processing
 */
export function tokenizeCommand(command: string): string[] {
  // Split on spaces but preserve operators and special characters as separate tokens
  return command
    .trim()
    .split(/\s+/)
    .filter(token => token.length > 0);
}

/**
 * Adds a command to the Markov chain, updating transition probabilities
 */
export function addCommandToChain(chain: MarkovChain, command: string): MarkovChain {
  const trimmed = command.trim();
  if (!trimmed) return chain;

  const newChain: MarkovChain = {
    transitions: { ...chain.transitions },
    commandCounts: { ...chain.commandCounts },
  };

  // Track the full command for direct matching
  newChain.commandCounts[trimmed] = (newChain.commandCounts[trimmed] || 0) + 1;

  // Tokenize and build transitions
  const tokens = tokenizeCommand(trimmed);
  
  // Add start token transition
  const startKey = "__START__";
  if (tokens.length > 0) {
    if (!newChain.transitions[startKey]) {
      newChain.transitions[startKey] = {};
    }
    newChain.transitions[startKey][tokens[0]] = 
      (newChain.transitions[startKey][tokens[0]] || 0) + 1;
  }

  // Add transitions between consecutive tokens
  for (let i = 0; i < tokens.length - 1; i++) {
    const current = tokens[i];
    const next = tokens[i + 1];
    
    if (!newChain.transitions[current]) {
      newChain.transitions[current] = {};
    }
    newChain.transitions[current][next] = 
      (newChain.transitions[current][next] || 0) + 1;
  }

  return newChain;
}

/**
 * Gets the most likely next tokens given a current token
 */
export function getNextTokens(chain: MarkovChain, token: string, limit: number = 5): string[] {
  const transitions = chain.transitions[token];
  if (!transitions) return [];

  // Sort by frequency (descending)
  return Object.entries(transitions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nextToken]) => nextToken);
}

/**
 * Generates command suggestions based on partial input using the Markov chain
 */
export function getSuggestions(
  chain: MarkovChain, 
  input: string, 
  limit: number = 8
): string[] {
  const trimmedInput = input.trim();
  if (!trimmedInput) return [];

  const suggestions: Array<{ command: string; score: number }> = [];
  const seenCommands = new Set<string>();

  // Strategy 1: Direct prefix matching on full commands (highest priority)
  // This gives us exact matches from the user's history
  for (const [command, count] of Object.entries(chain.commandCounts)) {
    if (command.toLowerCase().startsWith(trimmedInput.toLowerCase()) && command !== trimmedInput) {
      if (!seenCommands.has(command)) {
        seenCommands.add(command);
        suggestions.push({ command, score: count * 100 }); // High weight for direct matches
      }
    }
  }

  // Strategy 2: Markov chain completion for partial last token
  const tokens = tokenizeCommand(trimmedInput);
  if (tokens.length > 0) {
    const lastToken = tokens[tokens.length - 1];
    const prefix = tokens.slice(0, -1).join(" ");
    
    // Find the previous token to get transition probabilities
    const prevToken = tokens.length > 1 ? tokens[tokens.length - 2] : "__START__";
    
    // Get possible next tokens from the Markov chain
    const nextTokenCandidates = getNextTokens(chain, prevToken, 20);
    
    for (const candidate of nextTokenCandidates) {
      // Check if the candidate starts with what user is typing
      if (candidate.toLowerCase().startsWith(lastToken.toLowerCase()) && candidate !== lastToken) {
        const completion = prefix ? `${prefix} ${candidate}` : candidate;
        if (!seenCommands.has(completion)) {
          seenCommands.add(completion);
          const score = chain.transitions[prevToken]?.[candidate] || 0;
          suggestions.push({ command: completion, score: score * 10 });
        }
      }
    }

    // Strategy 3: Extend with next likely tokens
    // If the input seems complete (ends with space or is a known token sequence)
    if (input.endsWith(" ") || chain.transitions[lastToken]) {
      const nextTokens = getNextTokens(chain, lastToken, 10);
      for (const nextToken of nextTokens) {
        const completion = `${trimmedInput} ${nextToken}`;
        if (!seenCommands.has(completion)) {
          seenCommands.add(completion);
          const score = chain.transitions[lastToken]?.[nextToken] || 0;
          suggestions.push({ command: completion, score });
        }
      }
    }
  }

  // Sort by score and return top suggestions
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(s => s.command);
}

/**
 * Loads a Markov chain from localStorage for a specific user
 */
export function loadChainFromStorage(userId: string): MarkovChain {
  if (typeof window === "undefined") return createEmptyChain();
  
  try {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.transitions && parsed.commandCounts) {
        return parsed as MarkovChain;
      }
    }
  } catch (error) {
    console.warn("Failed to load Markov chain from storage:", error);
  }
  
  return createEmptyChain();
}

/**
 * Saves a Markov chain to localStorage for a specific user
 */
export function saveChainToStorage(userId: string, chain: MarkovChain): void {
  if (typeof window === "undefined") return;
  
  try {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(chain));
  } catch (error) {
    console.warn("Failed to save Markov chain to storage:", error);
  }
}

/**
 * Gets the total number of commands in the chain
 */
export function getCommandCount(chain: MarkovChain): number {
  return Object.values(chain.commandCounts).reduce((sum, count) => sum + count, 0);
}
