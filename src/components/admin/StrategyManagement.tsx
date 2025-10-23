import React, { useState, useEffect } from 'react';
import {
  FiPlus, 
  FiEdit, 
  FiTrash2, 
  FiX, 
  FiCheck, 
  FiAlertCircle, 
  FiChevronDown, 
  FiChevronUp 
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
  created_at: string;
  updated_at: string;
  contentType: 'html' | 'pdf' | 'text';
  contentUrl: string;
  enabled: boolean;
}

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
  const [parameters, setParameters] = useState<ParameterRow[]>([{ key: '', value: '', id: `param-${Date.now()}` }]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [expandedParameters, setExpandedParameters] = useState<Record<string, boolean>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      performance: 0,
      riskLevel: 'Medium',
      category: 'Growth',
      imageUrl: '/strategy1.svg',
      details: '',
      enabled: true,
      contentType: 'html'
    });
    setParameters([{ key: '', value: '', id: `param-${Date.now()}` }]);
    setError(null);
    setSuccess(null);
    setSelectedFile(null);
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
    if (!currentStrategy.details?.trim()) {
      setError('Detailed description is required');
      return;
    }

    if (!selectedFile && isAdding) {
      setError('Please upload a strategy document (HTML or PDF)');
      return;
    }

    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // Append individual fields to formData (no performance/risk/category/parameters)
      formData.append('name', currentStrategy.name || '');
      formData.append('description', currentStrategy.description || '');
      formData.append('details', currentStrategy.details || '');
      formData.append('imageUrl', currentStrategy.imageUrl || '/strategy1.svg');
      formData.append('contentType', contentType);
      formData.append('enabled', String(currentStrategy.enabled ?? true));

      // Add file if selected
      if (selectedFile) {
        formData.append('file', selectedFile);
      }

      let result;
      if (isAdding) {
        // Create new strategy via API
        const response = await fetch('/api/strategies/upload', {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to create strategy');
        }
        
        result = await response.json();
      } else if (isEditing && currentStrategy.id) {
        // Update existing strategy via API
        const response = await fetch(`/api/strategies/upload?id=${currentStrategy.id}`, {
          method: 'PUT',
          body: formData,
        });
        
        if (!response.ok) {
          throw new Error('Failed to update strategy');
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
    } catch (err) {
      setError('An error occurred during the operation');
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
                  <CardTitle className="text-xl font-bold">{strategy.name}</CardTitle>
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
                    <span className="font-medium text-muted-foreground">Performance:</span>
                    <span className="ml-1 font-semibold text-green-600">{strategy.performance}%</span>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="font-medium text-muted-foreground">Risk Level:</span>
                    <Badge variant="outline" className="ml-1">
                      {strategy.riskLevel}
                    </Badge>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="font-medium text-muted-foreground">Category:</span>
                    <Badge variant="outline" className="ml-1">
                      {strategy.category}
                    </Badge>
                  </div>
                  <div className="p-2 bg-muted/50 rounded">
                    <span className="font-medium text-muted-foreground">Created:</span>
                    <span className="ml-1">{new Date(strategy.created_at).toLocaleDateString()}</span>
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
                  <Label htmlFor="imageUrl">Image URL</Label>
                  <Input
                    id="imageUrl"
                    name="imageUrl"
                    value={currentStrategy.imageUrl || ''}
                    onChange={handleInputChange}
                    placeholder="/strategy1.svg"
                  />
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