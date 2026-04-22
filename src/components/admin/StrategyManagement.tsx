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
  const [strategyCurrency, setStrategyCurrency] = useState<'USD' | 'USC'>('USD');
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
  const [commissionPercent, setCommissionPercent] = useState<string>('30');
  const currencyPrefix = strategyCurrency === 'USC' ? 'USC ' : '$';
  const baseLotPrice = Number((lotRows[0]?.amountUSD || '').replace(/,/g, ''));
  const hasBaseLotPrice = Number.isFinite(baseLotPrice) && baseLotPrice > 0;
  const derivedPlanPrices = hasBaseLotPrice
    ? {
        Pro: baseLotPrice,
        Expert: baseLotPrice * 2,
        Premium: baseLotPrice * 3,
      }
    : currentStrategy.planPrices;

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
    setStrategyCurrency('USD');
    setPlanRanges({ Pro: '', Expert: '', Premium: '' });
    setParameters([{ key: '', value: '', id: `param-${Date.now()}` }]);
  setCommissionPercent('30');
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
    const initialPlanPrices = strategy.planPrices || { Pro: undefined, Expert: undefined, Premium: undefined };

    // fallback from lotPricing parameter when planPrices is missing
    if ((initialPlanPrices.Pro === undefined || initialPlanPrices.Expert === undefined || initialPlanPrices.Premium === undefined)) {
      try {
        const lp = (strategy.parameters as any)?.lotPricing;
        if (typeof lp === 'string') {
          const parsedLp = JSON.parse(lp);
          if (Array.isArray(parsedLp) && parsedLp[0]?.amountUSD) {
            const base = Number(parsedLp[0].amountUSD);
            if (Number.isFinite(base) && base > 0) {
              initialPlanPrices.Pro = initialPlanPrices.Pro ?? base;
              initialPlanPrices.Expert = initialPlanPrices.Expert ?? base * 2;
              initialPlanPrices.Premium = initialPlanPrices.Premium ?? base * 3;
            }
          }
        }
      } catch {
        // ignore parse errors
      }
    }

    setCurrentStrategy({
      ...strategy,
      planPrices: initialPlanPrices,
      minCapital: (strategy as any).minCapital ?? (strategy as any).min_capital,
      avgDrawdown: (strategy as any).avgDrawdown ?? (strategy as any).avg_drawdown,
      riskReward: (strategy as any).riskReward ?? (strategy as any).risk_reward,
      winStreak: (strategy as any).winStreak ?? (strategy as any).win_streak,
    });

    // Initialize range strings from existing numeric prices (fallback to "+" style)
    setPlanRanges({
      Pro: initialPlanPrices.Pro !== undefined ? `$${initialPlanPrices.Pro}+` : '',
      Expert: initialPlanPrices.Expert !== undefined ? `$${initialPlanPrices.Expert}+` : '',
      Premium: initialPlanPrices.Premium !== undefined ? `$${initialPlanPrices.Premium}+` : ''
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
    {
      const cur = String((strategy.parameters as any)?.currency || 'USD').toUpperCase();
      setStrategyCurrency(cur === 'USC' ? 'USC' : 'USD');
    }
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
    // Commission is stored in parameters.commission (single commission field when no plan system).
    const rawCommission =
      (strategy.parameters && ((strategy.parameters as any).commission ?? (strategy.parameters as any).Commission)) || '';
    const m = String(rawCommission).match(/-?\d+(\.\d+)?/);
    setCommissionPercent(m ? String(m[0]) : '30');
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
      [name]: ['performance','roi','profit','maxDdi','copiers','riskScore','minCapital','avgDrawdown','riskReward','winStreak'].includes(name)
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

  // Handle plan price override values
  const handlePlanPriceChange = (plan: 'Pro' | 'Expert' | 'Premium', value: string) => {
    setCurrentStrategy(prev => {
      const priceObj = { ...(prev.planPrices || { Pro: undefined, Expert: undefined, Premium: undefined }) };
      priceObj[plan] = value === '' ? undefined : Number(value);
      return { ...prev, planPrices: priceObj };
    });
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
      if (currentStrategy.minCapital !== undefined) formData.append('minCapital', String(currentStrategy.minCapital));
      if (currentStrategy.avgDrawdown !== undefined) formData.append('avgDrawdown', String(currentStrategy.avgDrawdown));
      if (currentStrategy.riskReward !== undefined) formData.append('riskReward', String(currentStrategy.riskReward));
      if (currentStrategy.winStreak !== undefined) formData.append('winStreak', String(currentStrategy.winStreak));
      if (currentStrategy.tag !== undefined) formData.append('tag', String(currentStrategy.tag));
      formData.append('mastersTag', String(currentStrategy.mastersTag || ''));
      if (currentStrategy.riskLevel) formData.append('riskLevel', String(currentStrategy.riskLevel));

      // Plan price values should stay aligned with the 1-lot base price preview.
      const planPriceObj = hasBaseLotPrice
        ? derivedPlanPrices
        : (currentStrategy.planPrices || {});
      if (planPriceObj?.Pro !== undefined) formData.append('planPro', String(planPriceObj.Pro));
      if (planPriceObj?.Expert !== undefined) formData.append('planExpert', String(planPriceObj.Expert));
      if (planPriceObj?.Premium !== undefined) formData.append('planPremium', String(planPriceObj.Premium));

      // Admin commission percent (single commission for the strategy)
      if (commissionPercent.trim().length > 0) {
        formData.append('commissionPercent', commissionPercent.trim());
      }
      formData.append('currency', strategyCurrency);

      // Master Account Details
      if (currentStrategy.masterAccountId) formData.append('masterAccountId', currentStrategy.masterAccountId);
      if (currentStrategy.masterAccountPassword) formData.append('masterAccountPassword', currentStrategy.masterAccountPassword);
      if (currentStrategy.masterAccountServer) formData.append('masterAccountServer', currentStrategy.masterAccountServer);
      if (currentStrategy.masterPlatform) formData.append('masterPlatform', currentStrategy.masterPlatform);

      // Plan percentages (if set from planPercents)
      if (planPercents.Pro !== undefined) formData.append('planProPercent', String(planPercents.Pro));
      if (planPercents.Expert !== undefined) formData.append('planExpertPercent', String(planPercents.Expert));
      if (planPercents.Premium !== undefined) formData.append('planPremiumPercent', String(planPercents.Premium));

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
    <div className="space-y-8 p-4 md:p-0">
      {/* Header and Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Strategy Management</h2>
          <p className="text-sm font-medium text-gray-500 mt-1">Add, edit, and optimize your trading strategies</p>
        </div>
        <Button 
          onClick={handleAddClick} 
          className="w-full sm:w-auto bg-[#00d09c] hover:bg-[#00b085] text-white h-11 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] shadow-sm active:scale-95 transition-all"
        >
          <FiPlus className="mr-2 h-4 w-4" /> Add New Strategy
        </Button>
      </div>

      {/* Success/Error Messages */}
      <div className="space-y-4">
        {success && (
          <Alert className="bg-green-50 text-green-800 border-green-100 rounded-2xl p-4 shadow-sm animate-in slide-in-from-top duration-300">
            <FiCheck className="h-5 w-5 mr-3 text-green-500" /> 
            <div>
              <AlertTitle className="font-black text-sm">Success</AlertTitle>
              <AlertDescription className="text-xs font-medium opacity-80">{success}</AlertDescription>
            </div>
          </Alert>
        )}
        {error && (
          <Alert className="bg-red-50 text-red-800 border-red-100 rounded-2xl p-4 shadow-sm animate-in slide-in-from-top duration-300">
            <FiAlertCircle className="h-5 w-5 mr-3 text-red-500" /> 
            <div>
              <AlertTitle className="font-black text-sm">Error</AlertTitle>
              <AlertDescription className="text-xs font-medium opacity-80">{error}</AlertDescription>
            </div>
          </Alert>
        )}
      </div>

      {/* Strategies List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          // Loading state
          Array(4).fill(0).map((_, index) => (
            <Card key={index} className="overflow-hidden bg-white border border-gray-200 rounded-2xl">
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
          <Card className="col-span-full p-8 text-center bg-white border border-gray-200 rounded-2xl">
            <FiAlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <CardTitle>No strategies found</CardTitle>
            <CardDescription>Click the &apos;Add Strategy&apos; button to create your first strategy</CardDescription>
            <CardFooter className="justify-center mt-4">
              <Button onClick={handleAddClick} className="bg-[#00d09c] hover:bg-[#00b085] text-white rounded-xl">
                <FiPlus className="mr-2 h-4 w-4" /> Add Strategy
              </Button>
            </CardFooter>
          </Card>
        ) : (
          // Strategies list
          strategies.map((strategy) => (
            <Card key={strategy.id} className="overflow-hidden transition-all duration-300 hover:shadow-md bg-white border border-gray-200 rounded-2xl">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {strategy.imageUrl && (
                      <div className="w-12 h-12 rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden">
                        <img src={strategy.imageUrl} alt={strategy.name} className="w-8 h-8 object-contain" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-xl font-bold text-gray-900">{strategy.name}</CardTitle>
                      <Badge variant="outline" className={strategy.enabled !== false ? 'bg-green-100 text-green-800 border-green-200' : 'bg-gray-100 text-gray-800 border-gray-200'}>
                        {strategy.enabled !== false ? 'Enabled' : 'Disabled'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            className="h-10 w-10 rounded-xl border-gray-200 text-gray-500 hover:text-[#00d09c] hover:bg-green-50 hover:border-[#00d09c] transition-all"
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
                            className="h-10 w-10 rounded-xl border-gray-200 text-red-600 hover:text-white hover:bg-red-500 hover:border-red-500 transition-all"
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
                <CardDescription className="text-gray-500 mt-2">{strategy.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">ROI</span>
                    <span className="text-gray-900 font-bold">{strategy.roi ?? '-'}%</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Profit</span>
                    <span className="text-gray-900 font-bold">+{strategy.profit ?? '-'}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Max DDI</span>
                    <span className="text-gray-900 font-bold">{strategy.maxDdi ?? '-'}%</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Copiers</span>
                    <span className="text-gray-900 font-bold">{strategy.copiers ?? '-'}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Tag</span>
                    <Badge variant="outline" className="bg-white">{strategy.tag || '-'}</Badge>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Master</span>
                    <Badge variant="outline" className="bg-white">{strategy.mastersTag || '-'}</Badge>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Drawdown</span>
                    <span className="text-gray-900 font-bold">{strategy.avgDrawdown !== undefined ? `${strategy.avgDrawdown}%` : '-'}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Min Capital</span>
                    <span className="text-gray-900 font-bold">{strategy.minCapital !== undefined ? `$${strategy.minCapital}` : '-'}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Risk Reward</span>
                    <span className="text-gray-900 font-bold">{strategy.riskReward !== undefined ? strategy.riskReward : '-'}</span>
                  </div>
                  <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="block text-[10px] uppercase font-black text-gray-400 mb-1">Win Streak</span>
                    <span className="text-gray-900 font-bold">{strategy.winStreak !== undefined ? strategy.winStreak : '-'}</span>
                  </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-sm">
                  <div className="flex flex-wrap items-center gap-y-2">
                    <div className="flex items-center">
                      <span className="font-bold text-blue-900">ID:</span>
                      <span className="ml-1 text-blue-800">{(strategy.masterAccountId && strategy.masterAccountId.trim().length > 0) ? strategy.masterAccountId : '-'}</span>
                    </div>
                    <span className="mx-2 text-blue-300 hidden sm:inline">•</span>
                    <div className="flex items-center">
                      <span className="font-bold text-blue-900">Server:</span>
                      <span className="ml-1 text-blue-800">{(strategy.masterAccountServer && strategy.masterAccountServer.trim().length > 0) ? strategy.masterAccountServer : '-'}</span>
                    </div>
                    <span className="mx-2 text-blue-300 hidden sm:inline">•</span>
                    <div className="flex items-center">
                      <span className="font-bold text-blue-900">Platform:</span>
                      <span className="ml-1 text-blue-800">{(strategy.masterPlatform || '').toUpperCase() || '-'}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100 text-sm mt-3">
                  <div className="font-black text-gray-500 uppercase tracking-wider text-[10px]">Plan Pricing</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    <span className="font-bold">Pro:</span> ${strategy.planPrices?.Pro ?? '-'}
                    <span className="font-bold">Expert:</span> ${strategy.planPrices?.Expert ?? '-'}
                    <span className="font-bold">Premium:</span> ${strategy.planPrices?.Premium ?? '-'}
                  </div>
                </div>
                
                {/* Parameters section */}
                <div className="mt-2">
                  <button
                    className="flex items-center text-sm font-black text-[#00d09c] hover:opacity-80 transition-all uppercase tracking-wider"
                    onClick={() => toggleParameterExpansion(strategy.id)}
                  >
                    {expandedParameters[strategy.id] ? (
                      <FiChevronUp className="mr-1 h-4 w-4" />
                    ) : (
                      <FiChevronDown className="mr-1 h-4 w-4" />
                    )}
                    View Detailed Parameters
                  </button>
                  
                  {expandedParameters[strategy.id] && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-2 duration-200">
                      {Object.entries(strategy.parameters).map(([key, value]) => (
                        <div key={key} className="p-2.5 bg-gray-50 rounded-lg border border-gray-100 text-xs">
                          <span className="font-black text-gray-500 uppercase block mb-0.5">{key}</span>
                          <span className="text-gray-900 font-bold">{String(value)}</span>
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
        <DialogContent className="max-w-4xl w-[95vw] max-h-[95vh] bg-white border border-gray-200 text-gray-900 p-0 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
          <DialogHeader className="p-6 border-b border-gray-100 bg-gray-50/50">
            <DialogTitle className="text-2xl font-black text-gray-900 uppercase tracking-tight">
              {isAdding ? 'Create Strategy' : 'Update Strategy'}
            </DialogTitle>
            <DialogDescription className="text-gray-500 font-medium">
              {isAdding ? 'Set up a new copy trading strategy for your users.' : 'Modify the configuration of your existing strategy.'}
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 px-6 py-6 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 170px)' }}>
              <div className="p-2 mb-4 rounded-lg bg-yellow-50 border border-yellow-100 text-sm font-bold text-yellow-700">
                Scroll down to complete “Master Account Connection” and “Lot Size Pricing” fields.
              </div>
            <form id="strategy-form" onSubmit={handleSubmit} className="space-y-8 pb-6">
              {/* Content Selection Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="contentType" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Content Type</Label>
                  <Select
                    value={contentType}
                    onValueChange={(value) => handleContentTypeChange(value as 'html' | 'pdf' | 'text')}
                  >
                    <SelectTrigger className="bg-white border border-gray-200 text-gray-900 h-11 rounded-xl focus:ring-2 focus:ring-[#00d09c]/20 focus:border-[#00d09c] transition-all">
                      <SelectValue placeholder="Select content type" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-100 rounded-xl shadow-xl">
                      <SelectItem value="html" className="focus:bg-green-50 focus:text-[#00d09c] cursor-pointer">HTML Document</SelectItem>
                      <SelectItem value="pdf" className="focus:bg-green-50 focus:text-[#00d09c] cursor-pointer">PDF Document</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="file" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Upload Document</Label>
                  <div className="relative">
                    <Input
                      id="file"
                      type="file"
                      accept={contentType === 'html' ? '.html,.htm' : '.pdf'}
                      onChange={handleFileChange}
                      className="cursor-pointer bg-white border-gray-200 text-gray-900 h-11 rounded-xl file:mr-4 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-gray-100 file:text-gray-600 hover:file:bg-gray-200 transition-all"
                    />
                  </div>
                </div>
              </div>

              {/* Basic Info Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-8 bg-[#00d09c] rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Strategy Name *</Label>
                    <Input
                      id="name"
                      name="name"
                      value={currentStrategy.name || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. Alpha Scalper"
                      required
                      className="bg-white border border-gray-200 text-gray-900 h-11 rounded-xl focus:ring-2 focus:ring-[#00d09c]/20 focus:border-[#00d09c] transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Short Description *</Label>
                    <Input
                      id="description"
                      name="description"
                      value={currentStrategy.description || ''}
                      onChange={handleInputChange}
                      placeholder="e.g. High-frequency scalping strategy"
                      required
                      className="bg-white border border-gray-200 text-gray-900 h-11 rounded-xl focus:ring-2 focus:ring-[#00d09c]/20 focus:border-[#00d09c] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="details" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Detailed Description *</Label>
                  <Textarea
                    id="details"
                    name="details"
                    value={currentStrategy.details || ''}
                    onChange={handleInputChange}
                    placeholder="Provide a comprehensive explanation of the strategy logic..."
                    rows={4}
                    required
                    className="bg-white border border-gray-200 text-gray-900 rounded-2xl focus:ring-2 focus:ring-[#00d09c]/20 focus:border-[#00d09c] transition-all resize-none"
                  />
                </div>
              </div>

              {/* Visuals & Status Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-gray-50 p-6 rounded-2xl border border-gray-100">
                <div className="space-y-2">
                  <Label htmlFor="icon" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Strategy Icon</Label>
                  <Input
                    id="icon"
                    type="file"
                    accept="image/*"
                    onChange={handleIconChange}
                    className="cursor-pointer bg-white border-gray-200 text-gray-900 h-11 rounded-xl file:mr-3 file:py-1 file:px-2 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-gray-100 file:text-gray-600 transition-all"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Country Origin</Label>
                  <Select value={countryFlag} onValueChange={setCountryFlag}>
                    <SelectTrigger className="bg-white border border-gray-200 text-gray-900 h-11 rounded-xl focus:ring-2 focus:ring-[#00d09c]/20 focus:border-[#00d09c]">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-gray-100 rounded-xl max-h-60">
                      <SelectItem value="US">🇺🇸 USA</SelectItem>
                      <SelectItem value="GB">🇬🇧 UK</SelectItem>
                      <SelectItem value="DE">🇩🇪 Germany</SelectItem>
                      <SelectItem value="FR">🇫🇷 France</SelectItem>
                      <SelectItem value="JP">🇯🇵 Japan</SelectItem>
                      <SelectItem value="IN">🇮🇳 India</SelectItem>
                      <SelectItem value="AE">🇦🇪 UAE</SelectItem>
                      <SelectItem value="SG">🇸🇬 Singapore</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="enabled" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Status</Label>
                  <div className="flex items-center h-11 bg-white border border-gray-200 rounded-xl px-4 justify-between">
                    <span className="text-sm font-bold text-gray-700">{currentStrategy.enabled !== false ? 'Active' : 'Paused'}</span>
                    <Switch 
                      id="enabled" 
                      checked={currentStrategy.enabled !== false}
                      onCheckedChange={handleEnabledChange}
                      className="data-[state=checked]:bg-[#00d09c]"
                    />
                  </div>
                </div>
              </div>

              {/* Performance Metrics Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-8 bg-[#00d09c] rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">Performance Metrics</h3>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="roi" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">ROI (%)</Label>
                    <Input id="roi" name="roi" type="number" step="0.01" value={String(currentStrategy.roi ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="riskScore" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Risk Score</Label>
                    <Input id="riskScore" name="riskScore" type="number" step="0.01" value={String(currentStrategy.riskScore ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="profit" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Total Profit</Label>
                    <Input id="profit" name="profit" type="number" step="0.01" value={String(currentStrategy.profit ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maxDdi" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Max DDI (%)</Label>
                    <Input id="maxDdi" name="maxDdi" type="number" step="0.01" value={String(currentStrategy.maxDdi ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="minCapital" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Min Capital</Label>
                    <Input id="minCapital" name="minCapital" type="number" step="0.01" value={String(currentStrategy.minCapital ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="avgDrawdown" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Avg Drawdown (%)</Label>
                    <Input id="avgDrawdown" name="avgDrawdown" type="number" step="0.01" value={String(currentStrategy.avgDrawdown ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="riskReward" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Risk Reward</Label>
                    <Input id="riskReward" name="riskReward" type="number" step="0.01" value={String(currentStrategy.riskReward ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="winStreak" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Win Streak</Label>
                    <Input id="winStreak" name="winStreak" type="number" step="1" value={String(currentStrategy.winStreak ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planPro" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Pro Price</Label>
                    <Input id="planPro" name="planPro" type="number" step="0.01" value={String(currentStrategy.planPrices?.Pro ?? '')} onChange={(e) => handlePlanPriceChange('Pro', e.target.value)} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planExpert" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Expert Price</Label>
                    <Input id="planExpert" name="planExpert" type="number" step="0.01" value={String(currentStrategy.planPrices?.Expert ?? '')} onChange={(e) => handlePlanPriceChange('Expert', e.target.value)} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="planPremium" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Premium Price</Label>
                    <Input id="planPremium" name="planPremium" type="number" step="0.01" value={String(currentStrategy.planPrices?.Premium ?? '')} onChange={(e) => handlePlanPriceChange('Premium', e.target.value)} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="commissionPercent" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Commission (%)</Label>
                    <Input id="commissionPercent" name="commissionPercent" type="number" step="0.01" value={commissionPercent} onChange={(e) => setCommissionPercent(e.target.value)} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Currency</Label>
                    <Select value={strategyCurrency} onValueChange={(value) => setStrategyCurrency((value as any) === 'USC' ? 'USC' : 'USD')}>
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold">
                        <SelectValue placeholder="Currency" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-100 rounded-xl shadow-lg">
                        <SelectItem value="USD" className="font-bold">USD</SelectItem>
                        <SelectItem value="USC" className="font-bold">USC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="copiers" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Copiers</Label>
                    <Input id="copiers" name="copiers" type="number" value={String(currentStrategy.copiers ?? '')} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tag" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Tag</Label>
                    <Input id="tag" name="tag" value={currentStrategy.tag || ''} onChange={handleInputChange} className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="riskLevel" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Risk Level</Label>
                    <Select
                      value={currentStrategy.riskLevel || ''}
                      onValueChange={(value) => setCurrentStrategy(prev => ({ ...prev, riskLevel: value as 'Low' | 'Medium' | 'High' }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold">
                        <SelectValue placeholder="Level" />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-100 rounded-xl shadow-lg">
                        <SelectItem value="Low" className="font-bold text-green-600">Low</SelectItem>
                        <SelectItem value="Medium" className="font-bold text-yellow-600">Medium</SelectItem>
                        <SelectItem value="High" className="font-bold text-red-600">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Master Connection Section */}
              <div className="space-y-4 bg-[#00d09c]/5 p-6 rounded-2xl border border-[#00d09c]/10">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-8 bg-[#00d09c] rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-[#00b085]">Master Account Connection</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="masterAccountId" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Account ID</Label>
                    <Input 
                      id="masterAccountId" 
                      name="masterAccountId" 
                      value={currentStrategy.masterAccountId || ''} 
                      onChange={handleInputChange} 
                      className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="masterAccountPassword" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Password</Label>
                    <Input 
                      id="masterAccountPassword" 
                      name="masterAccountPassword" 
                      type="password"
                      autoComplete="new-password"
                      placeholder={currentStrategy.hasMasterPassword ? "•••••••• (Saved)" : "MT Password"}
                      value={currentStrategy.masterAccountPassword || ''} 
                      onChange={(e) => setCurrentStrategy(prev => ({ ...prev, masterAccountPassword: e.target.value }))}
                      className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="masterAccountServer" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Server</Label>
                    <Input 
                      id="masterAccountServer" 
                      name="masterAccountServer" 
                      value={currentStrategy.masterAccountServer || ''} 
                      onChange={handleInputChange} 
                      className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="masterPlatform" className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Platform</Label>
                    <Select
                      value={currentStrategy.masterPlatform || 'mt5'}
                      onValueChange={(value) => setCurrentStrategy(prev => ({ ...prev, masterPlatform: value as 'mt4' | 'mt5' }))}
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white border border-gray-200 text-gray-900 font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border border-gray-100 rounded-xl shadow-lg">
                        <SelectItem value="mt4" className="font-bold">MetaTrader 4</SelectItem>
                        <SelectItem value="mt5" className="font-bold">MetaTrader 5</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-8 bg-[#00d09c] rounded-full" />
                  <h3 className="text-sm font-black uppercase tracking-wider text-gray-900">Lot Size Pricing</h3>
                </div>
                
                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-6">
                  <div className="max-w-md space-y-2">
                    <Label className="text-[10px] uppercase font-black text-gray-500 tracking-widest">Price for 1 Lot ({strategyCurrency}) *</Label>
                    <Input
                      type="number"
                      value={(lotRows[0] && lotRows[0].amountUSD) || ''}
                      onChange={(e) => setLotRows([{ amountUSD: e.target.value, lot: '1', id: 'lot-1' }])}
                      placeholder="e.g. 25.00"
                      className="h-12 text-lg font-black text-[#00d09c] rounded-xl bg-white border border-gray-200 focus:ring-[#00d09c]/20"
                      required
                    />
                    <p className="text-[10px] text-gray-400 font-bold italic">
                      System automatically calculates x1, x2, and x3 multipliers based on this base price.
                    </p>
                  </div>
                  
                  {((derivedPlanPrices?.Pro !== undefined && derivedPlanPrices?.Expert !== undefined && derivedPlanPrices?.Premium !== undefined) || hasBaseLotPrice) && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-gray-200">
                      <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
                        <span className="block text-[10px] font-black text-gray-400 uppercase mb-1">Pro</span>
                        <span className="text-xl font-black text-gray-900">{currencyPrefix}{Number(derivedPlanPrices?.Pro || 0).toFixed(2)}</span>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
                        <span className="block text-[10px] font-black text-gray-400 uppercase mb-1">Expert</span>
                        <span className="text-xl font-black text-gray-900">{currencyPrefix}{Number(derivedPlanPrices?.Expert || 0).toFixed(2)}</span>
                      </div>
                      <div className="p-4 bg-white rounded-2xl border border-gray-100 shadow-sm text-center">
                        <span className="block text-[10px] font-black text-gray-400 uppercase mb-1">Premium</span>
                        <span className="text-xl font-black text-gray-900">{currencyPrefix}{Number(derivedPlanPrices?.Premium || 0).toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </form>
          </ScrollArea>
          
          <DialogFooter className="p-6 border-t border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => { setIsAdding(false); setIsEditing(false); }}
              className="w-full sm:w-auto h-11 px-8 rounded-xl font-black uppercase tracking-widest text-[10px] border-gray-200 text-gray-500 hover:bg-white transition-all"
            >
              Cancel
            </Button>
            <Button
              form="strategy-form"
              type="submit"
              className="w-full sm:w-auto h-11 px-12 rounded-xl font-black uppercase tracking-widest text-[10px] bg-[#00d09c] hover:bg-[#00b085] text-white shadow-lg shadow-[#00d09c]/20 active:scale-95 transition-all"
            >
              {isAdding ? 'Create Strategy' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StrategyManagement;
