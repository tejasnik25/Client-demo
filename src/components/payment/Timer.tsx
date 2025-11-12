"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface TimerProps {
  onTimeout: () => void;
}

const Timer = ({ onTimeout }: TimerProps) => {
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const router = useRouter();

  useEffect(() => {
    if (timeLeft <= 0) {
      onTimeout();
      router.push('/strategies');
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeft, onTimeout, router]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="text-red-500 font-bold">
      Time Left: {minutes}:{seconds < 10 ? `0${seconds}` : seconds}
    </div>
  );
};

export default Timer;