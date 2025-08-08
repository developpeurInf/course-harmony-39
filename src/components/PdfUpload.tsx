import { useState } from "react";
import { Upload, X, File, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface PdfUploadProps {
  onFileSelect: (file: File | null) => void;
  selectedFile: File | null;
  existingPdfUrl?: string;
  onViewPdf?: () => void;
  onDownloadPdf?: () => void;
  accept?: string;
  maxSizeMB?: number;
  className?: string;
}

const PdfUpload = ({ 
  onFileSelect, 
  selectedFile, 
  existingPdfUrl,
  onViewPdf,
  onDownloadPdf,
  accept = ".pdf",
  maxSizeMB = 10,
  className = ""
}: PdfUploadProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const validateAndSetFile = (file: File) => {
    // Check file type
    if (!file.type.includes('pdf')) {
      toast.error("Please select a PDF file");
      return;
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSizeMB) {
      toast.error(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    onFileSelect(file);
    toast.success("PDF file selected successfully");
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      validateAndSetFile(files[0]);
    }
  };

  const removeFile = () => {
    onFileSelect(null);
    toast.info("PDF file removed");
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Show existing PDF if no new file is selected
  if (!selectedFile && existingPdfUrl) {
    return (
      <div className={`border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center space-y-4 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="bg-primary/10 p-3 rounded-full">
            <File className="h-8 w-8 text-primary" />
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-foreground">PDF Attached</h3>
          <p className="text-xs text-muted-foreground mt-1">
            A PDF file is currently attached to this item
          </p>
        </div>

        <div className="flex gap-2 justify-center">
          {onViewPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onViewPdf}
              className="text-xs"
            >
              <Eye className="h-3 w-3 mr-1" />
              View
            </Button>
          )}
          {onDownloadPdf && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onDownloadPdf}
              className="text-xs"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </Button>
          )}
          <label htmlFor="pdf-upload">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs"
              asChild
            >
              <span>
                <Upload className="h-3 w-3 mr-1" />
                Replace
              </span>
            </Button>
          </label>
        </div>

        <input
          id="pdf-upload"
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  // Show selected file
  if (selectedFile) {
    return (
      <div className={`border-2 border-dashed border-primary/50 rounded-lg p-6 bg-primary/5 ${className}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded">
              <File className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={removeFile}
            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Show upload area
  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        isDragging
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      } ${className}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <div className="bg-muted p-3 rounded-full">
            <Upload className="h-8 w-8 text-muted-foreground" />
          </div>
        </div>
        
        <div>
          <h3 className="text-sm font-medium text-foreground">Upload PDF</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Drag and drop your PDF here, or click to browse
          </p>
          <p className="text-xs text-muted-foreground">
            Maximum file size: {maxSizeMB}MB
          </p>
        </div>

        <label htmlFor="pdf-upload">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs"
            asChild
          >
            <span>
              <Upload className="h-3 w-3 mr-1" />
              Choose File
            </span>
          </Button>
        </label>

        <input
          id="pdf-upload"
          type="file"
          accept={accept}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default PdfUpload;