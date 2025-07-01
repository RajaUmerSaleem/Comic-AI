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
import { Eye, EyeOff, RefreshCw, Plus, Edit, Trash2, Save, Zap, MessageSquare } from "lucide-react"
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
  bubble_id: number
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
  const [editingBubble, setEditingBubble] = useState<SpeechBubble | null>(null)
  const [bubbleText, setBubbleText] = useState("")
  const [bubbleTranslation, setBubbleTranslation] = useState("")
  const [newBubbleData, setNewBubbleData] = useState({
    page_id: 0,
    bubble_no: 0,
    coordinates_xyxy: [0, 0, 0, 0],
    mask_coordinates_xyxy: [[0, 0]],
    text: "",
    translation: "",
  })
  const { toast } = useToast()

  const selectedPage = pages.find((p) => p.page_id === selectedPageId)

  useEffect(() => {
    if (editingBubble) {
      setBubbleText(editingBubble.text)
      setBubbleTranslation(editingBubble.translation)
    }
  }, [editingBubble])

  const translateAllBubbles = async () => {
    if (!selectedFileId) return

    try {
      await apiRequest(
        `/v1/file/async-translate?file_id=${selectedFileId}`,
        // `https://vibrant.productizetech.com/v1/file/async-translate?file_id=${selectedFileId}&page_id=${selectedPageId}&font_id=${selected}`
        {
          method: "POST",
        },
        token!
      )
 
            // font_id: 1, 
      toast({
        title: "Success",
        description: "Translation started successfully",
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

  const updateBubble = async () => {
    if (!editingBubble) return

    try {
      await apiRequest(
        `/v1/pages/bubble/${editingBubble.bubble_id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            coordinates_xyxy: editingBubble.coordinates_xyxy,
            mask_coordinates_xyxy: editingBubble.mask_coordinates_xyxy,
            text: bubbleText,
            translation: bubbleTranslation,
          }),
        },
        token!
      )

      toast({
        title: "Success",
        description: "Speech bubble updated successfully",
      })

      setEditingBubble(null)
      setBubbleText("")
      setBubbleTranslation("")
      onPagesUpdate()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const createBubble = async () => {
    if (!selectedPageId) return

    try {
      await apiRequest(
        "/v1/pages/bubble",
        {
          method: "POST",
          body: JSON.stringify({
            ...newBubbleData,
            page_id: selectedPageId,
          }),
        },
        token!
      )

      toast({
        title: "Success",
        description: "Speech bubble created successfully",
      })

      setNewBubbleData({
        page_id: 0,
        bubble_no: 0,
        coordinates_xyxy: [0, 0, 0, 0],
        mask_coordinates_xyxy: [[0, 0]],
        text: "",
        translation: "",
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
  if (bubbleId === undefined || bubbleId === null) {
    console.error("❌ Bubble ID is missing");
    toast({
      title: "Error",
      description: "Cannot delete bubble: ID is missing",
      variant: "destructive",
    })
    return
  }

  try {
    const token = localStorage.getItem("userToken")
    const response = await apiRequest(
      `/v1/pages/bubble/${bubbleId}`,
      {
        method: "DELETE",
      },
      token!
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


  const updateBubbleTranslation = async (pageId: number, bubbleId: number, translation: string) => {
    try {
      await apiRequest(
        `/v1/pages/${pageId}/bubble/${bubbleId}/translation`,
        {
          method: "PUT",
          body: JSON.stringify({
            translation: translation,
            font_id: 1, // Default font_id
          }),
        },
        token!
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

  const isProcessing = (type: string) => {
    const taskKey = selectedPageId ? `${type}-${selectedPageId}` : `${type}-${selectedFileId}`
    return processingTasks.has(taskKey)
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="mr-2 h-4 w-4" />
            Processing Controls
          </CardTitle>
          <CardDescription>Generate detection and remove text from speech bubbles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
              {isProcessing("detect") ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Detecting...
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Detect Current Page
                </>
              )}
            </Button>
          )}

          <Button
            onClick={() => onTextRemovalStart()}
            disabled={!selectedFileId || isProcessing("remove")}
            className="w-full"
          >
            {isProcessing("remove") ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Removing Text...
              </>
            ) : (
              <>
                <EyeOff className="mr-2 h-4 w-4" />
                Remove Text All Pages
              </>
            )}
          </Button>

          {selectedPageId && (
            <Button
              onClick={() => onTextRemovalStart(selectedPageId)}
              disabled={isProcessing("remove")}
              variant="outline"
              className="w-full"
            >
              {isProcessing("remove") ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Removing Text...
                </>
              ) : (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Remove Text Current Page
                </>
              )}
            </Button>
          )}

          <Button
            onClick={translateAllBubbles}
            disabled={!selectedFileId || isProcessing("translate")}
            className="w-full"
          >
            {isProcessing("translate") ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Translating...
              </>
            ) : (
              <>
                <MessageSquare className="mr-2 h-4 w-4" />
                Translate All Bubbles
              </>
            )}
          </Button>

          {selectedPageId && (
            <Button
              onClick={translateAllBubbles}
              disabled={isProcessing("translate")}
              variant="outline"
              className="w-full"
            >
              {isProcessing("translate") ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                <>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Translate Current Page
                </>
              )}
            </Button>
          )}
        </CardContent>
      </Card>

      {selectedPage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-4 w-4" />
              Speech Bubbles
            </CardTitle>
            <CardDescription>
              Page {selectedPage.page_number} - {selectedPage.speech_bubbles.length} bubbles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {selectedPage.speech_bubbles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No speech bubbles detected. Run detection first.
                  </p>
                ) : (
                  selectedPage.speech_bubbles.map((bubble) => (
                    <div key={bubble.bubble_id} className="border rounded-lg p-3">
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary">Bubble #{bubble.bubble_no}</Badge>
                        <div className="flex gap-1">
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" onClick={() => setEditingBubble(bubble)}>
                                <Edit className="h-3 w-3" />
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Speech Bubble</DialogTitle>
                                <DialogDescription>
                                  Update the text and translation for this speech bubble
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4">
                                <div>
                                  <Label htmlFor="bubble-text">Original Text</Label>
                                  <Textarea
                                    id="bubble-text"
                                    value={bubbleText}
                                    onChange={(e) => setBubbleText(e.target.value)}
                                    placeholder="Enter original text"
                                  />
                                </div>
                                <div>
                                  <Label htmlFor="bubble-translation">Translation</Label>
                                  <Textarea
                                    id="bubble-translation"
                                    value={bubbleTranslation}
                                    onChange={(e) => setBubbleTranslation(e.target.value)}
                                    placeholder="Enter translation"
                                  />
                                </div>
                                <Button 
                                  onClick={() => updateBubbleTranslation(selectedPageId!, bubble.bubble_id, bubbleTranslation)} 
                                  className="w-full"
                                >
                                  <Save className="mr-2 h-4 w-4" />
                                  Save Translation
                                </Button>
                                <Button onClick={updateBubble} className="w-full">
                                  <Save className="mr-2 h-4 w-4" />
                                  Save All Changes
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                          <Button variant="outline" size="sm" onClick={() => deleteBubble(bubble.bubble_id)}>
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Original:</p>
                          <p className="text-sm">{bubble.text || "No text detected"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Translation:</p>
                          <p className="text-sm">{bubble.translation || "No translation"}</p>
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
                      <DialogDescription>Add a new speech bubble to this page</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="new-bubble-text">Text</Label>
                        <Textarea
                          id="new-bubble-text"
                          value={newBubbleData.text}
                          onChange={(e) => setNewBubbleData((prev) => ({ ...prev, text: e.target.value }))}
                          placeholder="Enter text"
                        />
                      </div>
                      <div>
                        <Label htmlFor="new-bubble-translation">Translation</Label>
                        <Textarea
                          id="new-bubble-translation"
                          value={newBubbleData.translation}
                          onChange={(e) => setNewBubbleData((prev) => ({ ...prev, translation: e.target.value }))}
                          placeholder="Enter translation"
                        />
                      </div>
                      <Button onClick={createBubble} className="w-full">
                        <Plus className="mr-2 h-4 w-4" />
                        Create Bubble
                      </Button>
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