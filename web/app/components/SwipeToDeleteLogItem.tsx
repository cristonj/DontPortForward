import React, { useState, useRef, TouchEvent } from 'react';

interface SwipeToDeleteLogItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  onClick?: () => void;
  isExpanded?: boolean;
}

export default function SwipeToDeleteLogItem({ children, onDelete, onClick, isExpanded }: SwipeToDeleteLogItemProps) {
  const [offsetX, setOffsetX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startX = useRef<number>(0);
  const currentX = useRef<number>(0);
  const DELETE_THRESHOLD = -100; // Swipe 100px left to delete
  const MAX_SWIPE = -150;

  const handleTouchStart = (e: TouchEvent) => {
    startX.current = e.touches[0].clientX;
    currentX.current = startX.current;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: TouchEvent) => {
    const x = e.touches[0].clientX;
    const diff = x - startX.current;

    // Only allow swiping left
    if (diff > 0) return;

    // Prevent scrolling when swiping horizontally
    if (Math.abs(diff) > 10 && e.cancelable) {
        // e.preventDefault(); // React synthetic events might not support this directly in all cases for scrolling
        setIsSwiping(true);
    }
    
    // Limit swipe distance
    const newOffset = Math.max(diff, MAX_SWIPE);
    setOffsetX(newOffset);
    currentX.current = x;
  };

  const handleTouchEnd = () => {
    if (offsetX < DELETE_THRESHOLD) {
       onDelete();
       setOffsetX(0); 
    } else {
      setOffsetX(0);
    }
    setTimeout(() => setIsSwiping(false), 100); 
  };

  return (
    <div className="relative overflow-hidden rounded-lg select-none">
      {/* Background Layer (Delete Action) */}
      <div 
        className="absolute inset-y-0 right-0 w-full bg-red-600 rounded-lg flex items-center justify-end px-6"
      >
        <div className="flex items-center gap-2 text-white font-bold transform transition-transform" 
             style={{ 
               transform: `scale(${Math.min(1, Math.abs(offsetX) / Math.abs(DELETE_THRESHOLD))})`,
               opacity: Math.min(1, Math.abs(offsetX) / Math.abs(DELETE_THRESHOLD))
             }}
        >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            <span>Delete</span>
        </div>
      </div>

      {/* Foreground Layer (Content) */}
      <div
        className={`relative border border-gray-800 rounded-lg p-3 transition-transform duration-200 ease-out cursor-pointer
            ${isExpanded ? 'bg-gray-800' : 'bg-gray-900 hover:bg-gray-800'}
        `}
        style={{ transform: `translateX(${offsetX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
            if (!isSwiping && onClick) {
                onClick();
            }
        }}
      >
        {children}
      </div>
    </div>
  );
}
