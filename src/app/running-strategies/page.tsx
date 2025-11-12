'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';

interface RunningStrategy {
  id: string;
  strategyName: string;
  status: string;
}

const RunningStrategiesPage = () => {
  const { data: session } = useSession();
  const [strategies, setStrategies] = useState<RunningStrategy[]>([]);

  useEffect(() => {
    if (session) {
      fetch('/api/running-strategies')
        .then(res => res.json())
        .then(data => setStrategies(data));
    }
  }, [session]);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Running Strategies</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {strategies.map(strategy => (
          <div key={strategy.id} className="bg-gray-800 p-4 rounded-lg">
            <h2 className="text-xl font-semibold">{strategy.strategyName}</h2>
            <p>Status: <span className={`font-bold ${strategy.status === 'in-process' ? 'text-yellow-500' : 'text-green-500'}`}>{strategy.status}</span></p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RunningStrategiesPage;