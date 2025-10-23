'use client';
import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Card, {
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs, { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import UserLayout from '@/components/UserLayout';
import { FiInfo, FiPlay } from 'react-icons/fi';

// Local Strategy type to avoid importing server modules in client
interface Strategy {
  id: string;
  name: string;
  description: string;
  performance: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  category: 'Growth' | 'Income' | 'Momentum' | 'Value';
  imageUrl: string;
  details: string;
  parameters: Record<string, string>;
  contentType?: 'html' | 'pdf';
  contentUrl?: string;
  enabled?: boolean;
  created_at: string;
  updated_at: string;
}

const StrategiesPageContent: React.FC = () => {
  const { data: session } = useSession();
  const router = useRouter();
  const [selectedStrategy, setSelectedStrategy] = useState<Strategy | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch strategies from the API
  useEffect(() => {
    const fetchStrategies = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/strategies');
        if (!response.ok) {
          console.error('Failed to fetch strategies:', response.status);
          setStrategies([]);
          return;
        }
        const data = await response.json();
        // Only show enabled strategies to users
        const enabledStrategies = data.strategies?.filter((s: Strategy) => s.enabled !== false) || [];
        setStrategies(enabledStrategies);
      } catch (error) {
        console.error('Error fetching strategies:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStrategies();
    const refreshInterval = setInterval(fetchStrategies, 5000);
    return () => clearInterval(refreshInterval);
  }, []);

  const handleViewInfo = (strategy: Strategy) => {
    setSelectedStrategy(strategy);
  };
  
  const closeStrategyInfo = () => {
    setSelectedStrategy(null);
  };

  const handleDeploy = (strategy: Strategy) => {
    router.push(`/dashboard?tab=chat&strategy=${strategy.id}`);
  };

  const filteredStrategies = activeTab === 'all' 
    ? strategies 
    : strategies.filter(strategy => strategy.category.toLowerCase() === activeTab);

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:px-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
            Trading Strategies
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500 dark:text-gray-400">
            Explore and deploy trading strategies to optimize your investments.
          </p>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="px-4 py-5 sm:p-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Strategy Categories
            </label>
            <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mt-2">
              <TabsList className="grid w-full md:w-auto grid-cols-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="growth">Growth</TabsTrigger>
                <TabsTrigger value="value">Value</TabsTrigger>
                <TabsTrigger value="income">Income</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              {loading ? (
                Array(3).fill(0).map((_, index) => (
                  <Card key={`loading-${index}`} className="hover:shadow-lg transition-shadow">
                    <div className="h-48 bg-muted animate-pulse"></div>
                    <CardHeader>
                      <CardTitle className="h-6 bg-muted animate-pulse rounded w-3/4"></CardTitle>
                      <CardDescription className="h-4 bg-muted animate-pulse rounded mt-2"></CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="w-full h-4 bg-muted animate-pulse rounded"></div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-muted animate-pulse rounded-full w-1/2"></div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex space-x-2">
                      <div className="flex-1 h-9 bg-muted animate-pulse rounded"></div>
                      <div className="flex-1 h-9 bg-muted animate-pulse rounded"></div>
                    </CardFooter>
                  </Card>
                ))
              ) : strategies.length === 0 ? (
                <Card className="col-span-full p-8 text-center">
                  <p className="text-gray-500 dark:text-gray-400">No strategies available at this time.</p>
                </Card>
              ) : filteredStrategies.map((strategy) => (
                <Card key={strategy.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <CardTitle>{strategy.name}</CardTitle>
                      <span className={`text-sm font-semibold px-2 py-1 rounded ${strategy.performance >= 0 ? 'text-green-600 bg-green-100 dark:bg-green-900/30' : 'text-red-600 bg-red-100 dark:bg-red-900/30'}`}>
                        {strategy.performance >= 0 ? '+' : ''}{strategy.performance}%
                      </span>
                    </div>
                    <CardDescription>{strategy.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-center">
                    <Image
                      src={strategy.imageUrl}
                      alt={strategy.name}
                      width={150}
                      height={150}
                      className="w-32 h-32 object-contain opacity-60"
                    />
                  </CardContent>
                  <CardFooter className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      className="w-full flex items-center justify-center"
                      onClick={() => handleViewInfo(strategy)}
                    >
                      <FiInfo className="mr-2" />
                      Info
                    </Button>
                    <Button 
                      className="w-full flex items-center justify-center"
                      onClick={() => handleDeploy(strategy)}
                    >
                      <FiPlay className="mr-2" />
                      Deploy
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!selectedStrategy} onOpenChange={(open) => !open && setSelectedStrategy(null)}>
        <DialogContent className="max-w-3xl">
          {selectedStrategy && (
            <>
              <DialogHeader>
                <DialogTitle className="text-2xl">{selectedStrategy.name}</DialogTitle>
                <DialogDescription className="text-base">{selectedStrategy.description}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="relative h-48 bg-gradient-to-br from-primary/20 to-primary/5">
                  <Image
                    src={selectedStrategy.imageUrl}
                    alt={selectedStrategy.name}
                    width={200}
                    height={200}
                    className="absolute inset-0 w-full h-full object-contain p-6"
                  />
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Strategy Details</h3>
                  <p>{selectedStrategy.details}</p>
                  
                  {selectedStrategy.contentUrl && selectedStrategy.contentType && (
                    <div className="mt-6">
                      <h3 className="text-lg font-semibold mb-2">Strategy Content</h3>
                      {selectedStrategy.contentType === 'html' ? (
                        <div className="border rounded-md p-4 bg-white">
                          <iframe 
                            src={selectedStrategy.contentUrl} 
                            className="w-full h-96 border-0" 
                            title={`${selectedStrategy.name} Content`}
                          />
                        </div>
                      ) : selectedStrategy.contentType === 'pdf' ? (
                        <div className="border rounded-md p-4 bg-white">
                          <iframe 
                            src={selectedStrategy.contentUrl} 
                            className="w-full h-96 border-0" 
                            title={`${selectedStrategy.name} PDF`}
                          />
                        </div>
                      ) : (
                        <p>No content available</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Parameters</h3>
                    <ul className="space-y-2">
                      {Object.entries(selectedStrategy.parameters).map(([key, value]) => (
                        <li key={key} className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">{key}:</span>
                          <span className="font-medium">{value}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Performance</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Performance:</span>
                        <span className={`font-medium ${selectedStrategy.performance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {selectedStrategy.performance >= 0 ? '+' : ''}{selectedStrategy.performance}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Risk Level:</span>
                        <span className="font-medium">{selectedStrategy.riskLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Category:</span>
                        <span className="font-medium">{selectedStrategy.category}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => handleDeploy(selectedStrategy)}>
                  <FiPlay className="mr-2" />
                  Deploy Strategy
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Main page with UserLayout wrapper
const StrategiesPage: React.FC = () => {
  return (
    <UserLayout>
      <StrategiesPageContent />
    </UserLayout>
  );
};

export default StrategiesPage;