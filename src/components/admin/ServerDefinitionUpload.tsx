
'use client';

import { useState, useRef } from 'react';
import Button from '@/components/ui/Button';
import Card, { CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { Upload, File, Check, X, AlertTriangle, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function ServerDefinitionUpload() {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith('.srv')) {
        setError('Please select a valid .srv file');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setSuccess(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/admin/server-definitions/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setSuccess(`Successfully uploaded ${file.name}`);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
      toast({
        title: "Success",
        description: `Server definition ${file.name} uploaded successfully.`,
        variant: "default",
      });

    } catch (err: any) {
      setError(err.message || 'An error occurred during upload');
      toast({
        title: "Upload Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Card className="bg-white border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-primary" />
          Upload Server Definition (.srv / .dat)
        </CardTitle>
        <CardDescription>
          Upload broker server configuration files to fix "Unknown Server" errors.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert className="bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-700 text-sm">
            These files allow the system to connect to new brokers. You can find them in your local MT5 installation folder under <strong>Config</strong>.
            <br/>
            <strong>Note:</strong> Newer MT5 versions use <code>servers.dat</code> instead of individual <code>.srv</code> files. Both are supported.
          </AlertDescription>
        </Alert>

        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="srv-file">Server File</Label>
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              id="srv-file"
              type="file"
              accept=".srv"
              onChange={handleFileChange}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          {file && (
            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
              <File className="h-3 w-3" /> {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </p>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="bg-green-50 border-green-200 text-green-800">
            <Check className="h-4 w-4 text-green-600" />
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex justify-end">
          <Button 
            onClick={handleUpload} 
            disabled={!file || uploading}
            className="w-full sm:w-auto"
          >
            {uploading ? (
              <>Uploading...</>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" /> Upload Definition
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
