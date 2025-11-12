import React, { useState, useEffect } from 'react';
import {
  FiPlus,
  FiEdit,
  FiTrash2,
  FiX,
  FiCheck,
  FiAlertCircle,
  FiChevronDown,
  FiChevronUp,
  FiUpload,
} from 'react-icons/fi';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import ScrollArea from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Badge from '@/components/ui/Badge';
import { Strategy } from "@/types/strategy";

interface ParameterRow {
  key: string;
  value: string;
  id: string;
}

const StrategyManagement: React.FC = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentStrategy, setCurrentStrategy] = useState<Partial<Strategy>>({});
  // Local range strings for plan inputs; first number will be used for payments
  const [planRanges, setPlanRanges] = useState<{ Pro?: string; Expert?: string; Premium?: string }>({});
  // Percent values per plan for user-facing display
  const [planPercents, setPlanPercents] = useState<{ Pro?: number; Expert?: number; Premium?: number }>({});
  const [parameters, setParameters] = useState<ParameterRow[]>([{ key: '', value: '', id: `param-${Date.now()}` }]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedParameters, setExpandedParameters] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<File | null>(null);
  const [contentType, setContentType] = useState<'html' | 'pdf' | 'text'>('html');

  // Fetch strategies from the API
  const fetchStrategies = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/strategies');
      if (!response.ok) {
        throw new Error('Failed to fetch strategies');
      }
      const data = await response.json();
      setStrategies(data.strategies || []);
    } catch (err) {
      setError('Failed to fetch strategies');
      console.error('Error fetching strategies:', err);
    } finally {
      setLoading(false);
    }
  };

  // Initialize by fetching strategies
  useEffect(() => {
    fetchStrategies();
  }, []);

// Reset form for adding new strategy
const resetAddForm = () => {
  setCurrentStrategy({
    name: '',
    description: '',
    imageUrl: '/strategy1.svg',
    minCapital: undefined,
    avgDrawdown: undefined,
    riskReward: undefined,
    winStreak: undefined,
    tag: '',
    planPrices: { Pro: undefined, Expert: undefined, Premium: undefined },
     details: '',
    enabled: true,
    contentType: 'html'
  });
    setPlanRanges({ Pro: '', Expert: '', Premium: '' });
    setParameters([{ key: '', value: '', id: `param-${Date.now()}` }]);
    setError(null);
    setSuccess(null);
    setSelectedFile(null);
    setSelectedIcon(null);
    setContentType('html');
  };

  // Open add strategy dialog
  const handleAddClick = () => {
    resetAddForm();
    setIsAdding(true);
    setIsEditing(false);
  };

  // Open edit strategy dialog
  const handleEditClick = (strategy: Strategy) => {
    setCurrentStrategy({ ...strategy });
    // Initialize range strings from existing numeric prices (fallback to "+" style)
    setPlanRanges({
      Pro: strategy.planPrices?.Pro !== undefined ? `$${strategy.planPrices.Pro}+` : '',
      Expert: strategy.planPrices?.Expert !== undefined ? `$${strategy.planPrices.Expert}+` : '',
      Premium: strategy.planPrices?.Premium !== undefined ? `$${strategy.planPrices.Premium}+` : ''
    });
    // Initialize percents from planDetails if present
    setPlanPercents({
      Pro: strategy as any && (strategy as any).planDetails?.Pro?.percent,
      Expert: strategy as any && (strategy as any).planDetails?.Expert?.percent,
      Premium: strategy as any && (strategy as any).planDetails?.Premium?.percent,
    });
    setParameters(Object.entries(strategy.parameters).map(([key, value]) => ({
      key,
      value,
      id: `param-${Date.now()}-${key}`
    })));
    setIsEditing(true);
    setIsAdding(false);
    setError(null);
    setSuccess(null);
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCurrentStrategy(prev => ({
      ...prev,
      [name]: name === 'performance' ? parseFloat(value) || 0 : value
    }));
  };
  
  // Handle file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  // Handle icon selection
  const handleIconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedIcon(e.target.files[0]);
    }
  };
  
  // Handle content type change
  const handleContentTypeChange = (value: 'html' | 'pdf' | 'text') => {
    setContentType(value);
    setCurrentStrategy(prev => ({
      ...prev,
      contentType: value
    }));
  };
  
  // Handle enabled status change
  const handleEnabledChange = (checked: boolean) => {
    setCurrentStrategy(prev => ({
      ...prev,
      enabled: checked
    }));
  };

  // Parse a price range string and return the first numeric value
  const parseFirstPrice = (range: string): number | undefined => {
    // Extract the first group of digits in the string
    const match = range.replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (!match) return undefined;
    const val = Number(match[0]);
    return isNaN(val) ? undefined : val;
  };

  // Handle parameter input changes
  const handleParameterChange = (id: string, field: 'key' | 'value', value: string) => {
    setParameters(prev => prev.map(param => 
      param.id === id ? { ...param, [field]: value } : param
    ));
  };

  // Add new parameter row
  const addParameter = () => {
    setParameters(prev => [...prev, { key: '', value: '', id: `param-${Date.now()}` }]);
  };

  // Remove parameter row
  const removeParameter = (id: string) => {
    if (parameters.length > 1) {
      setParameters(prev => prev.filter(param => param.id !== id));
    }
  };

  // Submit form to create or update strategy
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validate form
    if (!currentStrategy.name?.trim()) {
      setError('Strategy name is required');
      return;
    }
    if (!currentStrategy.description?.trim()) {
      setError('Description is required');
      return;
    }
    // Content validation: require text details only for text content;
    // for HTML/PDF content, allow either a new upload or existing file on edit.
    const hasTextDetails = !!currentStrategy.details?.trim();
    const hasFileOrExisting = !!selectedFile || (!!currentStrategy.contentUrl && !isAdding);
    if (contentType === 'text') {
      if (!hasTextDetails) {
        setError('Detailed description is required for text content');
        return;
      }
    } else {
      if (!hasFileOrExisting) {
        setError('Please upload a strategy document (HTML or PDF)');
        return;
      }
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Append individual fields to formData
      formData.append('name', currentStrategy.name || '');
      formData.append('description', currentStrategy.description || '');
      formData.append('details', currentStrategy.details || '');
      // Legacy imageUrl preserved when no icon selected
      formData.append('imageUrl', currentStrategy.imageUrl || '/strategy1.svg');
      formData.append('contentType', contentType);
      formData.append('contentUrl', currentStrategy.contentUrl || '');
      formData.append('enabled', String(currentStrategy.enabled ?? true));

      // New metrics/tag
      if (currentStrategy.minCapital !== undefined) formData.append('minCapital', String(currentStrategy.minCapital));
      if (currentStrategy.avgDrawdown !== undefined) formData.append('avgDrawdown', String(currentStrategy.avgDrawdown));
      if (currentStrategy.riskReward !== undefined) formData.append('riskReward', String(currentStrategy.riskReward));
      if (currentStrategy.winStreak !== undefined) formData.append('winStreak', String(currentStrategy.winStreak));
      if (currentStrategy.tag !== undefined) formData.append('tag', String(currentStrategy.tag));

      // Plans
      const pp = currentStrategy.planPrices || {};
      if (pp.Pro !== undefined) formData.append('planPro', String(pp.Pro));
      if (pp.Expert !== undefined) formData.append('planExpert', String(pp.Expert));
      if (pp.Premium !== undefined) formData.append('planPremium', String(pp.Premium));

      // Plan display details
      if (planRanges.Pro) formData.append('planProLabel', planRanges.Pro);
      if (planRanges.Expert) formData.append('planExpertLabel', planRanges.Expert);
      if (planRanges.Premium) formData.append('planPremiumLabel', planRanges.Premium);
      if (planPercents.Pro !== undefined) formData.append('planProPercent', String(planPercents.Pro));
      if (planPercents.Expert !== undefined) formData.append('planExpertPercent', String(planPercents.Expert));
      if (planPercents.Premium !== undefined) formData.append('planPremiumPercent', String(planPercents.Premium));

      // Add file if selected
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      // Add icon if selected
      if (selectedIcon) {
        formData.append('icon', selectedIcon);
      }

      let result;
      if (isAdding) {
        // Create new strategy via API
        const response = await fetch('/api/strategies/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
          throw new Error(errorData.error || 'Failed to create strategy');
        }
        
        result = await response.json();
      } else if (isEditing && currentStrategy.id) {
        // Update existing strategy via API
        const response = await fetch(`/api/strategies/upload?id=${currentStrategy.id}`, {
          method: 'PUT',
          body: formData,
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown server error' }));
          throw new Error(errorData.error || 'Failed to update strategy');
        }
        
        result = await response.json();
      }

      if (result?.success) {
        fetchStrategies(); // Refresh the list
        setSuccess(isAdding ? 'Strategy created successfully' : 'Strategy updated successfully');
        
        // Close the dialog after a short delay to show the success message
        setTimeout(() => {
          setIsAdding(false);
          setIsEditing(false);
        }, 1500);
      } else {
        setError(result?.error || 'Operation failed');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during the operation');
      console.error('Error submitting strategy:', err);
    }
  };

  // Handle delete strategy
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this strategy?')) {
      return;
    }

    try {
      const response = await fetch(`/api/strategies?id=${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete strategy');
      }
      
      const result = await response.json();
      
      if (result.success) {
        fetchStrategies(); // Refresh the list
        setSuccess('Strategy deleted successfully');
      } else {
        setError(result.error || 'Failed to delete strategy');
      }
    } catch (err) {
      setError('An error occurred while deleting the strategy');
      console.error('Error deleting strategy:', err);
    }
  };

  // Toggle parameter expansion
  const toggleParameterExpansion = (strategyId: string) => {
    setExpandedParameters(prev => ({
      ...prev,
      [strategyId]: !prev[strategyId]
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Strategy Management</h2>
          <p className="text-muted-foreground">Add, edit, and delete trading strategies</p>
        </div>
        <Button onClick={handleAddClick} className="bg-primary hover:bg-primary/90">
          <FiPlus className="mr-2 h-4 w-4" /> Add Strategy
        </Button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <Alert className="bg-green-50 text-green-800 border-green-200">
          <FiCheck className="h-4 w-4 mr-2" /> 
          <AlertTitle>Success</AlertTitle>
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert className="bg-red-50 text-red-800 border-red-200">
          <FiAlertCircle className="h-4 w-4 mr-2" /> 
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Strategies List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          // Loading state
          Array(4).fill(0).map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="animate-pulse p-6 space-y-4">
                <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                <div className="flex justify-end space-x-2 pt-4">
                  <div className="h-10 w-10 bg-gray-200 rounded"></div>
                  <div className="h-10 w-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            </Card>
          ))
        ) : strategies.length === 0 ? (
          // Empty state
          <Card className="col-span-full p-8 text-center">
            <FiAlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No strategies found</CardTitle>
            <CardDescription>Click the &apos;Add Strategy&apos; button to create your first strategy</CardDescription>
            <CardFooter className="justify-center mt-4">
              <Button onClick={handleAddClick}>
                <FiPlus className="mr-2 h-4 w-4" /> Add Strategy
              </Button>
            </CardFooter>
          </Card>
        ) : (
          // Strategies list
          strategies.map((strategy) => (
            <Card key={strategy.id} className="overflow-hidden transition-all duration-300 hover:shadow-md">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold">{strategy.name}</CardTitle>
                    <Badge variant="outline" className={strategy.enabled !== false ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'}>
                      {strategy.enabled !== false ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex space-x-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-8 w-8"
                            onClick={() => handleEditClick(strategy)}
                          >
                            <FiEdit className="h-4 w-4" />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit strategy</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(strategy.id)}
                          >
                            <FiTrash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete strategy</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
                <CardDescription>{strategy.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="font-medium text-muted-foreground">Min Capital:</span>
                    <span className="ml-1">{strategy.minCapital ?? '-'}</span>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="font-medium text-muted-foreground">Avg Drawdown:</span>
                    <span className="ml-1">{strategy.avgDrawdown ?? '-'}</span>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="font-medium text-muted-foreground">Risk Reward:</span>
                    <span className="ml-1">{strategy.riskReward ?? '-'}</span>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="font-medium text-muted-foreground">Win Streak:</span>
                    <span className="ml-1">{strategy.winStreak ?? '-'}</span>
                  </div>
                  <div className="p-2 bg-muted/50 rounded col-span-2">
                    <span className="font-medium text-muted-foreground">Tag:</span>
                    <Badge variant="outline" className="ml-1">{strategy.tag || '-'}</Badge>
                  </div>
                </div>
                
                {/* Parameters section */}
                <div className="mt-2">
                  <button
                    className="flex items-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                    onClick={() => toggleParameterExpansion(strategy.id)}
                  >
                    {expandedParameters[strategy.id] ? (
                      <FiChevronUp className="mr-1 h-4 w-4" />
                    ) : (
                      <FiChevronDown className="mr-1 h-4 w-4" />
                    )}
                    Parameters
                  </button>
                  
                  {expandedParameters[strategy.id] && (
                    <div className="mt-2 space-y-1 text-sm">
                      {Object.entries(strategy.parameters).map(([key, value]) => (
                        <div key={key} className="p-1.5 bg-muted/30 rounded">
                          <span className="font-medium">{key}:</span>
                          <span className="ml-1">{value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Add/Edit Strategy Dialog */}
      <Dialog open={isAdding || isEditing} onOpenChange={(open: boolean) => !open && (setIsAdding(false), setIsEditing(false))}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{isAdding ? 'Add New Strategy' : 'Edit Strategy'}</DialogTitle>
            <DialogDescription>
              {isAdding ? 'Create a new trading strategy that will be available to all users.' : 'Update the details of this trading strategy.'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contentType">Content Type</Label>
                  <Select
                    value={contentType}
                    onValueChange={(value) => handleContentTypeChange(value as 'html' | 'pdf' | 'text')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="html">HTML Document</SelectItem>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="file">Upload Strategy Document</Label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-md p-4">
                    <Input
                      id="file"
                      type="file"
                      accept={contentType === 'html' ? '.html,.htm' : '.pdf'}
                      onChange={handleFileChange}
                      className="cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {contentType === 'html' ? 'Upload HTML file with strategy details' : 'Upload PDF document with strategy details'}
                    </p>
                    {selectedFile && (
                      <div className="mt-2 text-sm text-green-600 dark:text-green-400">
                        Selected: {selectedFile.name}
                      </div>
                    )}
                    {currentStrategy.contentUrl && !selectedFile && (
                      <div className="mt-2 text-sm">
                        Current file: <a href={currentStrategy.contentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">View</a>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Basic Information */}
              <div className="space-y-2">
                <Label htmlFor="name">Strategy Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={currentStrategy.name || ''}
                  onChange={handleInputChange}
                  placeholder="Enter strategy name"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description">Short Description *</Label>
                <Input
                  id="description"
                  name="description"
                  value={currentStrategy.description || ''}
                  onChange={handleInputChange}
                  placeholder="Enter a brief description"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="details">Detailed Description *</Label>
                <Textarea
                  id="details"
                  name="details"
                  value={currentStrategy.details || ''}
                  onChange={handleInputChange}
                  placeholder="Enter detailed information about the strategy"
                  rows={4}
                  required
                />
              </div>
              
              {/* Strategy Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon">Upload Icon/Image</Label>
                  <Input
                    id="icon"
                    type="file"
                    accept="image/*"
                    onChange={handleIconChange}
                    className="cursor-pointer"
                  />
                  {currentStrategy.imageUrl && !selectedIcon && (
                    <p className="text-xs mt-1">Current: <span className="underline">{currentStrategy.imageUrl}</span></p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enabled">Status</Label>
                  <div className="flex items-center space-x-2">
                    <Switch 
                      id="enabled" 
                      checked={currentStrategy.enabled !== false}
                      onCheckedChange={handleEnabledChange}
                    />
                    <Label htmlFor="enabled" className="cursor-pointer">
                      {currentStrategy.enabled !== false ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>
              </div>
              
              {/* Strategy Content Upload */}
              <div className="space-y-3">
                <Label>Upload Strategy Document (HTML or PDF) *</Label>
                <Input
                  type="file"
                  accept={contentType === 'pdf' ? 'application/pdf' : '.html,text/html'}
                  onChange={handleFileChange}
                />
              </div>

              {/* New Metrics */}
              <Separator className="my-2" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="minCapital">Min Capital</Label>
                  <Input id="minCapital" name="minCapital" type="number" value={String(currentStrategy.minCapital ?? '')} onChange={handleInputChange} placeholder="e.g. 1000" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="avgDrawdown">Avg Drawdown (%)</Label>
                  <Input id="avgDrawdown" name="avgDrawdown" type="number" step="0.01" value={String(currentStrategy.avgDrawdown ?? '')} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="riskReward">Risk Reward</Label>
                  <Input id="riskReward" name="riskReward" type="number" step="0.01" value={String(currentStrategy.riskReward ?? '')} onChange={handleInputChange} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="winStreak">Win Streak</Label>
                  <Input id="winStreak" name="winStreak" type="number" value={String(currentStrategy.winStreak ?? '')} onChange={handleInputChange} />
                </div>
              </div>

              {/* Tag */}
              <div className="space-y-2">
                <Label htmlFor="tag">Tag</Label>
                <Input id="tag" name="tag" value={currentStrategy.tag || ''} onChange={handleInputChange} placeholder="Enter tag" />
              </div>

              {/* Plans: enter USD ranges; first number used for payments */}
              <Separator className="my-2" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                  <Label htmlFor="planPro">Pro Price</Label>
                  <Input
                    id="planPro"
                    name="planPro"
                    type="text"
                    placeholder="$1000-$2999"
                    value={planRanges.Pro ?? ''}
                    onChange={(e) => {
                      const text = e.target.value;
                      setPlanRanges(prev => ({ ...prev, Pro: text }));
                      const first = parseFirstPrice(text);
                      setCurrentStrategy(prev => ({
                        ...prev,
                        planPrices: { ...(prev.planPrices || {}), Pro: first }
                      }));
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="planProPercent">Pro Percent (%)</Label>
                    <Input
                      id="planProPercent"
                      name="planProPercent"
                      type="number"
                      step="0.01"
                      placeholder="17"
                      value={planPercents.Pro ?? '' as any}
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = val === '' ? undefined : Number(val);
                        setPlanPercents(prev => ({ ...prev, Pro: isNaN(num as any) ? undefined : num }));
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Enter USD range; first number used for payments.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planExpert">Expert Price</Label>
                  <Input
                    id="planExpert"
                    name="planExpert"
                    type="text"
                    placeholder="$3000-$5999"
                    value={planRanges.Expert ?? ''}
                    onChange={(e) => {
                      const text = e.target.value;
                      setPlanRanges(prev => ({ ...prev, Expert: text }));
                      const first = parseFirstPrice(text);
                      setCurrentStrategy(prev => ({
                        ...prev,
                        planPrices: { ...(prev.planPrices || {}), Expert: first }
                      }));
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="planExpertPercent">Expert Percent (%)</Label>
                    <Input
                      id="planExpertPercent"
                      name="planExpertPercent"
                      type="number"
                      step="0.01"
                      placeholder="15"
                      value={planPercents.Expert ?? '' as any}
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = val === '' ? undefined : Number(val);
                        setPlanPercents(prev => ({ ...prev, Expert: isNaN(num as any) ? undefined : num }));
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Enter USD range; first number used for payments.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="planPremium">Premium Price</Label>
                  <Input
                    id="planPremium"
                    name="planPremium"
                    type="text"
                    placeholder="$6000+"
                    value={planRanges.Premium ?? ''}
                    onChange={(e) => {
                      const text = e.target.value;
                      setPlanRanges(prev => ({ ...prev, Premium: text }));
                      const first = parseFirstPrice(text);
                      setCurrentStrategy(prev => ({
                        ...prev,
                        planPrices: { ...(prev.planPrices || {}), Premium: first }
                      }));
                    }}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="planPremiumPercent">Premium Percent (%)</Label>
                    <Input
                      id="planPremiumPercent"
                      name="planPremiumPercent"
                      type="number"
                      step="0.01"
                      placeholder="12"
                      value={planPercents.Premium ?? '' as any}
                      onChange={(e) => {
                        const val = e.target.value;
                        const num = val === '' ? undefined : Number(val);
                        setPlanPercents(prev => ({ ...prev, Premium: isNaN(num as any) ? undefined : num }));
                      }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">Enter USD range; first number used for payments.</p>
                </div>
              </div>
            </form>
          </ScrollArea>
          
          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsAdding(false);
                setIsEditing(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit" onClick={handleSubmit}>
              {isAdding ? 'Create Strategy' : 'Update Strategy'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StrategyManagement;
