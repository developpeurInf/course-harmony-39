import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, File, X, Plus } from 'lucide-react';
import { toast } from 'sonner';

interface MultiPdfUploadProps {
  onFilesChange: (files: File[]) => void;
  selectedFiles: File[];
  maxFiles?: number;
  maxSizeMB?: number;
}

const MultiPdfUpload = ({ 
  onFilesChange, 
  selectedFiles,
  maxFiles = 5,
  maxSizeMB = 50 
}: MultiPdfUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false);

  const validateAndAddFiles = (newFiles: FileList | File[]) => {
    const filesToAdd: File[] = [];
    const fileArray = Array.from(newFiles);

    for (const file of fileArray) {
      // Check file type
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} is not a PDF file`);
        continue;
      }

      // Check file size (convert MB to bytes)
      if (file.size > maxSizeMB * 1024 * 1024) {
        toast.error(`${file.name} is larger than ${maxSizeMB}MB`);
        continue;
      }

      // Check if file already exists
      if (selectedFiles.some(existingFile => existingFile.name === file.name)) {
        toast.error(`${file.name} is already selected`);
        continue;
      }

      // Check total file limit
      if (selectedFiles.length + filesToAdd.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        break;
      }

      filesToAdd.push(file);
    }

    if (filesToAdd.length > 0) {
      onFilesChange([...selectedFiles, ...filesToAdd]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    validateAndAddFiles(e.dataTransfer.files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      validateAndAddFiles(e.target.files);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    onFilesChange(newFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-3">
      {/* Upload area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
          isDragOver 
            ? 'border-primary bg-primary/5' 
            : 'border-muted-foreground/25 hover:border-muted-foreground/40'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground mb-2">
          Drag and drop PDF files here, or click to select
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Maximum {maxFiles} files, up to {maxSizeMB}MB each
        </p>
        <Button variant="outline" size="sm" asChild>
          <label className="cursor-pointer">
            <Plus className="h-4 w-4 mr-2" />
            Select PDF Files
            <input
              type="file"
              multiple
              accept=".pdf"
              onChange={handleFileSelect}
              className="hidden"
              disabled={selectedFiles.length >= maxFiles}
            />
          </label>
        </Button>
      </div>

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Selected files ({selectedFiles.length}/{maxFiles}):
          </p>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <File className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFile(index)}
                  className="ml-2 h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiPdfUpload;