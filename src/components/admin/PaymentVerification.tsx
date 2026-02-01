'use client';

import { useState, useEffect } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Badge from '@/components/ui/Badge';
import { Label } from '@/components/ui/label';
import Input from '@/components/ui/Input';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';
import { Check, X, RefreshCw, Eye, Mail, Loader2, FileText } from 'lucide-react';

interface Transaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: 'deposit' | 'charge';
  payment_method?: string;
  transaction_id?: string;
  receipt_path?: string;
  platform?: 'MT4' | 'MT5';
  mt_account_id?: string;
  mt_account_password?: string;
  terms_accepted?: boolean;
  status: 'pending' | 'in-process' | 'completed' | 'failed';
  created_at: string;
  updated_at?: string;
  admin_id?: string;
  rejection_reason?: string;
  user?: {
    name: string;
    email: string;
  };
}

interface PaymentVerificationProps {
  onSendEmail?: () => void;
}

export default function PaymentVerification({ onSendEmail }: PaymentVerificationProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [processingAction, setProcessingAction] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  useEffect(() => {
    fetchPendingTransactions();
  }, []);

  const fetchPendingTransactions = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Get all transactions from MySQL database (not just pending)
      const response = await fetch('/api/admin/payments/pending');
      
      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch transactions');
      }
      
      // Sort by date (newest first)
      data.transactions.sort((a: Transaction, b: Transaction) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      setTransactions(data.transactions);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      console.error('Error fetching transactions:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTransactionAction = async () => {
    if (!selectedTransaction || !actionType) return;

    setProcessingAction(true);
    setError(null);

    try {
      let response: Response;
      if (actionType === 'approve') {
        // Use dedicated approve endpoint which credits tokens equal to amount
        response = await fetch(`/api/admin/payments/${selectedTransaction.id}/approve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });
      } else {
        // Reject with a required reason
        if (!rejectionReason || rejectionReason.trim().length === 0) {
          throw new Error('Please provide a rejection reason');
        }
        response = await fetch(`/api/admin/payments/${selectedTransaction.id}/reject`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rejectionReason }),
        });
      }

      if (!response.ok) {
        throw new Error('Failed to update transaction');
      }

      const result = await response.json();
      
      // Refresh the transactions list
      await fetchPendingTransactions();
      
      // Close dialog
      setActionDialogOpen(false);
      setRejectionReason('');
      
      toast({ 
        variant: 'default', 
        title: 'Success', 
        description: actionType === 'approve' 
          ? `Transaction approved and tokens credited to user account` 
          : 'Transaction rejected successfully'
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      toast({ variant: 'destructive', title: 'Error', description: errorMessage });
      console.error(`Error ${actionType}ing transaction:`, err);
    } finally {
      setProcessingAction(false);
    }
  };

  const handleSendLowBalanceEmail = async (userId: string, userEmail: string) => {
    try {
      // In a real implementation, this would call an API to send emails
      console.log(`Simulating sending low balance email to ${userEmail}`);
      
      // For now, just show a success message
      toast({ 
        variant: 'default', 
        title: 'Success', 
        description: 'Email reminder sent successfully' 
      });
      
      // Call the parent callback if provided
      if (onSendEmail) {
        onSendEmail();
      }
    } catch (err) {
      toast({ 
        variant: 'destructive', 
        title: 'Error', 
        description: 'Failed to send email reminder' 
      });
      console.error('Error sending email:', err);
    }
  };

  const handleViewReceipt = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setReceiptDialogOpen(true);
  };

  const handleViewDetails = (transaction: Transaction) => {
    setSelectedTransaction(transaction);
    setDetailsDialogOpen(true);
  };

  const handleActionDialogOpen = (transaction: Transaction, action: 'approve' | 'reject') => {
    setSelectedTransaction(transaction);
    setActionType(action);
    setRejectionReason('');
    setActionDialogOpen(true);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!session || session.user?.role !== 'ADMIN') {
    router.push('/admin-login');
    return null;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Payment Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Review and verify pending payment requests from users.
          </p>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardContent>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-semibold">Pending Transactions</h3>
            <Button 
              variant="default" 
              size="sm"
              onClick={fetchPendingTransactions}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
              <p>No pending transactions to verify.</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Transaction ID</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead className="text-right">Amount ($)</TableHead>
                    <TableHead>Payment Method</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Terms</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted At</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell className="font-mono text-sm">
                        {transaction.transaction_id}
                      </TableCell>
                      <TableCell>{transaction.user?.name || 'Unknown'}</TableCell>
                      <TableCell>{transaction.user?.email || 'Unknown'}</TableCell>
                      <TableCell className="text-right">${transaction.amount.toFixed(2)}</TableCell>
                      <TableCell>{transaction.payment_method}</TableCell>
                      <TableCell>{transaction.platform || '-'}</TableCell>
                      <TableCell>
                        {transaction.terms_accepted ? (
                          <Badge>Accepted</Badge>
                        ) : (
                          <Badge variant="secondary">No</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {transaction.status === 'pending' ? (
                          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>
                        ) : transaction.status === 'in-process' ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">In Process</Badge>
                        ) : transaction.status === 'completed' ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Failed</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDate(transaction.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex space-x-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8"
                                  onClick={() => handleViewReceipt(transaction)}
                                  disabled={!transaction.receipt_path}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Receipt</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8"
                                  onClick={() => handleViewDetails(transaction)}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>View Details</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                  onClick={() => handleActionDialogOpen(transaction, 'approve')}
                                  disabled={transaction.status !== 'pending'}
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Approve Payment</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleActionDialogOpen(transaction, 'reject')}
                                  disabled={transaction.status !== 'pending'}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Reject Payment</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Receipt Dialog */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogHeader>
          <DialogTitle>Payment Receipt</DialogTitle>
        </DialogHeader>
        <DialogContent className="max-h-[70vh] overflow-auto">
          {selectedTransaction?.receipt_path ? (
            <div className="flex flex-col items-center p-4">
              <img
                src={selectedTransaction.receipt_path}
                alt="Payment Receipt"
                className="max-w-full max-h-[50vh] object-contain"
              />
              <div className="mt-4 space-y-2 w-full">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Transaction ID:</span>
                  <span className="font-mono text-sm">{selectedTransaction.transaction_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">${selectedTransaction.amount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span>{selectedTransaction.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Submitted By:</span>
                  <span>{selectedTransaction.user?.name}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              No receipt available for this transaction.
            </p>
          )}
        </DialogContent>
        <DialogFooter>
          <Button onClick={() => setReceiptDialogOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Removed Token Allocation Dialog: tokens are auto-credited on approval */}

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Payment' : 'Reject Payment'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve'
                ? `Approve this payment and credit tokens equal to the payment amount`
                : 'Provide a reason and confirm rejection of this payment.'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Amount</Label>
                <div className="col-span-3">
                  <span className="font-medium">${selectedTransaction.amount.toFixed(2)}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">User</Label>
                <div className="col-span-3">
                  <span className="font-medium">{selectedTransaction.user?.name}</span>
                  <span className="block text-sm text-gray-500">{selectedTransaction.user?.email}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Date</Label>
                <div className="col-span-3">
                  <span className="font-medium">
                    {formatDate(selectedTransaction.created_at)}
                  </span>
                </div>
              </div>
              {actionType === 'reject' && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="rejectionReason" className="text-right">Reason</Label>
                  <Input
                    id="rejectionReason"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter rejection reason"
                    className="col-span-3"
                  />
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialogOpen(false)} disabled={processingAction}>
              Cancel
            </Button>
            <Button 
              onClick={handleTransactionAction} 
              variant={actionType === 'approve' ? 'default' : 'primary'}
              disabled={processingAction || (actionType === 'reject' && (!rejectionReason || rejectionReason.trim().length === 0))}
            >
              {processingAction ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                actionType === 'approve' ? 'Approve' : 'Reject'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Transaction Details</DialogTitle>
            <DialogDescription>
              MT4/MT5 account information and terms acceptance.
            </DialogDescription>
          </DialogHeader>
          {selectedTransaction && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Platform</Label>
                <div className="col-span-3">
                  <span className="font-medium">{selectedTransaction.platform || '-'}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">MT Account ID</Label>
                <div className="col-span-3">
                  <span className="font-mono text-sm">{selectedTransaction.mt_account_id || '-'}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">MT Account Password</Label>
                <div className="col-span-3">
                  <span className="font-mono text-sm">{selectedTransaction.mt_account_password || '-'}</span>
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Terms Accepted</Label>
                <div className="col-span-3">
                  {selectedTransaction.terms_accepted ? (
                    <Badge>Accepted</Badge>
                  ) : (
                    <Badge variant="secondary">No</Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}