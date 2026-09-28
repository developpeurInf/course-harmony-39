import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough,
  List, 
  ListOrdered, 
  Quote, 
  Heading1, 
  Heading2, 
  Image as ImageIcon, 
  Link as LinkIcon,
  Undo,
  Redo,
  Upload,
  Eraser,
  Code
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

const RichTextEditor = ({ 
  content, 
  onChange, 
  placeholder = "Saisissez votre contenu...", 
  className = "",
  minHeight = "min-h-[120px]"
}: RichTextEditorProps) => {
  const { language } = useLanguage();
  const [imageUrl, setImageUrl] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkText, setLinkText] = useState("");
  const [showImageDialog, setShowImageDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: {
          keepMarks: true,
          keepAttributes: false,
        },
        orderedList: {
          keepMarks: true,
          keepAttributes: false,
        },
      }),
      Underline,
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'max-w-full max-h-[360px] object-contain rounded-lg border my-2 shadow-xs',
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline font-medium hover:text-primary/80',
        },
      }),
    ],
    content: content || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Keep editor content in sync when external content prop changes (e.g. form reset or editing question)
  useEffect(() => {
    if (editor && editor.getHTML() !== content) {
      editor.commands.setContent(content || "", false);
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error(
        language === "ar" ? "يرجى اختيار ملف صورة صالح" 
        : language === "fr" ? "Veuillez sélectionner un fichier image valide" 
        : "Please select a valid image file"
      );
      return;
    }

    // Convert file to base64 data URL
    const reader = new FileReader();
    reader.onload = () => {
      const base64Url = reader.result as string;
      editor.chain().focus().setImage({ src: base64Url }).run();
      setShowImageDialog(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      toast.success(
        language === "ar" ? "تمت إضافة الصورة بنجاح" 
        : language === "fr" ? "Image ajoutée à la question" 
        : "Image added to question"
      );
    };
    reader.readAsDataURL(file);
  };

  const addImageUrl = () => {
    if (imageUrl.trim()) {
      editor.chain().focus().setImage({ src: imageUrl.trim() }).run();
      setImageUrl("");
      setShowImageDialog(false);
      toast.success(
        language === "ar" ? "تمت إضافة الصورة بنجاح" 
        : language === "fr" ? "Image ajoutée à la question" 
        : "Image added to question"
      );
    }
  };

  const addLink = () => {
    if (linkUrl.trim()) {
      const textToUse = linkText.trim() || linkUrl.trim();
      editor.chain().focus().insertContent(`<a href="${linkUrl.trim()}">${textToUse}</a>`).run();
      setLinkUrl("");
      setLinkText("");
      setShowLinkDialog(false);
      toast.success(
        language === "ar" ? "تمت إضافة الرابط بنجاح" 
        : language === "fr" ? "Lien inséré avec succès" 
        : "Link added to question"
      );
    }
  };

  return (
    <div className={`border rounded-xl bg-background overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 focus-within:border-primary transition-all ${className}`}>
      {/* Rich Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 border-b bg-muted/30 flex-wrap select-none text-muted-foreground">
        {/* Formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('bold') ? 'bg-primary/15 text-primary font-bold' : 'hover:bg-muted'}`}
          title={language === "ar" ? "عريض (Ctrl+B)" : language === "fr" ? "Gras (Ctrl+B)" : "Bold (Ctrl+B)"}
        >
          <Bold className="h-3.5 w-3.5" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('italic') ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "مائل (Ctrl+I)" : language === "fr" ? "Italique (Ctrl+I)" : "Italic (Ctrl+I)"}
        >
          <Italic className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('underline') ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "تسطير (Ctrl+U)" : language === "fr" ? "Souligné (Ctrl+U)" : "Underline (Ctrl+U)"}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('strike') ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "يتوسطه خط" : language === "fr" ? "Barré" : "Strikethrough"}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Headings */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('heading', { level: 1 }) ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "عنوان رئيسي" : language === "fr" ? "Titre 1" : "Heading 1"}
        >
          <Heading1 className="h-3.5 w-3.5" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('heading', { level: 2 }) ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "عنوان فرعي" : language === "fr" ? "Titre 2" : "Heading 2"}
        >
          <Heading2 className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('bulletList') ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "قائمة نقطية" : language === "fr" ? "Liste à puces" : "Bullet List"}
        >
          <List className="h-3.5 w-3.5" />
        </Button>
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('orderedList') ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "قائمة رقمية" : language === "fr" ? "Liste numérotée" : "Numbered List"}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Blockquote & Code */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('blockquote') ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "اقتباس" : language === "fr" ? "Citation" : "Quote"}
        >
          <Quote className="h-3.5 w-3.5" />
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleCode().run()}
          className={`h-7 w-7 p-0 rounded-md ${editor.isActive('code') ? 'bg-primary/15 text-primary' : 'hover:bg-muted'}`}
          title={language === "ar" ? "كود" : language === "fr" ? "Code" : "Code"}
        >
          <Code className="h-3.5 w-3.5" />
        </Button>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Image Dialog Trigger */}
        <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
          <DialogTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="sm"
              className="h-7 px-2 gap-1 rounded-md text-primary font-medium hover:bg-primary/10"
              title={language === "ar" ? "إدراج صورة" : language === "fr" ? "Insérer une image" : "Insert Image"}
            >
              <ImageIcon className="h-3.5 w-3.5" />
              <span className="text-[11px] hidden sm:inline">{language === "ar" ? "صورة" : language === "fr" ? "Image" : "Image"}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                {language === "ar" ? "إدراج صورة في السؤال" : language === "fr" ? "Insérer une image dans la question" : "Insert Image into Question"}
              </DialogTitle>
              <DialogDescription>
                {language === "ar" ? "اختر صورة من جهازك أو أدخل رابط مباشر لصورة." : language === "fr" ? "Importez une image depuis votre appareil ou renseignez une URL." : "Upload an image from your device or provide a direct image URL."}
              </DialogDescription>
            </DialogHeader>

            <Tabs value={imageTab} onValueChange={(v: any) => setImageTab(v)} className="w-full">
              <TabsList className="grid grid-cols-2 w-full mb-4">
                <TabsTrigger value="upload" className="text-xs font-semibold flex items-center gap-1.5">
                  <Upload className="h-3.5 w-3.5" />
                  {language === "ar" ? "رفع من الجهاز" : language === "fr" ? "Importer un fichier" : "Upload File"}
                </TabsTrigger>
                <TabsTrigger value="url" className="text-xs font-semibold flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5" />
                  {language === "ar" ? "رابط إنترنت" : language === "fr" ? "Lien URL" : "Image URL"}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary/60 hover:bg-muted/20 transition-all"
                >
                  <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
                  <p className="text-xs font-semibold text-foreground">
                    {language === "ar" ? "انقر لاختيار صورة من جهازك" : language === "fr" ? "Cliquez pour choisir une image sur votre ordinateur" : "Click to select an image from your device"}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-1">PNG, JPG, JPEG, GIF, WebP</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </TabsContent>

              <TabsContent value="url" className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="imageUrl" className="text-xs font-semibold">
                    {language === "ar" ? "رابط الصورة (URL)" : language === "fr" ? "URL de l'image" : "Image URL"}
                  </Label>
                  <Input
                    id="imageUrl"
                    placeholder="https://example.com/image.png"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setShowImageDialog(false)}>
                    {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
                  </Button>
                  <Button type="button" size="sm" onClick={addImageUrl} disabled={!imageUrl.trim()}>
                    {language === "ar" ? "إدراج الصورة" : language === "fr" ? "Insérer l'image" : "Insert Image"}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Link Dialog */}
        <Dialog open={showLinkDialog} onOpenChange={setShowLinkDialog}>
          <DialogTrigger asChild>
            <Button 
              type="button"
              variant="ghost" 
              size="sm"
              className="h-7 w-7 p-0 rounded-md"
              title={language === "ar" ? "إدراج رابط" : language === "fr" ? "Insérer un lien" : "Insert Link"}
            >
              <LinkIcon className="h-3.5 w-3.5" />
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{language === "ar" ? "إدراج رابط تشعبي" : language === "fr" ? "Insérer un lien" : "Insert Link"}</DialogTitle>
              <DialogDescription>
                {language === "ar" ? "أدخل عنوان الرابط والنص المراد عرضه." : language === "fr" ? "Renseignez le texte et l'adresse URL du lien." : "Enter the display text and URL."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="linkText" className="text-xs font-semibold">
                  {language === "ar" ? "النص المعروض" : language === "fr" ? "Texte à afficher" : "Display Text"}
                </Label>
                <Input
                  id="linkText"
                  placeholder={language === "ar" ? "انقر هنا" : language === "fr" ? "Cliquez ici" : "Click here"}
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="linkUrl" className="text-xs font-semibold">
                  {language === "ar" ? "الرابط (URL)" : language === "fr" ? "Adresse URL" : "URL"}
                </Label>
                <Input
                  id="linkUrl"
                  placeholder="https://..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowLinkDialog(false)}>
                {language === "ar" ? "إلغاء" : language === "fr" ? "Annuler" : "Cancel"}
              </Button>
              <Button type="button" onClick={addLink} disabled={!linkUrl.trim()}>
                {language === "ar" ? "إدراج الرابط" : language === "fr" ? "Insérer le lien" : "Insert Link"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <div className="w-px h-4 bg-border mx-1" />

        {/* Clear formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
          className="h-7 w-7 p-0 rounded-md"
          title={language === "ar" ? "إزالة التنسيق" : language === "fr" ? "Effacer la mise en forme" : "Clear Formatting"}
        >
          <Eraser className="h-3.5 w-3.5" />
        </Button>

        {/* History */}
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().undo().run()}
            disabled={!editor.can().chain().focus().undo().run()}
            className="h-7 w-7 p-0 rounded-md disabled:opacity-40"
            title={language === "ar" ? "تراجع" : language === "fr" ? "Annuler (Undo)" : "Undo"}
          >
            <Undo className="h-3.5 w-3.5" />
          </Button>
          
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => editor.chain().focus().redo().run()}
            disabled={!editor.can().chain().focus().redo().run()}
            className="h-7 w-7 p-0 rounded-md disabled:opacity-40"
            title={language === "ar" ? "إعادة" : language === "fr" ? "Rétablir (Redo)" : "Redo"}
          >
            <Redo className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="p-3 bg-card min-h-[140px] cursor-text" onClick={() => editor.commands.focus()}>
        <EditorContent 
          editor={editor} 
          className={`prose prose-sm max-w-none dark:prose-invert focus:outline-none ${minHeight} [&_.ProseMirror]:min-h-[110px] [&_.ProseMirror]:outline-none`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};

export default RichTextEditor;