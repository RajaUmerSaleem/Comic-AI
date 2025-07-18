"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api"
import {
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Zap,
  MessageSquare,
  MapPin,
  Download,
  FileImage,
  Type,
} from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
// Removed Select, SelectContent, SelectItem, SelectTrigger, SelectValue as FontPicker will handle this
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import jsPDF from "jspdf"
import JSZip from "jszip"
import { saveAs } from "file-saver"

// Import Font interface and loadFont utility from lib/fonts.ts
import { type Font, loadFont } from "@/lib/fonts"
import { FontPicker } from "@/components/font-picker" // Import the new FontPicker component

interface SpeechBubble {
  bubble_id: number
  bubble_no: number
  coordinates: number[]
  mask_coordinates: number[][]
  text: string
  translation: string | null
  font_size?: number | null
  font_color?: number[] | null
  font_id?: number | null
}

interface PageData {
  page_number: number
  page_id: number
  page_image_url: string
  detected_image_url: string | null
  text_removed_image_url: string | null
  text_translated_image_url: string | null
  status: string
  speech_bubbles: SpeechBubble[]
}

// Removed local Font interface as it's now imported from lib/fonts.ts

interface ComicEditorSidebarProps {
  selectedFileId: number | null
  selectedPageId: number | null
  selectedBubbleId?: number | null
  pages: PageData[]
  onDetectionStart: (pageId?: number) => void
  onTextRemovalStart: (pageId?: number) => void
  onPagesUpdate: () => void
  processingTasks: Map<string, string>
  mode: "editor" | "bubbles"
  onAddBubbleStart?: () => void
  onPolygonSelect?: (coordinates: number[][]) => void
  isAddingBubble?: boolean
  onBubbleUpdate?: (pageId: number, bubbleId: number, updates: Partial<SpeechBubble>) => void
  onBubbleGeometrySave?: (pageId: number, bubbleId: number, mask_coordinates: number[][], coordinates: number[]) => void
  onBubbleClick?: (bubble: SpeechBubble) => void
   fonts?: Array<{ id: number; name: string; file_url?: string }> 
}

export function ComicEditorSidebar({
  selectedFileId,
  selectedPageId,
  selectedBubbleId,
  pages,
  onDetectionStart,
  onTextRemovalStart,
  onPagesUpdate,
  processingTasks,
  mode,
  onAddBubbleStart,
  onPolygonSelect,
  isAddingBubble = false,
  onBubbleUpdate,
  onBubbleGeometrySave,
  onBubbleClick,
  fonts: propsFonts,
}: ComicEditorSidebarProps) {
  const { token } = useAuth()
  const [isSinglePageTranslateDialogOpen, setIsSinglePageTranslateDialogOpen] = useState(false)
  const [selectedFontId, setSelectedFontId] = useState<number | null>(null)
  const [isFontDialogOpen, setIsFontDialogOpen] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [bubbleFonts, setBubbleFonts] = useState<Record<number, number>>({})
  const [newBubbleData, setNewBubbleData] = useState({
    page_id: 0,
    bubble_no: 0,
    coordinates: [0, 0, 0, 0],
    mask_coordinates: [[0, 0]],
    text: "",
    translation: "",
    font_size: 14, // Default font size
    font_color: [0, 0, 0], // Default font color (black)
    font_id: 1, // Default font ID (assuming ID 1 exists)
  })
  const { toast } = useToast()
  const fonts = propsFonts || []
  const selectedPage = pages.find((p) => p.page_id === selectedPageId)
  const selectedBubble = selectedPage?.speech_bubbles.find((b) => b.bubble_id === selectedBubbleId)

 
  // Initialize bubble fonts from page data and set default selected font
 useEffect(() => {
    const newBubbleFonts: Record<number, number> = {}
    let defaultFontId: number | null = null
    pages.forEach((page) => {
      page.speech_bubbles.forEach((bubble) => {
        if (bubble.font_id) {
          newBubbleFonts[bubble.bubble_id] = bubble.font_id
          if (!defaultFontId) {
            defaultFontId = bubble.font_id
          }
        }
      })
    })
    setBubbleFonts(newBubbleFonts)
    // Set default font if not already set
    if (!selectedFontId && defaultFontId) {
      setSelectedFontId(defaultFontId)
    } else if (!selectedFontId && fonts.length > 0) {
      setSelectedFontId(fonts[0].id)
    }
  }, [pages, fonts, selectedFontId]) 
  const createBubble = async () => {
    if (!selectedPageId) return
    try {
      await apiRequest(
        "/v1/pages/bubble",
        {
          method: "POST",
          body: JSON.stringify({ ...newBubbleData, page_id: selectedPageId }),
        },
        token!,
      )
      toast({
        title: "Success",
        description: "Speech bubble created successfully",
      })
      setNewBubbleData({
        page_id: 0,
        bubble_no: 0,
        coordinates: [0, 0, 0, 0],
        mask_coordinates: [[0, 0]],
        text: "",
        translation: "",
        font_size: 14,
        font_color: [0, 0, 0],
        font_id: 1,
      })
      onPagesUpdate()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const deleteBubble = async (bubbleId: number | undefined) => {
    if (bubbleId == null) {
      toast({
        title: "Error",
        description: "Missing bubble ID",
        variant: "destructive",
      })
      return
    }
    try {
      await apiRequest(`/v1/pages/bubble/${bubbleId}`, { method: "DELETE" }, token!)
      toast({ title: "Success", description: "Speech bubble deleted" })
      onPagesUpdate()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const updateBubbleTranslation = async (
    pageId: number,
    bubbleId: number,
    translation: string,
    font_size?: number,
    font_color?: string,
    font_id?: number,
  ) => {
    try {
      const currentPage = pages.find((p) => p.page_id === pageId)
      const currentBubble = currentPage?.speech_bubbles.find((b) => b.bubble_id === bubbleId)
      if (!currentBubble) {
        toast({ title: "Error", description: "Bubble not found for update.", variant: "destructive" })
        return
      }
      await apiRequest(
        `/v1/pages/${pageId}/bubble/${bubbleId}/translation`,
        {
          method: "PUT",
          body: JSON.stringify({
            page_id: pageId,
            bubble_data: [
              {
                bubble_id: bubbleId,
                translation,
                font_size: font_size ?? currentBubble.font_size,
                font_color: font_color ? hexToRgbArray(font_color) : currentBubble.font_color,
                font_id: font_id ?? currentBubble.font_id,
              },
            ],
          }),
        },
        token!,
      )
      if (onBubbleUpdate) {
        onBubbleUpdate(pageId, bubbleId, {
          translation,
          font_size: font_size ?? currentBubble.font_size,
          font_color: font_color ? hexToRgbArray(font_color) : currentBubble.font_color,
          font_id: font_id ?? currentBubble.font_id,
        })
      }
      toast({ title: "Success", description: "Translation updated" })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

 const updateBubbleFont = async (pageId: number, bubbleId: number, fontId: number | null) => {
  const bubble = selectedPage?.speech_bubbles.find((b) => b.bubble_id === bubbleId)
  if (!bubble) return

  // Find the font object to get its name and file_url
  const selectedFont = fonts.find((f) => f.id === fontId)
  
  // Update local font mapping immediately for UI feedback
  setBubbleFonts((prev) => ({ ...prev, [bubbleId]: fontId || 0 }))
  
  // Update local state immediately for real-time preview
  if (onBubbleUpdate) {
    onBubbleUpdate(pageId, bubbleId, { font_id: fontId })
  }

  // Load font if it exists and has a file_url
  if (selectedFont && selectedFont.file_url) {
    try {
      await loadFont({
        name: selectedFont.name,
        file_url: selectedFont.file_url,
        id: 0
      })
      // Force another update after font is loaded
      setTimeout(() => {
        if (onBubbleUpdate) {
          onBubbleUpdate(pageId, bubbleId, { font_id: fontId })
        }
      }, 100)
    } catch (error) {
      console.warn('Font loading failed:', error)
    }
  }

  try {
    await updateBubbleTranslation(
      pageId,
      bubbleId,
      bubble.translation || "",
      bubble.font_size || 14,
      bubble.font_color ? rgbArrayToHex(bubble.font_color) : "#000000",
      fontId || 1,
    )
    toast({ title: "Success", description: "Font updated" })
  } catch (error: any) {
    toast({
      title: "Error",
      description: error.message,
      variant: "destructive",
    })
  }
}

  function hexToRgbArray(hex: string): [number, number, number] {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? [Number.parseInt(result[1], 16), Number.parseInt(result[2], 16), Number.parseInt(result[3], 16)]
      : [0, 0, 0]
  }

  const updateBubbleText = async (pageId: number, bubbleId: number, text: string) => {
    // Update local state immediately for real-time preview
    if (onBubbleUpdate) {
      onBubbleUpdate(pageId, bubbleId, { text })
    }
    try {
      const currentPage = pages.find((p) => p.page_id === pageId)
      const currentBubble = currentPage?.speech_bubbles.find((b) => b.bubble_id === bubbleId)
      if (!currentBubble) {
        toast({ title: "Error", description: "Bubble not found for update.", variant: "destructive" })
        return
      }
      await apiRequest(
        `/v1/pages/${pageId}/bubble/${bubbleId}/text?text=${encodeURIComponent(text)}`,
        {
          method: "PUT",
          body: JSON.stringify({
            bubble_id: bubbleId,
            text,
            translation: currentBubble.translation,
            font_size: currentBubble.font_size,
            font_color: currentBubble.font_color,
            font_id: currentBubble.font_id, // Ensure font_id is sent back
          }),
        },
        token!,
      )
      toast({ title: "Success", description: "Text updated" })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const isProcessing = (type: string) => {
    const taskKey = selectedPageId ? `${type}-${selectedPageId}` : `${type}-${selectedFileId}`
    return processingTasks.has(taskKey)
  }

  function rgbArrayToHex(rgb: number[]): string {
    if (rgb.length !== 3) return "#000000"
    return (
      "#" +
      rgb
        .map((x) => {
          const hex = x.toString(16)
          return hex.length === 1 ? "0" + hex : hex
        })
        .join("")
    )
  }

  const handlePolygonSelect = (coordinates: number[][]) => {
    let minX = Number.POSITIVE_INFINITY,
      maxX = Number.NEGATIVE_INFINITY,
      minY = Number.POSITIVE_INFINITY,
      maxY = Number.NEGATIVE_INFINITY
    for (const [x, y] of coordinates) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
    setNewBubbleData((prev) => ({
      ...prev,
      coordinates: [minX, minY, maxX, maxY],
      mask_coordinates: coordinates,
    }))
  }

  const captureCanvasElementClean = async (
    element: HTMLElement,
  ): Promise<{ dataUrl: string; originalWidth: number; originalHeight: number }> => {
    const canvasElement = element.querySelector("canvas") as HTMLCanvasElement
    const imageElement = element.querySelector("img") as HTMLImageElement
    if (!canvasElement || !imageElement) {
      throw new Error("Canvas or image element not found")
    }
    const exportCanvasResult = (canvasElement as any).getExportCanvas?.()
    if (!exportCanvasResult) {
      throw new Error("Export canvas not available")
    }
    const exportCanvas = exportCanvasResult.canvas
    const originalWidth = exportCanvasResult.originalWidth
    const originalHeight = exportCanvasResult.originalHeight
    const compositeCanvas = document.createElement("canvas")
    const ctx = compositeCanvas.getContext("2d")
    if (!ctx) {
      throw new Error("Could not get canvas context")
    }
    compositeCanvas.width = exportCanvas.width
    compositeCanvas.height = exportCanvas.height
    ctx.drawImage(imageElement, 0, 0, compositeCanvas.width, compositeCanvas.height)
    ctx.drawImage(exportCanvas, 0, 0)
    return { dataUrl: compositeCanvas.toDataURL("image/png"), originalWidth, originalHeight }
  }

  const exportToPDF = async () => {
    if (!selectedFileId || pages.length === 0) {
      toast({
        title: "Error",
        description: "No pages to export",
        variant: "destructive",
      })
      return
    }
    setIsExporting(true)
    try {
      const sortedPages = pages.sort((a, b) => a.page_number - b.page_number)
      const firstPage = sortedPages[0]
      const canvasElements = document.querySelectorAll(`[data-page-id="${firstPage.page_id}"]`)
      let firstCanvasElement: HTMLElement | null = null
      for (const element of canvasElements) {
        const canvasOverlay = element.querySelector(".relative.inline-block")
        if (canvasOverlay) {
          firstCanvasElement = canvasOverlay as HTMLElement
          break
        }
      }
      if (!firstCanvasElement) {
        toast({
          title: "Error",
          description: "First page canvas not found for dimensions.",
          variant: "destructive",
        })
        setIsExporting(false)
        return
      }
      const { originalWidth, originalHeight } = await captureCanvasElementClean(firstCanvasElement)
      const orientation = originalWidth > originalHeight ? "l" : "p"
      const pdf = new jsPDF(orientation, "pt", [originalWidth, originalHeight])
      for (let i = 0; i < sortedPages.length; i++) {
        const page = sortedPages[i]
        const pageCanvasElements = document.querySelectorAll(`[data-page-id="${page.page_id}"]`)
        let pageCanvasElement: HTMLElement | null = null
        for (const element of pageCanvasElements) {
          const canvasOverlay = element.querySelector(".relative.inline-block")
          if (canvasOverlay) {
            pageCanvasElement = canvasOverlay as HTMLElement
            break
          }
        }
        if (pageCanvasElement) {
          const { dataUrl } = await captureCanvasElementClean(pageCanvasElement)
          if (i > 0) {
            pdf.addPage([originalWidth, originalHeight])
          }
          pdf.addImage(dataUrl, "PNG", 0, 0, originalWidth, originalHeight)
          pdf.setFontSize(10)
          const marginPt = 10
          pdf.text(`Page ${page.page_number}`, marginPt, originalHeight - marginPt)
        }
      }
      pdf.save(`comic-file-${selectedFileId}-translated.pdf`)
      toast({
        title: "Success",
        description: "PDF exported successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to export PDF: " + error.message,
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportToImages = async () => {
    if (!selectedFileId || pages.length === 0) {
      toast({
        title: "Error",
        description: "No pages to export",
        variant: "destructive",
      })
      return
    }
    setIsExporting(true)
    try {
      const zip = new JSZip()
      const sortedPages = pages.sort((a, b) => a.page_number - b.page_number)
      for (const page of sortedPages) {
        const canvasElements = document.querySelectorAll(`[data-page-id="${page.page_id}"]`)
        let canvasElement: HTMLElement | null = null
        for (const element of canvasElements) {
          const canvasOverlay = element.querySelector(".relative.inline-block")
          if (canvasOverlay) {
            canvasElement = canvasOverlay as HTMLElement
            break
          }
        }
        if (canvasElement) {
          const { dataUrl } = await captureCanvasElementClean(canvasElement)
          const response = await fetch(dataUrl)
          const blob = await response.blob()
          zip.file(`page-${page.page_number.toString().padStart(3, "0")}.png`, blob)
        }
      }
      const zipBlob = await zip.generateAsync({ type: "blob" })
      saveAs(zipBlob, `comic-file-${selectedFileId}-translated-images.zip`)
      toast({
        title: "Success",
        description: "Images exported successfully",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to export images: " + error.message,
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const exportCurrentImage = async () => {
    if (!selectedFileId || !selectedPageId || !selectedPage) {
      toast({
        title: "Error",
        description: "No current page to export",
        variant: "destructive",
      })
      return
    }
    setIsExporting(true)
    try {
      const canvasElements = document.querySelectorAll(`[data-page-id="${selectedPageId}"]`)
      let canvasElement: HTMLElement | null = null
      for (const element of canvasElements) {
        const canvasOverlay = element.querySelector(".relative.inline-block")
        if (canvasOverlay) {
          canvasElement = canvasOverlay as HTMLElement
          break
        }
      }
      if (canvasElement) {
        const { dataUrl } = await captureCanvasElementClean(canvasElement)
        const link = document.createElement("a")
        link.download = `comic-page-${selectedPage.page_number}.png`
        link.href = dataUrl
        link.click()
        toast({
          title: "Success",
          description: "Current page exported successfully",
        })
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to export current page: " + error.message,
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  const getFontName = (fontId: number | null | undefined) => {
    if (fontId === null || fontId === undefined) return "sans-serif" // Default fallback
    const font = fonts.find((f) => f.id === fontId)
    return font ? font.name : "sans-serif" // Fallback to a generic font
  }

  return (
    <div className="space-y-4">
      {mode === "editor" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-4 w-4" />
              Processing Controls
            </CardTitle>
            <CardDescription>Generate detection and remove text from speech bubbles</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border rounded p-3 space-y-3">
              <Button
                onClick={() => onDetectionStart()}
                disabled={!selectedFileId || isProcessing("detect")}
                className="w-full"
              >
                {isProcessing("detect") ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Detecting...
                  </>
                ) : (
                  <>
                    <Eye className="mr-2 h-4 w-4" />
                    Detect All Pages
                  </>
                )}
              </Button>
              {selectedPageId && (
                <Button
                  onClick={() => onDetectionStart(selectedPageId)}
                  disabled={isProcessing("detect")}
                  variant="outline"
                  className="w-full"
                >
                  <Eye className="mr-2 h-4 w-4" />
                  Detect Current Page ({selectedPage?.page_number})
                </Button>
              )}
            </div>
            <div className="border rounded p-3 space-y-3">
              <Button
                onClick={() => onTextRemovalStart()}
                disabled={!selectedFileId || isProcessing("remove")}
                className="w-full"
              >
                <EyeOff className="mr-2 h-4 w-4" />
                Remove Text All Pages
              </Button>
              {selectedPageId && (
                <Button
                  onClick={() => onTextRemovalStart(selectedPageId)}
                  disabled={isProcessing("remove")}
                  variant="outline"
                  className="w-full text-sm"
                >
                  <EyeOff className="mr-1 h-4 w-4" />
                  Remove Text Current Page ({selectedPage?.page_number})
                </Button>
              )}
            </div>
            <div className="border rounded p-3 space-y-3">
              <Button
                onClick={exportToPDF}
                disabled={!selectedFileId || pages.length === 0 || isExporting}
                className="w-full text-sm"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export PDF
                  </>
                )}
              </Button>
              <Button
                onClick={exportToImages}
                disabled={!selectedFileId || pages.length === 0 || isExporting}
                className="w-full text-sm bg-transparent"
                variant="outline"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileImage className="mr-2 h-4 w-4" />
                    Export Images
                  </>
                )}
              </Button>
            </div>
            <div className="border rounded p-3 space-y-3">
              <Button
                onClick={exportCurrentImage}
                disabled={!selectedFileId || !selectedPageId || isExporting}
                className="w-full text-sm bg-transparent"
                variant="outline"
              >
                {isExporting ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <FileImage className="mr-2 h-4 w-4" />
                    Export Current Image ({selectedPage?.page_number})
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      {mode === "bubbles" && selectedPage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex h-full items-center">
              <MessageSquare className="mr-2 h-4 w-4" />
              Speech Bubbles
            </CardTitle>
            <CardDescription>
              Page {selectedPage.page_number} - {selectedPage.speech_bubbles.length} bubbles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-200px)]">
              <div className="space-y-3 pr-4">
                {selectedPage.speech_bubbles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No speech bubbles detected. Run detection first.
                  </p>
                ) : (
                  selectedPage.speech_bubbles.map((bubble) => (
                    <div
                      key={bubble.bubble_id}
                      className={`border rounded-lg p-3 cursor-pointer ${
                        selectedBubbleId === bubble.bubble_id ? "border-red-500 bg-red-50" : ""
                      }`}
                      onClick={() => onBubbleClick?.(bubble)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary">
                          Bubble #{bubble.bubble_no} (Page {selectedPage.page_number})
                        </Badge>
                        <Button variant="outline" size="sm" onClick={() => deleteBubble(bubble.bubble_id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      {/* Coordinates Display */}
                      <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
                        <div className="flex items-center gap-1 mb-1">
                          <MapPin className="h-3 w-3" />
                          <span className="font-medium">Coordinates:</span>
                        </div>
                        <div className="text-gray-600">
                          <div>Bounding Box: [{bubble.coordinates.map((c) => Math.round(c)).join(", ")}]</div>
                          <div>Polygon Points: {bubble.mask_coordinates.length} points</div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Original Text:</p>
                        <Textarea
                          className="text-sm"
                          value={bubble.text}
                          onChange={(e) => {
                            if (onBubbleUpdate) {
                              onBubbleUpdate(selectedPage.page_id, bubble.bubble_id, {
                                text: e.target.value,
                              })
                            }
                          }}
                          onBlur={(e) => updateBubbleText(selectedPage.page_id, bubble.bubble_id, e.target.value)}
                        />
                        <p className="text-xs font-medium text-muted-foreground">Translation:</p>
                        <Textarea
                          className="text-sm"
                          value={bubble.translation || ""}
                          onChange={(e) => {
                            if (onBubbleUpdate) {
                              onBubbleUpdate(selectedPage.page_id, bubble.bubble_id, {
                                translation: e.target.value,
                              })
                            }
                          }}
                          onBlur={(e) =>
                            updateBubbleTranslation(selectedPage.page_id, bubble.bubble_id, e.target.value)
                          }
                        />
                        {/* Font Family Selection using FontPicker */}
                        <div className="space-y-2">
                          <div className="flex items-center gap-1">
                            <Type className="h-3 w-3" />
                            <Label className="text-xs">Choose Font Family</Label>
                          </div>
                          <FontPicker
                            options={fonts.filter((font): font is Font => typeof font.file_url === 'string')}
                            value={bubbleFonts[bubble.bubble_id] ?? bubble.font_id}
                            onChange={(fontId) => updateBubbleFont(selectedPage.page_id, bubble.bubble_id, fontId)}
                          />
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col w-1/2">
                            <Label className="text-xs">Font Size</Label>
                            <input
                              type="number"
                              className="border rounded px-2 py-1 text-sm"
                              value={bubble.font_size ?? ""}
                              onChange={(e) => {
                                const fontSize = e.target.value === "" ? null : Number(e.target.value)
                                if (onBubbleUpdate) {
                                  onBubbleUpdate(selectedPage.page_id, bubble.bubble_id, {
                                    font_size: fontSize,
                                  })
                                }
                              }}
                              onBlur={(e) =>
                                updateBubbleTranslation(
                                  selectedPage.page_id,
                                  bubble.bubble_id,
                                  bubble.translation || "",
                                  e.target.value === "" ? undefined : Number(e.target.value),
                                  bubble.font_color ? rgbArrayToHex(bubble.font_color) : "#000000",
                                  bubbleFonts[bubble.bubble_id] ?? bubble.font_id ?? selectedFontId ?? 1,
                                )
                              }
                            />
                          </div>
                          <div className="flex flex-col w-1/2">
                            <Label className="text-xs">Font Color</Label>
                            <input
                              type="color"
                              className="h-9 rounded"
                              value={bubble.font_color ? rgbArrayToHex(bubble.font_color) : "#000000"}
                              onChange={(e) => {
                                if (onBubbleUpdate) {
                                  onBubbleUpdate(selectedPage.page_id, bubble.bubble_id, {
                                    font_color: hexToRgbArray(e.target.value),
                                  })
                                }
                              }}
                              onBlur={(e) =>
                                updateBubbleTranslation(
                                  selectedPage.page_id,
                                  bubble.bubble_id,
                                  bubble.translation || "",
                                  bubble.font_size || 14,
                                  e.target.value,
                                  bubbleFonts[bubble.bubble_id] ?? bubble.font_id ?? selectedFontId ?? 1,
                                )
                              }
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full bg-transparent">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Speech Bubble
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create Speech Bubble</DialogTitle>
                      <DialogDescription>
                        {isAddingBubble
                          ? "Go to the translated tab and click to draw a polygon for the speech bubble"
                          : "Add a new speech bubble to this page"}
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      {!isAddingBubble ? (
                        <>
                          <Button
                            onClick={() => {
                              onAddBubbleStart?.()
                            }}
                            className="w-full"
                          >
                            Select Polygon on Canvas
                          </Button>
                          <Label htmlFor="new-bubble-text">Text</Label>
                          <Textarea
                            id="new-bubble-text"
                            value={newBubbleData.text}
                            onChange={(e) =>
                              setNewBubbleData((prev) => ({
                                ...prev,
                                text: e.target.value,
                              }))
                            }
                          />
                          <Label htmlFor="new-bubble-translation">Translation</Label>
                          <Textarea
                            id="new-bubble-translation"
                            value={newBubbleData.translation}
                            onChange={(e) =>
                              setNewBubbleData((prev) => ({
                                ...prev,
                                translation: e.target.value,
                              }))
                            }
                          />
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col w-1/2">
                              <Label className="text-xs">Font Size</Label>
                              <input
                                type="number"
                                className="border rounded px-2 py-1 text-sm"
                                value={newBubbleData.font_size}
                                onChange={(e) =>
                                  setNewBubbleData((prev) => ({
                                    ...prev,
                                    font_size: Number(e.target.value),
                                  }))
                                }
                              />
                            </div>
                            <div className="flex flex-col w-1/2">
                              <Label className="text-xs">Font Color</Label>
                              <input
                                type="color"
                                className="h-9 rounded"
                                value={rgbArrayToHex(newBubbleData.font_color)}
                                onChange={(e) =>
                                  setNewBubbleData((prev) => ({
                                    ...prev,
                                    font_color: hexToRgbArray(e.target.value),
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center gap-1">
                              <Type className="h-3 w-3" />
                              <Label className="text-xs">Choose Font Family</Label>
                            </div>
                            <FontPicker
                              options={fonts.filter((font): font is Font => typeof font.file_url === 'string')}
                              value={newBubbleData.font_id}
                              onChange={(fontId) =>
                                setNewBubbleData((prev) => ({
                                  ...prev,
                                  font_id: fontId || 1, // Default to 1 if null
                                }))
                              }
                            />
                          </div>
                          <Button
                            onClick={createBubble}
                            className="w-full"
                            disabled={newBubbleData.mask_coordinates.length < 3}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Create Bubble
                          </Button>
                        </>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm text-muted-foreground mb-4">
                            Go to the translated tab and click to create polygon points. Double-click or right-click to
                            finish.
                          </p>
                          <Button
                            onClick={() => {
                              // setIsAddingBubble(false);
                            }}
                            variant="outline"
                          >
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
