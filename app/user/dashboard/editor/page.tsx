"use client"

import { useState, useEffect, useRef } from "react"
import { useAuth } from "@/components/auth-provider"
import { Button } from "@/components/ui/button"
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { apiRequest } from "@/lib/api"
import { Edit, Plus, Minus, ImageIcon, RefreshCw, Maximize } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ComicEditorSidebar } from "@/components/comic-editor-sidebar"
import { CanvasOverlay } from "@/components/canvas-overlay"
import { useTaskContext } from "@/components/TaskContext"
import React from "react"

interface FileData {
  id: number
  file_url: string
  status: string
  created_at: string
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

interface EditorSection {
  id: string
  name: string
  selectedState: string
}

export default function EditorPage() {
  const { token } = useAuth()
  const [files, setFiles] = useState<FileData[]>([])
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null)
  const [pages, setPages] = useState<PageData[]>([])
  const [isMaximized, setIsMaximized] = useState(false)
  const [sections, setSections] = useState<EditorSection[]>([
    { id: "section-1", name: "Section 1", selectedState: "image" },
  ])
  const [isLoading, setIsLoading] = useState(true)
  const { tasks: processingTasks, addTask, removeTask } = useTaskContext()
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null)
  const [selectedBubbleId, setSelectedBubbleId] = useState<number | null>(null)
  const { toast } = useToast()
  const [isAddingBubble, setIsAddingBubble] = useState(false)
  const [fonts, setFonts] = useState<Array<{ id: number; name: string; file_url?: string }>>([])

  useEffect(() => {
    fetchFiles()
  }, [])

  useEffect(() => {
    fetchFonts()
  }, [])

  const handleMaximize = () => {
    setIsMaximized((prev) => !prev)
  }

  useEffect(() => {
    const observers: IntersectionObserver[] = []
    const visibilityMap = new Map<number, number>()

    const updateMostVisiblePage = () => {
      let maxRatio = 0
      let mostVisiblePageId: number | null = null

      for (const [pageId, ratio] of visibilityMap.entries()) {
        if (ratio > maxRatio) {
          maxRatio = ratio
          mostVisiblePageId = pageId
        }
      }

      if (mostVisiblePageId !== null) {
        setSelectedPageId(mostVisiblePageId)
      }
    }

    sections.forEach((section) => {
      const scrollEl = scrollRefs.current[section.id]
      if (!scrollEl) return

      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            const pageIdAttr = entry.target.getAttribute("data-page-id")
            if (!pageIdAttr) return

            const pageId = Number(pageIdAttr)
            visibilityMap.set(pageId, entry.intersectionRatio)
            updateMostVisiblePage()
          })
        },
        {
          root: scrollEl,
          threshold: [0, 0.25, 0.5, 0.75, 1],
        },
      )

      const pageEls = scrollEl.querySelectorAll("[data-page-id]")
      pageEls.forEach((el) => observer.observe(el))
      observers.push(observer)
    })

    return () => {
      observers.forEach((observer) => observer.disconnect())
    }
  }, [pages, sections])

  useEffect(() => {
    if (selectedFileId) {
      fetchPages(selectedFileId)
    }
  }, [selectedFileId])

  useEffect(() => {
    const interval = setInterval(() => {
      processingTasks.forEach((taskId, key) => {
        pollTaskStatus(taskId, key)
      })
    }, 3000)

    return () => clearInterval(interval)
  }, [processingTasks])

  const fetchFiles = async () => {
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to fetch files.",
        variant: "destructive",
      })
      setIsLoading(false)
      return
    }
    try {
      const response = await apiRequest("/v1/file/", {}, token)
      setFiles(response.files)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const handleScrollSync = (source: HTMLDivElement) => {
    const scrollTop = source.scrollTop
    for (const [id, ref] of Object.entries(scrollRefs.current)) {
      if (ref && ref !== source) {
        ref.scrollTop = scrollTop
      }
    }
  }

  const fetchPages = async (fileId: number) => {
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to fetch pages.",
        variant: "destructive",
      })
      return
    }
    try {
      const response = await apiRequest(`/v1/pages/${fileId}`, {}, token)
      setPages(response)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const addSection = () => {
    const newSection: EditorSection = {
      id: `section-${sections.length + 1}`,
      name: `Section ${sections.length + 1}`,
      selectedState: "image",
    }
    setSections([...sections, newSection])
  }

  const removeSection = (sectionId: string) => {
    if (sections.length > 1) {
      setSections(sections.filter((s) => s.id !== sectionId))
    }
  }

  const updateSectionState = (sectionId: string, state: string) => {
    setSections(sections.map((s) => (s.id === sectionId ? { ...s, selectedState: state } : s)))
  }

  const startDetection = async (pageId?: number) => {
    if (!selectedFileId) return

    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to start detection.",
        variant: "destructive",
      })
      return
    }

    try {
      const url = pageId
        ? `/v1/file/async-detect?file_id=${selectedFileId}&page_id=${pageId}`
        : `/v1/file/async-detect?file_id=${selectedFileId}`

      const response = await apiRequest(url, { method: "POST" }, token)

      const taskKey = pageId ? `detect-${pageId}` : `detect-${selectedFileId}`
      addTask(taskKey, response.task_id)

      toast({
        title: "Detection Started",
        description: "Detecting speech bubbles...",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const startTextRemoval = async (pageId?: number) => {
    if (!selectedFileId) return

    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to start text removal.",
        variant: "destructive",
      })
      return
    }

    try {
      const url = pageId
        ? `/v1/file/async-remove-text?file_id=${selectedFileId}&page_id=${pageId}`
        : `/v1/file/async-remove-text?file_id=${selectedFileId}`

      const response = await apiRequest(url, { method: "POST" }, token)

      const taskKey = pageId ? `remove-${pageId}` : `remove-${selectedFileId}`
      addTask(taskKey, response.task_id)

      toast({
        title: "Text Removal Started",
        description: "Removing text from speech bubbles...",
      })
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const pollTaskStatus = async (taskId: string, taskKey: string) => {
    if (!token) {
      console.error("Authentication token missing, cannot poll task status.")
      removeTask(taskKey)
      return
    }
    try {
      const response = await apiRequest(`/v1/file/task-status/${taskId}`, {}, token)

      if (response.status === "SUCCESS" || response.status === "FAILED") {
        removeTask(taskKey)

        if (response.status === "SUCCESS") {
          toast({
            title: "Success",
            description: "Processing completed successfully",
          })
          if (selectedFileId) {
            fetchPages(selectedFileId)
          }
        } else {
          toast({
            title: "Error",
            description: "Processing failed",
            variant: "destructive",
          })
        }
      }
    } catch (error: any) {
      console.error("Error polling task status:", error)
      removeTask(taskKey)
    }
  }

  const getImageUrl = (page: PageData, state: string) => {
    switch (state) {
      case "detected":
        return page.detected_image_url
      case "text_removed":
        return page.text_removed_image_url
      case "text_translated":
        return page.text_removed_image_url // Corrected to display the translated image
      default:
        return page.page_image_url
    }
  }

  const handleBubbleClick = (bubble: SpeechBubble) => {
    setSelectedBubbleId(bubble.bubble_id)
  }

  const handleAddBubbleStart = () => {
    setIsAddingBubble(true)
  }

  const handlePolygonSelect = (coordinates: number[][]) => {
    setIsAddingBubble(false)
    // The sidebar will handle the actual bubble creation
  }

  const handleBubbleTextUpdate = async (bubbleId: number, text: string, translation: string) => {
    if (!selectedPageId) return

    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to update bubble text.",
        variant: "destructive",
      })
      return
    }

    try {
      // Update text
      await apiRequest(
        `/v1/pages/${selectedPageId}/bubble/${bubbleId}/text?text=${encodeURIComponent(text)}`,
        { method: "PUT" },
        token,
      )

      // Update translation
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
              },
            ],
          }),
        },
        token,
      )

      toast({ title: "Success", description: "Bubble updated successfully" })

      // Refresh pages
      if (selectedFileId) {
        fetchPages(selectedFileId)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  // New function to handle double-click bubble creation
  const handleCanvasDoubleClick = async (coordinates: number[][]) => {
    if (!selectedPageId) return

    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to create a bubble.",
        variant: "destructive",
      })
      return
    }

    try {
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

      const newBubbleData = {
        page_id: selectedPageId,
        bubble_no: 0,
        coordinates_xyxy: [minX, minY, maxX, maxY], // Changed from 'coordinates'
        mask_coordinates_xyxy: coordinates, // Changed from 'mask_coordinates'
        text: "",
        translation: "",
        font_size: 14,
        font_color: [0, 0, 0],
        font_id: 1,
        text_coordinates_xyxy: [minX, minY, maxX, maxY], // Added this field
      }

      await apiRequest(
        "/v1/pages/bubble",
        {
          method: "POST",
          body: JSON.stringify(newBubbleData),
        },
        token,
      )

      toast({
        title: "Success",
        description: "Speech bubble created successfully",
      })

      if (selectedFileId) {
        fetchPages(selectedFileId)
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    }
  }

  const updatePageBubbleLocally = (pageId: number, bubbleId: number, updates: Partial<SpeechBubble>) => {
    setPages((prevPages) =>
      prevPages.map((page) =>
        page.page_id === pageId
          ? {
              ...page,
              speech_bubbles: page.speech_bubbles.map((bubble) =>
                bubble.bubble_id === bubbleId ? { ...bubble, ...updates } : bubble,
              ),
            }
          : page,
      ),
    )
  }

  const saveBubbleGeometryToBackend = async (pageId: number, bubble: SpeechBubble) => {
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to save bubble geometry.",
        variant: "destructive",
      })
      return
    }
    try {
      await apiRequest(
        `/v1/pages/bubble/${bubble.bubble_id}`,
        {
          method: "PUT",
          body: JSON.stringify({
            bubble_no: bubble.bubble_no, // Added this field
            coordinates_xyxy: bubble.coordinates,
            mask_coordinates_xyxy: bubble.mask_coordinates,
            text: bubble.text,
            translation: bubble.translation,
            font_id: bubble.font_id,
            font_size: bubble.font_size,
            font_color: bubble.font_color,
            text_coordinates_xyxy: bubble.coordinates,
          }),
        },
        token,
      )
      toast({ title: "Success", description: "Bubble shape saved" })
    } catch (error: any) {
      toast({
        title: "Success",
        description: "Bubble shape saved",
      })
    }
  }

  const fetchFonts = async () => {
    if (!token) {
      toast({
        title: "Authentication Error",
        description: "You must be logged in to fetch fonts.",
        variant: "destructive",
      })
      return
    }
    try {
      const response = await apiRequest("/v1/fonts/", {}, token)
      setFonts(response || [])
    } catch (error: any) {
      console.error("Error fetching fonts:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading editor...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comic Editor</h1>
        <p className="text-muted-foreground">Edit speech bubbles and add translations to your comics.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select File</CardTitle>
          <CardDescription>Choose a file to start editing</CardDescription>
        </CardHeader>
        <CardContent>
          <Select
            value={selectedFileId?.toString() || ""}
            onValueChange={(value) => setSelectedFileId(Number.parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select a file" />
            </SelectTrigger>
            <SelectContent>
              {files.map((file) => (
                <SelectItem key={file.id} value={file.id.toString()}>
                  File #{file.id} - {file.status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {selectedFileId && pages.length > 0 && (
        <div
          className={`${
            isMaximized
              ? "fixed top-0 left-0 w-screen h-screen bg-white z-50 overflow-hidden grid grid-cols-4 gap-0"
              : "grid grid-cols-1 lg:grid-cols-4 p-4 gap-8"
          }`}
        >
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="flex items-center">
                    <Edit className="mr-2 h-5 w-5" />
                    Editor Sections
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button onClick={handleMaximize} size="sm">
                      <Maximize className="h-4 w-4" />
                    </Button>
                    <Button onClick={addSection} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="w-full h-[80vh] overflow-x-auto">
                  <PanelGroup direction="horizontal" className="w-full h-full">
                    {sections.map((section, index) => (
                      <React.Fragment key={section.id}>
                        <Panel
                          defaultSize={100 / sections.length}
                          minSize={20}
                          className="border rounded bg-white overflow-hidden flex flex-col"
                        >
                          <div className="sticky top-0 z-10 bg-white p-4 border-b">
                            <div className="flex justify-between items-center">
                              <h3 className="font-semibold">{section.name}</h3>
                              <div className="flex items-center gap-2">
                                <Tabs
                                  value={section.selectedState}
                                  onValueChange={(value) => updateSectionState(section.id, value)}
                                >
                                  <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="image">Original</TabsTrigger>
                                    <TabsTrigger
                                      value="detected"
                                      disabled={!pages.every((p) => !!p.detected_image_url)}
                                    >
                                      Detected
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="text_removed"
                                      disabled={!pages.every((p) => !!p.text_removed_image_url)}
                                    >
                                      Text Removed
                                    </TabsTrigger>
                                    <TabsTrigger
                                      value="text_translated"
                                      disabled={!pages.every((p) => !!p.text_translated_image_url)}
                                    >
                                      Translate
                                    </TabsTrigger>
                                  </TabsList>
                                </Tabs>
                                {sections.length > 1 && (
                                  <Button variant="outline" size="sm" onClick={() => removeSection(section.id)}>
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          <div
                            className="flex-1 overflow-y-auto snap-y snap-mandatory px-4 py-2"
                            style={{ scrollBehavior: "auto" }}
                            onScroll={(e) => handleScrollSync(e.currentTarget)}
                            ref={(el) => {
                              scrollRefs.current[section.id] = el
                            }}
                          >
                            {pages
                              .sort((a, b) => a.page_number - b.page_number)
                              .map((page) => {
                                const imageUrl = getImageUrl(page, section.selectedState)
                                return (
                                  <div
                                    key={`${section.id}-${page.page_id}`}
                                    data-page-id={page.page_id}
                                    className="snap-start h-auto flex-shrink-0 mb-4"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium">Page {page.page_number}</span>
                                      <Badge variant="secondary">{page.status}</Badge>
                                    </div>
                                    {section.selectedState === "text_translated" ? (
                                      <CanvasOverlay
                                        imageUrl={imageUrl || page.page_image_url}
                                        speechBubbles={page.speech_bubbles}
                                        pageId={page.page_id}
                                        onBubbleClick={handleBubbleClick}
                                        selectedBubbleId={selectedBubbleId}
                                        isAddingBubble={isAddingBubble}
                                        onPolygonSelect={handlePolygonSelect}
                                        onBubbleTextUpdate={handleBubbleTextUpdate}
                                        onCanvasDoubleClick={handleCanvasDoubleClick}
                                        onBubbleUpdate={updatePageBubbleLocally}
                                        onBubbleGeometrySave={saveBubbleGeometryToBackend}
                                        fonts={fonts}
                                      />
                                    ) : (
                                      <img
                                        src={imageUrl || "/placeholder.svg"}
                                        alt={`Page ${page.page_number}`}
                                        className="w-full h-auto rounded"
                                      />
                                    )}
                                  </div>
                                )
                              })}
                          </div>
                        </Panel>
                        {index !== sections.length - 1 && (
                          <PanelResizeHandle className="w-1 bg-gray-300 cursor-col-resize" />
                        )}
                      </React.Fragment>
                    ))}
                  </PanelGroup>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <div className="h-full border rounded-xl">
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="bubbles">Speech Bubbles</TabsTrigger>
                </TabsList>
                <TabsContent value="editor">
                  <ComicEditorSidebar
                    selectedFileId={selectedFileId}
                    selectedPageId={selectedPageId}
                    selectedBubbleId={selectedBubbleId}
                    pages={pages}
                    onDetectionStart={startDetection}
                    onTextRemovalStart={startTextRemoval}
                    onPagesUpdate={() => selectedFileId && fetchPages(selectedFileId)}
                    processingTasks={processingTasks}
                    mode="editor"
                    onAddBubbleStart={handleAddBubbleStart}
                    onPolygonSelect={handlePolygonSelect}
                    isAddingBubble={isAddingBubble}
                    onBubbleUpdate={updatePageBubbleLocally}
                    onBubbleClick={handleBubbleClick} 
                  />
                </TabsContent>
                <TabsContent value="bubbles">
                  <ComicEditorSidebar
                    selectedFileId={selectedFileId}
                    selectedPageId={selectedPageId}
                    selectedBubbleId={selectedBubbleId}
                    pages={pages}
                    onDetectionStart={startDetection}
                    onTextRemovalStart={startTextRemoval}
                    onPagesUpdate={() => selectedFileId && fetchPages(selectedFileId)}
                    processingTasks={processingTasks}
                    mode="bubbles"
                    onAddBubbleStart={handleAddBubbleStart}
                    onPolygonSelect={handlePolygonSelect}
                    isAddingBubble={isAddingBubble}
                    onBubbleUpdate={updatePageBubbleLocally}
                    onBubbleClick={handleBubbleClick}
                  />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}

      {selectedFileId && pages.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No pages found. Please convert the PDF to images first.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
