import React, { useEffect, useState } from 'react';

interface TimerDisplayProps {
  gameTreeId: number | null;
  sessionId: number | null;
  onTimerExpire?: () => void;
}

const TimerDisplay: React.FC<TimerDisplayProps> = ({ 
  gameTreeId,
  sessionId,
  onTimerExpire
}) => {
  const [timerData, setTimerData] = useState({
    remaining: 60,
    warningLevel: null as string | null,
    expired: false,
    paused: false
  });

  useEffect(() => {
    if (!gameTreeId) return;

    const checkTimer = async () => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/trees/filesystem-trees/${gameTreeId}/timer_status/`
        );
        
        if (response.ok) {
          const data = await response.json();
          setTimerData({
            remaining: data.remaining,
            warningLevel: data.warning_level,
            expired: data.expired,
            paused: data.paused
          });

          // Notify parent if timer expired
          if (data.expired && onTimerExpire) {
            onTimerExpire();
          }
        }
      } catch (error) {
        console.error('Failed to check timer:', error);
      }
    };

    // Check immediately
    checkTimer();

    // Then check every second
    const interval = setInterval(checkTimer, 1000);

    return () => clearInterval(interval);
  }, [gameTreeId, sessionId, onTimerExpire]);

  // Determine display based on warning level
  let borderColor = 'border-green-500';
  let textColor = 'text-green-400';
  let statusMessage = null;
  let pulseAnimation = '';
  
  if (timerData.expired || timerData.remaining <= 0) {
    borderColor = 'border-red-600';
    textColor = 'text-red-600';
    statusMessage = 'Escaped!';
  } else if (timerData.warningLevel === 'critical') {
    borderColor = 'border-red-500';
    textColor = 'text-red-400';
    statusMessage = 'Escaping!';
    pulseAnimation = 'animate-pulse';
  } else if (timerData.warningLevel === 'alert') {
    borderColor = 'border-orange-500';
    textColor = 'text-orange-400';
    statusMessage = 'Burrowing!';
  } else if (timerData.warningLevel === 'warning') {
    borderColor = 'border-yellow-500';
    textColor = 'text-yellow-400';
    statusMessage = 'Alert!';
  }
  
  return (
    <div className={`bg-black/80 backdrop-blur-sm border ${borderColor} rounded-lg p-3 shadow-2xl ${pulseAnimation}`}>
      <div className={`${textColor} font-terminal text-sm`}>
        <div className="flex items-center justify-between">
          <span>Time:</span>
          <span className="font-bold">{Math.max(0, timerData.remaining)}s</span>
        </div>
        {statusMessage && (
          <div className="text-center text-xs mt-1">{statusMessage}</div>
        )}
      </div>
    </div>
  );
};

export default TimerDisplay;