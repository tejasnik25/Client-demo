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
  const [lotRows, setLotRows] = useState<{ amountUSD: string; lot: string; id: string }[]>([
    { amountUSD: '', lot: '', id: `lot-${Date.now()}` },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedParameters, setExpandedParameters] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedIcon, setSelectedIcon] = useState<File | null>(null);
  const [contentType, setContentType] = useState<'html' | 'pdf' | 'text'>('html');
  const [countryFlag, setCountryFlag] = useState<string>('');

  // Fetch strategies from the API
  const fetchStrategies = async () => {
    try {
      setLoading(true);
      // Prefer admin endpoint to include master details
      let response = await fetch('/api/admin/strategies', { cache: 'no-store' });
      if (response.status === 401) {
        // Fallback to public endpoint without master details
        response = await fetch('/api/strategies', { cache: 'no-store' });
      }
      if (!response.ok) throw new Error('Failed to fetch strategies');
      const data = await response.json();
      setStrategies(Array.isArray(data.strategies) ? data.strategies : []);
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
    mastersTag: '',
    riskLevel: 'Medium',
    roi: undefined,
    profit: undefined,
    maxDdi: undefined,
    copiers: undefined,
    riskScore: undefined,
    planPrices: { Pro: undefined, Expert: undefined, Premium: undefined },
     details: '',
    enabled: true,
    contentType: 'html',
    masterAccountId: '',
    masterAccountPassword: '',
    masterAccountServer: '',
    masterPlatform: 'mt5'
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
    try {
      const lp = (strategy.parameters as any)?.lotPricing;
      if (lp) {
        const arr = JSON.parse(lp);
        if (Array.isArray(arr) && arr.length > 0) {
          setLotRows(
            arr.map((r: any, idx: number) => ({
              amountUSD: String(r.amountUSD ?? ''),
              lot: String(r.lot ?? ''),
              id: `lot-${Date.now()}-${idx}`,
            }))
          );
        } else {
          setLotRows([{ amountUSD: '', lot: '', id: `lot-${Date.now()}` }]);
        }
      } else {
        setLotRows([{ amountUSD: '', lot: '', id: `lot-${Date.now()}` }]);
      }
    } catch {
      setLotRows([{ amountUSD: '', lot: '', id: `lot-${Date.now()}` }]);
    }
    setCountryFlag((strategy.parameters && (strategy.parameters as any).countryFlag) || '');
    setIsEditing(true);
    setIsAdding(false);
    setError(null);
    setSuccess(null);
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Don't use this for password as it has its own logic to avoid state reset issues
    if (name === 'masterAccountPassword') return;
    
    setCurrentStrategy(prev => ({
      ...prev,
      [name]: name === 'performance' || name === 'roi' || name === 'profit' || name === 'maxDdi' || name === 'copiers' || name === 'riskScore'
        ? (value === '' ? undefined : parseFloat(value) || 0) 
        : value
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
      if (currentStrategy.roi !== undefined) formData.append('roi', String(currentStrategy.roi));
      if (currentStrategy.profit !== undefined) formData.append('profit', String(currentStrategy.profit));
      if (currentStrategy.maxDdi !== undefined) formData.append('maxDdi', String(currentStrategy.maxDdi));
      if (currentStrategy.copiers !== undefined) formData.append('copiers', String(currentStrategy.copiers));
      if (currentStrategy.riskScore !== undefined) formData.append('riskScore', String(currentStrategy.riskScore));
      if (currentStrategy.tag !== undefined) formData.append('tag', String(currentStrategy.tag));
      formData.append('mastersTag', String(currentStrategy.mastersTag || ''));
      if (currentStrategy.riskLevel) formData.append('riskLevel', String(currentStrategy.riskLevel));

      // Master Account Details
      if (currentStrategy.masterAccountId) formData.append('masterAccountId', currentStrategy.masterAccountId);
      if (currentStrategy.masterAccountPassword) formData.append('masterAccountPassword', currentStrategy.masterAccountPassword);
      if (currentStrategy.masterAccountServer) formData.append('masterAccountServer', currentStrategy.masterAccountServer);
      if (currentStrategy.masterPlatform) formData.append('masterPlatform', currentStrategy.masterPlatform);

      // Plans: removed Pro/Expert/Premium specific inputs per request
      // We will now only use the base lot pricing
      formData.append('planPro', '0');
      formData.append('planExpert', '0');
      formData.append('planPremium', '0');
      formData.append('planProPercent', '0');
      formData.append('planExpertPercent', '0');
      formData.append('planPremiumPercent', '0');

      // Lot pricing rows -> JSON string
      const lotPricing = lotRows
        .map((r) => ({
          amountUSD: Number((r.amountUSD || '').replace(/,/g, '')),
          lot: Number((r.lot || '').replace(/,/g, '')),
        }))
        .filter((r) => Number.isFinite(r.amountUSD) && r.amountUSD > 0 && Number.isFinite(r.lot) && r.lot > 0);
      if (lotPricing.length > 0) {
        formData.append('lotPricing', JSON.stringify(lotPricing));
      }

      if (countryFlag) {
        formData.append('countryFlag', countryFlag);
      }

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
          <h2 className="text-2xl font-bold text-gray-900">Strategy Management</h2>
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
            <Card key={index} className="overflow-hidden bg-white border border-gray-200">
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
          <Card className="col-span-full p-8 text-center bg-white border border-gray-200">
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
            <Card key={strategy.id} className="overflow-hidden transition-all duration-300 hover:shadow-md bg-white border border-gray-200">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-xl font-bold text-gray-900">{strategy.name}</CardTitle>
                    <Badge variant="outline" className={strategy.enabled !== false ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>
                      {strategy.enabled !== false ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </div>
                  <div className="flex space-x-1">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-8 w-8 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
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
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
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
                <CardDescription className="text-gray-500">{strategy.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-600">ROI:</span>
                    <span className="ml-1 text-gray-900">{strategy.roi ?? '-'}%</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-600">Profit:</span>
                    <span className="ml-1 text-gray-900">+{strategy.profit ?? '-'}</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-600">Max DDI:</span>
                    <span className="ml-1 text-gray-900">{strategy.maxDdi ?? '-'}%</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-600">Copiers:</span>
                    <span className="ml-1 text-gray-900">{strategy.copiers ?? '-'}</span>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-600">Tag:</span>
                    <Badge variant="outline" className="ml-1">{strategy.tag || '-'}</Badge>
                  </div>
                  <div className="p-2 bg-gray-50 rounded">
                    <span className="font-medium text-gray-600">Master's Name:</span>
                    <Badge variant="outline" className="ml-1">{strategy.mastersTag || '-'}</Badge>
                  </div>
                  <div className="p-2 bg-gray-50 rounded col-span-2">
                    <span className="font-medium text-gray-600">Master Account:</span>
                    <span className="ml-1 text-gray-900">
                      {(strategy.masterAccountId && strategy.masterAccountId.trim().length > 0) ? strategy.masterAccountId : '-'}
                    </span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="font-medium text-gray-600">Server:</span>
                    <span className="ml-1 text-gray-900">
                      {(strategy.masterAccountServer && strategy.masterAccountServer.trim().length > 0) ? strategy.masterAccountServer : '-'}
                    </span>
                    <span className="mx-2 text-gray-400">•</span>
                    <span className="font-medium text-gray-600">Platform:</span>
                    <span className="ml-1 text-gray-900">
                      {(strategy.masterPlatform || '').toUpperCase() || '-'}
                    </span>
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
                        <div key={key} className="p-1.5 bg-gray-50 rounded border border-gray-100">
                          <span className="font-medium text-gray-700">{key}:</span>
                          <span className="ml-1 text-gray-900">{value}</span>
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
        <DialogContent className="sm:max-w-3xl bg-white border border-gray-200 text-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900">{isAdding ? 'Add New Strategy' : 'Edit Strategy'}</DialogTitle>
            <DialogDescription className="text-gray-500">
              {isAdding ? 'Create a new trading strategy that will be available to all users.' : 'Update the details of this trading strategy.'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] pr-4">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="contentType" className="text-gray-700">Content Type</Label>
                  <Select
                    value={contentType}
                    onValueChange={(value) => handleContentTypeChange(value as 'html' | 'pdf' | 'text')}
                  >
                  <SelectTrigger className="bg-white border border-gray-300 text-gray-900">
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-200">
                      <SelectItem value="html">HTML Document</SelectItem>
                      <SelectItem value="pdf">PDF Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-gray-700">Upload Strategy Document</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-md p-4 bg-gray-50">
                    <Input
                      id="file"
                      type="file"
                      accept={contentType === 'html' ? '.html,.htm' : '.pdf'}
                      onChange={handleFileChange}
                      className="cursor-pointer bg-white border-gray-300 text-gray-900"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      {contentType === 'html' ? 'Upload HTML file with strategy details' : 'Upload PDF document with strategy details'}
                    </p>
                    {selectedFile && (
                      <div className="mt-2 text-sm text-green-600">
                        Selected: {selectedFile.name}
                      </div>
                    )}
                    {currentStrategy.contentUrl && !selectedFile && (
                        <div className="mt-2 text-sm">
                          Current file: <a href={currentStrategy.contentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">View</a>
                          </div>
                    )}
                  </div>
                </div>
              </div>
              {/* Basic Information */}
              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-700">Strategy Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={currentStrategy.name || ''}
                  onChange={handleInputChange}
                  placeholder="Enter strategy name"
                  required
                className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-700">Short Description *</Label>
                <Input
                  id="description"
                  name="description"
                  value={currentStrategy.description || ''}
                  onChange={handleInputChange}
                  placeholder="Enter a brief description"
                  required
                className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="details" className="text-gray-700">Detailed Description *</Label>
                <Textarea
                  id="details"
                  name="details"
                  value={currentStrategy.details || ''}
                  onChange={handleInputChange}
                  placeholder="Enter detailed information about the strategy"
                  rows={4}
                  required
                className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
              </div>
              
              {/* Strategy Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icon" className="text-gray-700">Upload Icon/Image</Label>
                  <Input
                    id="icon"
                    type="file"
                    accept="image/*"
                    onChange={handleIconChange}
                    className="cursor-pointer bg-white border-gray-300 text-gray-900"
                  />
                  {currentStrategy.imageUrl && !selectedIcon && (
                    <p className="text-xs mt-1 text-gray-600">Current: <span className="underline">{currentStrategy.imageUrl}</span></p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enabled" className="text-gray-700">Status</Label>
                  <div className="flex items-center space-x-2">
                  <Switch 
                    id="enabled" 
                    checked={currentStrategy.enabled !== false}
                    onCheckedChange={handleEnabledChange}
                  />
                    <Label htmlFor="enabled" className="cursor-pointer text-gray-700">
                      {currentStrategy.enabled !== false ? 'Enabled' : 'Disabled'}
                    </Label>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-gray-700">Country Flag</Label>
                <Select
                  value={countryFlag}
                  onValueChange={(value) => setCountryFlag(value)}
                >
                  <SelectTrigger className="bg-white border border-gray-300 text-gray-900">
                    <SelectValue placeholder="Select country" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200 max-h-64 overflow-y-auto">
                    <SelectItem value="US">🇺🇸 United States</SelectItem>
                    <SelectItem value="GB">🇬🇧 United Kingdom</SelectItem>
                    <SelectItem value="CA">🇨🇦 Canada</SelectItem>
                    <SelectItem value="AU">🇦🇺 Australia</SelectItem>
                    <SelectItem value="NZ">🇳🇿 New Zealand</SelectItem>
                    <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                    <SelectItem value="FR">🇫🇷 France</SelectItem>
                    <SelectItem value="ES">🇪🇸 Spain</SelectItem>
                    <SelectItem value="IT">🇮🇹 Italy</SelectItem>
                    <SelectItem value="NL">🇳🇱 Netherlands</SelectItem>
                    <SelectItem value="SE">🇸🇪 Sweden</SelectItem>
                    <SelectItem value="NO">🇳🇴 Norway</SelectItem>
                    <SelectItem value="DK">🇩🇰 Denmark</SelectItem>
                    <SelectItem value="FI">🇫🇮 Finland</SelectItem>
                    <SelectItem value="CH">🇨🇭 Switzerland</SelectItem>
                    <SelectItem value="BE">🇧🇪 Belgium</SelectItem>
                    <SelectItem value="IE">🇮🇪 Ireland</SelectItem>
                    <SelectItem value="PL">🇵🇱 Poland</SelectItem>
                    <SelectItem value="CZ">🇨🇿 Czechia</SelectItem>
                    <SelectItem value="AT">🇦🇹 Austria</SelectItem>
                    <SelectItem value="PT">🇵🇹 Portugal</SelectItem>
                    <SelectItem value="GR">🇬🇷 Greece</SelectItem>
                    <SelectItem value="RO">🇷🇴 Romania</SelectItem>
                    <SelectItem value="HU">🇭🇺 Hungary</SelectItem>
                    <SelectItem value="BR">🇧🇷 Brazil</SelectItem>
                    <SelectItem value="MX">🇲🇽 Mexico</SelectItem>
                    <SelectItem value="AR">🇦🇷 Argentina</SelectItem>
                    <SelectItem value="CL">🇨🇱 Chile</SelectItem>
                    <SelectItem value="CO">🇨🇴 Colombia</SelectItem>
                    <SelectItem value="PE">🇵🇪 Peru</SelectItem>
                    <SelectItem value="CN">🇨🇳 China</SelectItem>
                    <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                    <SelectItem value="KR">🇰🇷 South Korea</SelectItem>
                    <SelectItem value="IN">🇮🇳 India</SelectItem>
                    <SelectItem value="ID">🇮🇩 Indonesia</SelectItem>
                    <SelectItem value="SG">🇸🇬 Singapore</SelectItem>
                    <SelectItem value="MY">🇲🇾 Malaysia</SelectItem>
                    <SelectItem value="TH">🇹🇭 Thailand</SelectItem>
                    <SelectItem value="VN">🇻🇳 Vietnam</SelectItem>
                    <SelectItem value="PH">🇵🇭 Philippines</SelectItem>
                    <SelectItem value="AE">🇦🇪 United Arab Emirates</SelectItem>
                    <SelectItem value="SA">🇸🇦 Saudi Arabia</SelectItem>
                    <SelectItem value="TR">🇹🇷 Türkiye</SelectItem>
                    <SelectItem value="EG">🇪🇬 Egypt</SelectItem>
                    <SelectItem value="ZA">🇿🇦 South Africa</SelectItem>
                    <SelectItem value="NG">🇳🇬 Nigeria</SelectItem>
                    <SelectItem value="KE">🇰🇪 Kenya</SelectItem>
                    <SelectItem value="RU">🇷🇺 Russia</SelectItem>
                    <SelectItem value="UA">🇺🇦 Ukraine</SelectItem>
                    <SelectItem value="IL">🇮🇱 Israel</SelectItem>
                    <SelectItem value="HK">🇭🇰 Hong Kong</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Strategy Content Upload */}
              <div className="space-y-3">
                <Label className="text-gray-700">Upload Strategy Document (HTML or PDF) *</Label>
                <Input
                  type="file"
                  accept={contentType === 'pdf' ? 'application/pdf' : '.html,text/html'}
                  onChange={handleFileChange}
                className="bg-white border border-gray-300 text-gray-900" />
              </div>

              {/* New Metrics */}
              <Separator className="my-2 bg-gray-200" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="roi" className="text-gray-700">ROI (%)</Label>
                  <Input id="roi" name="roi" type="number" step="0.01" value={String(currentStrategy.roi ?? '')} onChange={handleInputChange} placeholder="e.g. 15.5" className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="riskScore" className="text-gray-700">Risk Score</Label>
                  <Input id="riskScore" name="riskScore" type="number" step="0.01" value={String(currentStrategy.riskScore ?? '')} onChange={handleInputChange} placeholder="e.g. 2.5" className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profit" className="text-gray-700">Profit</Label>
                  <Input id="profit" name="profit" type="number" step="0.01" value={String(currentStrategy.profit ?? '')} onChange={handleInputChange} placeholder="e.g. 2500" className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxDdi" className="text-gray-700">Max DDI (%)</Label>
                  <Input id="maxDdi" name="maxDdi" type="number" step="0.01" value={String(currentStrategy.maxDdi ?? '')} onChange={handleInputChange} placeholder="e.g. 5.2" className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="copiers" className="text-gray-700">Copiers</Label>
                  <Input id="copiers" name="copiers" type="number" value={String(currentStrategy.copiers ?? '')} onChange={handleInputChange} placeholder="e.g. 150" className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
                </div>
              </div>

              {/* Tag */}
              <div className="space-y-2">
                <Label htmlFor="tag" className="text-gray-700">Tag</Label>
                <Input id="tag" name="tag" value={currentStrategy.tag || ''} onChange={handleInputChange} placeholder="Enter tag" className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
              </div>

              {/* Risk Tag */}
              <div className="space-y-2">
                <Label htmlFor="riskLevel" className="text-gray-700">Risk Tag</Label>
                <Select
                  value={currentStrategy.riskLevel || ''}
                  onValueChange={(value) => setCurrentStrategy(prev => ({ ...prev, riskLevel: value as 'Low' | 'Medium' | 'High' }))}
                >
                  <SelectTrigger className="bg-white border border-gray-300 text-gray-900">
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Master's Tag */}
              <div className="space-y-2">
                <Label htmlFor="mastersTag" className="text-gray-700">Master's Name</Label>
                <Input id="mastersTag" name="mastersTag" value={currentStrategy.mastersTag || ''} onChange={handleInputChange} placeholder="Enter master's tag" className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" />
              </div>

              {/* Master Account Details */}
              <Separator className="my-2 bg-gray-200" />
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 mb-4">
                <Label className="text-lg font-semibold text-blue-900 mb-2 block">Master Account Connection (Required)</Label>
                <p className="text-sm text-blue-700 mb-4">
                  These credentials are required for the copy trading engine to connect to the Master account.
                  <br />
                  <span className="font-bold">Note:</span> If updating an existing strategy, please re-enter the password to ensure connectivity.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="masterAccountId" className="text-gray-700">Account ID</Label>
                    <Input 
                      id="masterAccountId" 
                      name="masterAccountId" 
                      value={currentStrategy.masterAccountId || ''} 
                      onChange={handleInputChange} 
                      placeholder="Enter MT account ID" 
                      className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="masterAccountPassword" className="text-gray-700">Account Password</Label>
                    <Input 
                      id="masterAccountPassword" 
                      name="masterAccountPassword" 
                      type="password"
                      autoComplete="new-password"
                      placeholder={currentStrategy.hasMasterPassword ? "•••••••• (Saved)" : "MT5 Password"}
                      value={currentStrategy.masterAccountPassword || ''} 
                      onChange={(e) => {
                        const val = e.target.value;
                        setCurrentStrategy(prev => ({ ...prev, masterAccountPassword: val }));
                      }}
                      className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-primary" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="masterAccountServer" className="text-gray-700">Server</Label>
                    <Input 
                      id="masterAccountServer" 
                      name="masterAccountServer" 
                      value={currentStrategy.masterAccountServer || ''} 
                      onChange={handleInputChange} 
                      placeholder="e.g. MetaQuotes-Demo" 
                      className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="masterPlatform" className="text-gray-700">Platform</Label>
                    <Select
                      value={currentStrategy.masterPlatform || 'mt5'}
                      onValueChange={(value) => setCurrentStrategy(prev => ({ ...prev, masterPlatform: value as 'mt4' | 'mt5' }))}
                    >
                      <SelectTrigger className="bg-white border border-gray-300 text-gray-900">
                        <SelectValue placeholder="Select platform" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-200">
                        <SelectItem value="mt4">MetaTrader 4</SelectItem>
                        <SelectItem value="mt5">MetaTrader 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Plans: removed Pro/Expert/Premium specific inputs per request */}
              <Separator className="my-2 bg-gray-200" />

          {/* Lot Size Pricing */}
          <Separator className="my-4 bg-gray-200" />
          <div className="space-y-4">
            <Label className="text-gray-700 font-bold text-lg">Lot Size Pricing</Label>
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
              <div className="space-y-2 max-w-md">
                <Label className="text-gray-700 font-semibold">Price for 1 Lot (USD) *</Label>
                <Input
                  type="number"
                  value={(lotRows[0] && lotRows[0].amountUSD) || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setLotRows([{ amountUSD: v, lot: '1', id: `lot-1` }]);
                  }}
                  placeholder="e.g. 25"
                  className="bg-white border border-gray-300 text-gray-900 placeholder:text-gray-400 font-medium"
                  required
                />
                <p className="text-xs text-gray-500 italic">
                  Admin should enter the price for 1 Lot only. The system will automatically calculate pricing for Equal (x1), Double (x2), Triple (x3), and Custom lot sizes.
                </p>
              </div>
              
              {lotRows[0]?.amountUSD && Number(lotRows[0].amountUSD) > 0 && (
                <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-gray-200">
                  <div className="text-center p-2 bg-white rounded border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase font-bold">x1 (Equal)</div>
                    <div className="text-sm font-bold text-primary">${Number(lotRows[0].amountUSD).toFixed(2)}</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase font-bold">x2 (Double)</div>
                    <div className="text-sm font-bold text-primary">${(Number(lotRows[0].amountUSD) * 2).toFixed(2)}</div>
                  </div>
                  <div className="text-center p-2 bg-white rounded border border-gray-100">
                    <div className="text-xs text-gray-500 uppercase font-bold">x3 (Triple)</div>
                    <div className="text-sm font-bold text-primary">${(Number(lotRows[0].amountUSD) * 3).toFixed(2)}</div>
                  </div>
                </div>
              )}
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
