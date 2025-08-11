import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, X, Plus, Eye, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';

interface ExistingFile {
  id: string;
  file_name: string;
  file_path: string;
  file_size?: number;
  uploaded_at: string;
}

interface MultiPdfUploadProps {
  onFilesChange: (files: File[]) => void;
  selectedFiles: File[];
  maxFiles?: number;
  maxSizeMB?: number;
  existingFiles?: ExistingFile[];
  onRemoveExisting?: (fileId: string) => void;
}

const MultiPdfUpload = ({ 
  onFilesChange, 
  selectedFiles,
  maxFiles = 5,
  maxSizeMB = 50,
  existingFiles = [],
  onRemoveExisting
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
      if (selectedFiles.length + existingFiles.length + filesToAdd.length >= maxFiles) {
        toast.error(`Maximum ${maxFiles} files allowed`);
        break;
      }

      filesToAdd.push(file);
    }

    if (filesToAdd.length > 0) {
      onFilesChange([...selectedFiles, ...filesToAdd]);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return '';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
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

  const handleViewExisting = (file: ExistingFile) => {
    window.open(`/storage/course-materials/${file.file_path}`, '_blank');
  };

  const handleDownloadExisting = (file: ExistingFile) => {
    const link = document.createElement('a');
    link.href = `/storage/course-materials/${file.file_path}`;
    link.download = file.file_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* Existing Files */}
      {existingFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-muted-foreground">Existing Files</h4>
          <div className="space-y-2">
            {existingFiles.map((file) => (
              <Card key={file.id} className="p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{file.file_name}</p>
                      <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                        {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                        <span>•</span>
                        <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleViewExisting(file)}
                      className="h-7 w-7 p-0"
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownloadExisting(file)}
                      className="h-7 w-7 p-0"
                    >
                      <Download className="h-3 w-3" />
                    </Button>
                    {onRemoveExisting && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveExisting(file.id)}
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

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
          Maximum {maxFiles} files, up to {maxSizeMB}MB each ({selectedFiles.length + existingFiles.length}/{maxFiles})
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
              disabled={selectedFiles.length + existingFiles.length >= maxFiles}
            />
          </label>
        </Button>
      </div>

      {/* Selected files */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            New files to upload ({selectedFiles.length}):
          </p>
          <div className="space-y-2">
            {selectedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
              >
                <div className="flex items-center min-w-0 flex-1">
                  <FileText className="h-4 w-4 text-primary mr-2 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2 ml-2">
                  <Badge variant="secondary" className="text-xs">
                    New
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFile(index)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default MultiPdfUpload;
