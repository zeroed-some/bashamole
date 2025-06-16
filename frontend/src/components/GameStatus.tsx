import React from 'react';
import Image from 'next/image';
import TimerDisplay from './TimerDisplay';
import { MoleDirection } from '@/lib/api';

interface GameStatusProps {
  // Timer props
  gameTreeId: number | null;
  sessionId: number | null;
  onTimerExpire: () => Promise<void>;
  
  // Score props
  score: number;
  molesKilled: number;
  
  // Direction indicator props
  moleDirection: MoleDirection | null;
}

const GameStatus: React.FC<GameStatusProps> = ({
  gameTreeId,
  sessionId,
  onTimerExpire,
  score,
  molesKilled,
  moleDirection,
}) => {
  // Get position for mole direction indicator
  const getMoleIndicatorPosition = (direction: string) => {
    const positions: Record<string, string> = {
      'up': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-full -mt-8',
      'down': 'bottom-20 left-1/2 -translate-x-1/2',
      'left': 'top-1/2 left-8 -translate-y-1/2',
      'right': 'top-1/2 right-8 -translate-y-1/2',
      'up-left': 'top-20 left-8',
      'up-right': 'top-20 right-8',
      'down-left': 'bottom-20 left-8',
      'down-right': 'bottom-20 right-8',
    };
    return positions[direction] || positions['up'];
  };

  // Get rotation for arrow based on angle
  const getArrowRotation = (angle: number) => {
    return `rotate(${angle}deg)`;
  };

  return (
    <>
      {/* Mole Direction Indicator */}
      {moleDirection && (
        <div 
          className={`absolute ${getMoleIndicatorPosition(moleDirection.direction)} z-40 animate-pulse`}
          style={{
            animation: 'pulse 2s ease-in-out infinite, fadeIn 0.5s ease-out'
          }}
        >
          <div className="bg-red-600/90 backdrop-blur-sm border-2 border-red-400 rounded-lg p-3 shadow-2xl flex items-center gap-2">
            <Image 
              src="/mole.svg" 
              alt="Mole" 
              width={32}
              height={32}
              className="w-8 h-8"
            />
            <div 
              className="text-white text-2xl"
              style={{ transform: getArrowRotation(moleDirection.angle) }}
            >
              →
            </div>
          </div>
        </div>
      )}

      {/* Score and Timer Display - Top Right */}
      <div className="absolute top-4 right-4 flex flex-col gap-3 z-30">
        {/* Timer */}
        <TimerDisplay 
          gameTreeId={gameTreeId}
          sessionId={sessionId}
          onTimerExpire={onTimerExpire}
        />
        
        {/* Score */}
        {molesKilled > 0 && (
          <div className="bg-black/80 backdrop-blur-sm border border-green-500 rounded-lg p-3 shadow-2xl">
            <div className="text-green-400 font-terminal text-sm">
              <div>Score: {score}</div>
              <div>Moles: {molesKilled}</div>
            </div>
          </div>
        )}
      </div>

      {/* Custom styles for animations */}
      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
    </>
  );
};

export default GameStatus;