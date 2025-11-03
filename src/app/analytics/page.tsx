'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FiBarChart2, FiPieChart, FiTrendingUp, FiCalendar } from 'react-icons/fi';
import UserLayout from '@/components/UserLayout';

function AnalyticsPageContent() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<'profits' | 'daily-profits' | 'weekly-profits' | 'monthly-profits'>('profits');
  const [isLoading, setIsLoading] = useState(true);
  
  // Mock data for charts
  const [analyticsData, setAnalyticsData] = useState({
    profits: {
      daily: [10, 15, 8, 20, 25, 18, 22],
      weekly: [45, 60, 75, 82, 90],
      monthly: [150, 220, 280, 310, 350, 290]
    },
    strategies: {
      distribution: [
        { name: 'Growth', value: 40 },
        { name: 'Value', value: 25 },
        { name: 'Momentum', value: 20 },
        { name: 'Income', value: 15 }
      ],
      performance: [
        { name: 'Strategy A', value: 28 },
        { name: 'Strategy B', value: 15 },
        { name: 'Strategy C', value: -5 },
        { name: 'Strategy D', value: 12 }
      ]
    }
  });

  useEffect(() => {
    // Simulate data loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  // Function to render bar chart
  const renderBarChart = (data: number[], labels: string[], color = '#7367f0') => {
    const maxValue = Math.max(...data);
    
    return (
      <div className="h-64 flex items-end space-x-2">
        {data.map((value: number, index: number) => (
          <div key={index} className="flex flex-col items-center flex-1">
            <div 
              className="w-full bg-opacity-80 rounded-t-sm" 
              style={{ 
                height: `${(value / maxValue) * 100}%`, 
                backgroundColor: color 
              }}
            ></div>
            <div className="text-xs text-gray-400 mt-1">{labels[index]}</div>
          </div>
        ))}
      </div>
    );
  };

  // Define type for strategy item
  type StrategyItem = {
    name: string;
    value: number;
  };

  // Function to render pie chart
  const renderPieChart = (data: StrategyItem[]) => {
    const total = data.reduce((sum: number, item: StrategyItem) => sum + item.value, 0);
    let cumulativePercentage = 0;
    
    return (
      <div className="relative h-64 w-64 mx-auto">
        <div className="h-full w-full rounded-full overflow-hidden">
          {data.map((item: StrategyItem, index: number) => {
            const percentage = (item.value / total) * 100;
            const startPercentage = cumulativePercentage;
            cumulativePercentage += percentage;
            
            const colors = ['#7367f0', '#28c76f', '#ea5455', '#ff9f43'];
            
            return (
              <div 
                key={index}
                className="absolute inset-0"
                style={{
                  background: colors[index % colors.length],
                  clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos(2 * Math.PI * startPercentage / 100)}% ${50 + 50 * Math.sin(2 * Math.PI * startPercentage / 100)}%, ${50 + 50 * Math.cos(2 * Math.PI * cumulativePercentage / 100)}% ${50 + 50 * Math.sin(2 * Math.PI * cumulativePercentage / 100)}%)`
                }}
              ></div>
            );
          })}
        </div>
        
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-[#161d31] h-32 w-32 rounded-full"></div>
        </div>
      </div>
    );
  };

  // Function to render legend
  const renderLegend = (data: StrategyItem[]) => {
    const colors = ['#7367f0', '#28c76f', '#ea5455', '#ff9f43'];
    
    return (
      <div className="grid grid-cols-2 gap-2 mt-4">
        {data.map((item: StrategyItem, index: number) => (
          <div key={index} className="flex items-center">
            <div 
              className="h-3 w-3 rounded-sm mr-2" 
              style={{ backgroundColor: colors[index % colors.length] }}
            ></div>
            <span className="text-sm text-gray-400">{item.name}: {item.value}%</span>
          </div>
        ))}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-[#7367f0]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#283046] rounded-lg p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Analytics Dashboard</h1>
        
        {/* Tabs */}
        <div className="flex space-x-4 mb-6">
          <button
            className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'profits' ? 'bg-[#7367f0] text-white' : 'bg-[#161d31] text-gray-400'}`}
            onClick={() => setActiveTab('profits')}
          >
            <FiTrendingUp className="mr-2" /> Profit Analysis
          </button>
          <button
            className={`flex items-center px-4 py-2 rounded-md ${activeTab === 'strategies' ? 'bg-[#7367f0] text-white' : 'bg-[#161d31] text-gray-400'}`}
            onClick={() => setActiveTab('strategies')}
          >
            <FiPieChart className="mr-2" /> Strategy Analysis
          </button>
        </div>
        
        {/* Content based on active tab */}
        {activeTab === 'profits' && (
          <div className="space-y-6">
            <div className="bg-[#161d31] rounded-lg p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white">Profit Trends</h2>
                <div className="flex space-x-2">
                  <button 
                    className={`px-3 py-1 text-xs rounded-md ${activeTab === 'daily-profits' ? 'bg-[#7367f0] text-white' : 'bg-[#283046] text-gray-400'}`}
                    onClick={() => setActiveTab('daily-profits')}
                  >
                    Daily
                  </button>
                  <button 
                    className={`px-3 py-1 text-xs rounded-md ${activeTab === 'weekly-profits' ? 'bg-[#7367f0] text-white' : 'bg-[#283046] text-gray-400'}`}
                    onClick={() => setActiveTab('weekly-profits')}
                  >
                    Weekly
                  </button>
                  <button 
                    className={`px-3 py-1 text-xs rounded-md ${activeTab === 'monthly-profits' ? 'bg-[#7367f0] text-white' : 'bg-[#283046] text-gray-400'}`}
                    onClick={() => setActiveTab('monthly-profits')}
                  >
                    Monthly
                  </button>
                </div>
              </div>
              
              {renderBarChart(
                analyticsData.profits.daily, 
                ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#161d31] rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Total Profit</h3>
                <div className="flex items-center">
                  <div className="bg-[#283046] p-3 rounded-md mr-4">
                    <FiBarChart2 className="h-6 w-6 text-[#7367f0]" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">$1,250.80</p>
                    <p className="text-sm text-green-500">+15.2% from last month</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-[#161d31] rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Best Performing Day</h3>
                <div className="flex items-center">
                  <div className="bg-[#283046] p-3 rounded-md mr-4">
                    <FiCalendar className="h-6 w-6 text-[#7367f0]" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-white">Thursday</p>
                    <p className="text-sm text-green-500">$320.45 average profit</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'strategies' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-[#161d31] rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Strategy Distribution</h3>
                <div className="flex flex-col items-center">
                  {renderPieChart(analyticsData.strategies.distribution)}
                  {renderLegend(analyticsData.strategies.distribution)}
                </div>
              </div>
              
              <div className="bg-[#161d31] rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Strategy Performance</h3>
                {renderBarChart(
                  analyticsData.strategies.performance.map(item => item.value),
                  analyticsData.strategies.performance.map(item => item.name),
                  '#28c76f'
                )}
              </div>
            </div>
            
            <div className="bg-[#161d31] rounded-lg p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Top Performing Strategies</h3>
              <div className="space-y-4">
                {analyticsData.strategies.performance
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 3)
                  .map((strategy, index) => (
                    <div key={index} className="bg-[#283046] rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="text-white font-medium">{strategy.name}</h4>
                          <p className="text-sm text-gray-400">Performance: {strategy.value}%</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs ${strategy.value > 0 ? 'bg-green-900/30 text-green-500' : 'bg-red-900/30 text-red-500'}`}>
                          {strategy.value > 0 ? '+' : ''}{strategy.value}%
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <UserLayout>
      <AnalyticsPageContent />
    </UserLayout>
  );
}