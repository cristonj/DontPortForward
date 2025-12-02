"use client";

import { useState, useCallback, useMemo, KeyboardEvent, ChangeEvent, FormEvent } from "react";
import { useCommandSuggestions } from "../../hooks";

interface CommandInputProps {
  onSubmit: (command: string) => void;
  disabled?: boolean;
  placeholder?: string;
  userId?: string | null;
}

export default function CommandInput({ 
  onSubmit, 
  disabled = false,
  placeholder = "",
  userId = null
}: CommandInputProps) {
  const [inputCommand, setInputCommand] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [isSuggestionsHidden, setIsSuggestionsHidden] = useState(false);

  // Per-user Markov chain for intelligent suggestions
  const { getSuggestionsForInput, recordCommand } = useCommandSuggestions({
    userId,
  });

  // Derive suggestions from input (computed, not state)
  const suggestions = useMemo(() => {
    if (!inputCommand.trim()) return [];
    return getSuggestionsForInput(inputCommand);
  }, [inputCommand, getSuggestionsForInput]);

  const showSuggestions = suggestions.length > 0 && !isSuggestionsHidden;

  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setInputCommand(e.target.value);
    setSuggestionIndex(-1);
    setIsSuggestionsHidden(false);
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === "Tab" || e.key === "Enter") {
      if (suggestionIndex >= 0) {
        e.preventDefault();
        setInputCommand(suggestions[suggestionIndex]);
        setIsSuggestionsHidden(true);
      }
    } else if (e.key === "Escape") {
      setIsSuggestionsHidden(true);
    }
  }, [showSuggestions, suggestionIndex, suggestions]);

  const handleSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (!inputCommand.trim() || disabled) return;
    
    const command = inputCommand.trim();
    // Record command to Markov chain for future suggestions
    recordCommand(command);
    onSubmit(command);
    setInputCommand("");
    setIsSuggestionsHidden(true);
  }, [inputCommand, disabled, onSubmit, recordCommand]);

  const selectSuggestion = useCallback((suggestion: string) => {
    setInputCommand(suggestion);
    setIsSuggestionsHidden(true);
  }, []);

  return (
    <div className="console-input-area relative z-20">
      {/* Suggestions Popup */}
      {showSuggestions && (
        <div className="absolute bottom-full left-0 right-0 mb-2 mx-3 sm:mx-auto sm:max-w-md">
          <div className="console-suggestions bg-gray-900/95 backdrop-blur-xl border border-terminal-accent/30 rounded-lg shadow-2xl shadow-terminal-glow/20 overflow-hidden max-h-48 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion}
                type="button"
                className={`w-full px-4 py-2.5 text-left text-sm font-mono border-b border-gray-800/50 last:border-0 transition-colors ${
                  index === suggestionIndex 
                    ? 'bg-terminal-accent/20 text-terminal-accent' 
                    : 'text-gray-300 hover:bg-gray-800/50 hover:text-terminal-accent'
                }`}
                onClick={() => selectSuggestion(suggestion)}
              >
                <span className="text-terminal-accent/60 mr-2">$</span>
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2 items-end max-w-4xl mx-auto">
        <div className="console-input-wrapper group relative flex-1 bg-gray-950/80 border border-gray-700/60 rounded-lg transition-all duration-300 focus-within:border-terminal-accent/60 focus-within:shadow-lg focus-within:shadow-terminal-glow/10 flex items-center overflow-hidden">
          {/* Terminal prompt indicator */}
          <div className="pl-3 pr-1 flex items-center gap-1">
            <span className="text-terminal-accent font-bold text-sm select-none">$</span>
            <div className="w-px h-4 bg-terminal-accent/30" />
          </div>
          
          <input
            type="text"
            value={inputCommand}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="console-input w-full bg-transparent border-none focus:ring-0 focus:outline-none text-gray-100 placeholder-gray-600 font-mono text-sm py-3 pl-2 pr-3 disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder={placeholder}
            autoFocus
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
          />
          
          {/* Blinking cursor indicator when focused and empty */}
          {!inputCommand && !disabled && (
            <div className="absolute left-12 top-1/2 -translate-y-1/2 w-2 h-4 bg-terminal-accent/60 animate-terminal-blink pointer-events-none" />
          )}
        </div>

        <button 
          type="submit"
          disabled={!inputCommand.trim() || disabled}
          className="console-submit-btn relative bg-terminal-accent hover:bg-terminal-accent-bright active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 px-5 py-3 rounded-lg text-gray-950 font-semibold transition-all duration-200 shadow-lg shadow-terminal-glow/20 hover:shadow-terminal-glow/40 flex items-center justify-center overflow-hidden group"
        >
          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500" />
          
          <svg className="w-5 h-5 relative z-10 transform rotate-90" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
          </svg>
        </button>
      </form>
    </div>
  );
}

