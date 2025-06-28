"use client"

import { useState } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api"
import { Eye, RefreshCw, Plus, Edit, Trash2, Save, Wand2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface SpeechBubble {
  id: number
  bubble_no: number
  coordinates_xyxy: number[]
  mask_coordinates_xyxy: number[][]
  text: string
  translation: string
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

interface ComicEditorSidebarProps {
  selectedFileId: number | null
  selectedPageId: number | null
  pages: PageData[]
  onDetectionStart: (pageId?: number) => void
  onTextRemovalStart: (pageId?: number) => void
  onPagesUpdate: () => void
  processingTasks: Map<string, string>
}

export function ComicEditorSidebar({
  selectedFileId,
  selectedPageId,
  pages,
  onDetectionStart,
  onTextRemovalStart,
  onPagesUpdate,
  processingTasks,
}: ComicEditorSidebarProps) {
  const { token } = useAuth()
  const [selectedBubble, setSelectedBubble] = useState<SpeechBubble | null>(null)
  const [editingBubble, setEditingBubble] = useState<Partial<SpeechBubble> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const selectedPage = pages.find((p) => p.page_id === selectedPageId)

  const updateBubbleTranslation = async (bubbleId: number, translation: string) => {
    if (!selectedPageId) return

    try {
      await apiRequest(
        `/v1/pages/${selectedPageId}/bubble/${bubbleId}/translation`,
        {
          method: "PUT",
          body: JSON.stringify({
            page_id: selectedPageId,
            bubble_data: [
              {
                bubble_id: bubbleId,
                translation,
                font_size: 12,
                font_color: [0, 0, 0],
              },
            ],
          }),
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Translation updated successfully",
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

  const updateBubbleText = async (bubbleId: number, text: string) => {
    if (!selectedPageId) return

    try {
      await apiRequest(
        `/v1/pages/${selectedPageId}/bubble/${bubbleId}/text?text=${encodeURIComponent(text)}`,
        {
          method: "PUT",
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Text updated successfully",
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

  const createBubble = async (bubbleData: Partial<SpeechBubble>) => {
    if (!selectedPageId) return

    try {
      await apiRequest(
        "/v1/pages/bubble",
        {
          method: "POST",
          body: JSON.stringify({
            page_id: selectedPageId,
            bubble_no: bubbleData.bubble_no || 1,
            coordinates_xyxy: bubbleData.coordinates_xyxy || [0, 0, 100, 100],
            mask_coordinates_xyxy: bubbleData.mask_coordinates_xyxy || [[0, 0]],
            text: bubbleData.text || "",
            translation: bubbleData.translation || "",
          }),
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Speech bubble created successfully",
      })
      onPagesUpdate()
      setEditingBubble(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const updateBubble = async (bubbleId: number, bubbleData: Partial<SpeechBubble>) => {
    try {
      await apiRequest(
        `/v1/pages/bubble/${bubbleId}`,
        {
          method: "PUT",
          body: JSON.stringify({
            coordinates_xyxy: bubbleData.coordinates_xyxy,
            mask_coordinates_xyxy: bubbleData.mask_coordinates_xyxy,
            text: bubbleData.text,
            translation: bubbleData.translation,
          }),
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Speech bubble updated successfully",
      })
      onPagesUpdate()
      setEditingBubble(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const deleteBubble = async (bubbleId: number) => {
    try {
      await apiRequest(
        `/v1/pages/bubble/${bubbleId}`,
        {
          method: "DELETE",
        },
        token!,
      )

      toast({
        title: "Success",
        description: "Speech bubble deleted successfully",
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

  const isProcessing = (type: string) => {
    const taskKey = selectedPageId ? `${type}-${selectedPageId}` : `${type}-${selectedFileId}`
    return processingTasks.has(taskKey)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Wand2 className="mr-2 h-4 w-4" />
            Processing
          </CardTitle>
          <CardDescription>Process the selected file or page</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={() => onDetectionStart()}
            disabled={!selectedFileId || isProcessing("detect")}
            className="w-full"
            size="sm"
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
              size="sm"
            >
              {isProcessing("detect") ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Detect This Page
                </>
              )}
            </Button>
          )}

          <Button
            onClick={() => onTextRemovalStart()}
            disabled={!selectedFileId || isProcessing("remove")}
            className="w-full"
            size="sm"
          >
            {isProcessing("remove") ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Removing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Text All
              </>
            )}
          </Button>

          {selectedPageId && (
            <Button
              onClick={() => onTextRemovalStart(selectedPageId)}
              disabled={isProcessing("remove")}
              variant="outline"
              className="w-full"
              size="sm"
            >
              {isProcessing("remove") ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remove Text This Page
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {selectedPage && (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>Page {selectedPage.page_number}</CardTitle>
                <CardDescription>Speech bubbles ({selectedPage.speech_bubbles.length})</CardDescription>
              </div>
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" onClick={() => setEditingBubble({})}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Speech Bubble</DialogTitle>
                    <DialogDescription>Create a new speech bubble for this page</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="bubble-text">Text</Label>
                      <Textarea
                        id="bubble-text"
                        value={editingBubble?.text || ""}
                        onChange={(e) => setEditingBubble((prev) => ({ ...prev, text: e.target.value }))}
                        placeholder="Enter the detected text"
                      />
                    </div>
                    <div>
                      <Label htmlFor="bubble-translation">Translation</Label>
                      <Textarea
                        id="bubble-translation"
                        value={editingBubble?.translation || ""}
                        onChange={(e) => setEditingBubble((prev) => ({ ...prev, translation: e.target.value }))}
                        placeholder="Enter the translation"
                      />
                    </div>
                    <Button onClick={() => createBubble(editingBubble!)} className="w-full">
                      Create Bubble
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <div className="space-y-3">
                {selectedPage.speech_bubbles.map((bubble) => (
                  <div key={bubble.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <Badge variant="outline">Bubble #{bubble.bubble_no}</Badge>
                      <div className="flex gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="outline" onClick={() => setEditingBubble(bubble)}>
                              <Edit className="h-3 w-3" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Edit Speech Bubble</DialogTitle>
                              <DialogDescription>Update the speech bubble content</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="edit-bubble-text">Text</Label>
                                <Textarea
                                  id="edit-bubble-text"
                                  value={editingBubble?.text || ""}
                                  onChange={(e) => setEditingBubble((prev) => ({ ...prev, text: e.target.value }))}
                                  placeholder="Enter the detected text"
                                />
                              </div>
                              <div>
                                <Label htmlFor="edit-bubble-translation">Translation</Label>
                                <Textarea
                                  id="edit-bubble-translation"
                                  value={editingBubble?.translation || ""}
                                  onChange={(e) =>
                                    setEditingBubble((prev) => ({ ...prev, translation: e.target.value }))
                                  }
                                  placeholder="Enter the translation"
                                />
                              </div>
                              <Button onClick={() => updateBubble(bubble.id, editingBubble!)} className="w-full">
                                Update Bubble
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="outline" onClick={() => deleteBubble(bubble.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Original Text</Label>
                        <p className="text-sm">{bubble.text || "No text detected"}</p>
                      </div>

                      <div>
                        <Label className="text-xs text-muted-foreground">Translation</Label>
                        <div className="flex gap-2">
                          <Input
                            value={bubble.translation}
                            onChange={(e) => {
                              const newTranslation = e.target.value
                              // Update locally for immediate feedback
                              setSelectedBubble({ ...bubble, translation: newTranslation })
                            }}
                            placeholder="Enter translation"
                            className="text-sm"
                          />
                          <Button size="sm" onClick={() => updateBubbleTranslation(bubble.id, bubble.translation)}>
                            <Save className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {selectedPage.speech_bubbles.length === 0 && (
                  <div className="text-center py-4 text-muted-foreground">
                    <p className="text-sm">No speech bubbles detected</p>
                    <p className="text-xs">Run detection to find speech bubbles</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
