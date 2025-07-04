"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import {
  Edit,
  Plus,
  Minus,
  ImageIcon,
  EyeOff,
  RefreshCw,
  Maximize,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ComicEditorSidebar } from "@/components/comic-editor-sidebar";
import { useTaskContext } from "@/components/TaskContext";
import React from "react";

interface FileData {
  id: number;
  file_url: string;
  status: string;
  created_at: string;
}

interface PageData {
  page_number: number;
  page_id: number;
  page_image_url: string;
  detected_image_url: string | null;
  text_removed_image_url: string | null;
  text_translated_image_url: string | null;
  status: string;
  speech_bubbles: SpeechBubble[];
}

interface SpeechBubble {
  bubble_id: number;
  bubble_no: number;
  coordinates_xyxy: number[];
  mask_coordinates_xyxy: number[][];
  text: string;
  translation: string;
}

interface EditorSection {
  id: string;
  name: string;
  selectedState: string;
}

export default function EditorPage() {
  const { token } = useAuth();
  const [files, setFiles] = useState<FileData[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<number | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [sections, setSections] = useState<EditorSection[]>([
    { id: "section-1", name: "Section 1", selectedState: "image" },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const { tasks: processingTasks, addTask, removeTask } = useTaskContext();

  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleMaximize = () => {
    setIsMaximized((prev) => !prev);
  };

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageId = entry.target.getAttribute("data-page-id");
            if (pageId) {
              setSelectedPageId(Number(pageId));
            }
          }
        });
      },
      {
        root: null,
        threshold: 0.6, // Trigger when 60% of a page is in view
      }
    );

    const pageElements = document.querySelectorAll("[data-page-id]");
    pageElements.forEach((el) => observer.observe(el));

    return () => {
      pageElements.forEach((el) => observer.unobserve(el));
    };
  }, [pages]);

  useEffect(() => {
    if (selectedFileId) {
      fetchPages(selectedFileId);
    }
  }, [selectedFileId]);

  useEffect(() => {
    const interval = setInterval(() => {
      processingTasks.forEach((taskId, key) => {
        pollTaskStatus(taskId, key);
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [processingTasks]);

  const fetchFiles = async () => {
    try {
      const response = await apiRequest("/v1/file/", {}, token!);
      setFiles(response.files);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  const scrollRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const handleScrollSync = (source: HTMLDivElement) => {
    const scrollTop = source.scrollTop;
    for (const [id, ref] of Object.entries(scrollRefs.current)) {
      if (ref && ref !== source) {
        ref.scrollTop = scrollTop;
      }
    }
  };

  const lastClickedPageRef = useRef<number | null>(null);

  const fetchPages = async (fileId: number) => {
    try {
      const response = await apiRequest(`/v1/pages/${fileId}`, {}, token!);
      setPages(response);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const addSection = () => {
    const newSection: EditorSection = {
      id: `section-${sections.length + 1}`,
      name: `Section ${sections.length + 1}`,
      selectedState: "image",
    };
    setSections([...sections, newSection]);
  };

  const removeSection = (sectionId: string) => {
    if (sections.length > 1) {
      setSections(sections.filter((s) => s.id !== sectionId));
    }
  };

  const updateSectionState = (sectionId: string, state: string) => {
    setSections(
      sections.map((s) =>
        s.id === sectionId ? { ...s, selectedState: state } : s
      )
    );
  };

  const startDetection = async (pageId?: number) => {
    if (!selectedFileId) return;

    try {
      const url = pageId
        ? `/v1/file/async-detect?file_id=${selectedFileId}&page_id=${pageId}`
        : `/v1/file/async-detect?file_id=${selectedFileId}`;

      const response = await apiRequest(url, { method: "POST" }, token!);

      const taskKey = pageId ? `detect-${pageId}` : `detect-${selectedFileId}`;
      addTask(taskKey, response.task_id);

      toast({
        title: "Detection Started",
        description: "Detecting speech bubbles...",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const startTextRemoval = async (pageId?: number) => {
    if (!selectedFileId) return;

    try {
      const url = pageId
        ? `/v1/file/async-remove-text?file_id=${selectedFileId}&page_id=${pageId}`
        : `/v1/file/async-remove-text?file_id=${selectedFileId}`;

      const response = await apiRequest(url, { method: "POST" }, token!);

      const taskKey = pageId ? `remove-${pageId}` : `remove-${selectedFileId}`;
      addTask(taskKey, response.task_id);

      toast({
        title: "Text Removal Started",
        description: "Removing text from speech bubbles...",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const pollTaskStatus = async (taskId: string, taskKey: string) => {
    try {
      const response = await apiRequest(
        `/v1/file/task-status/${taskId}`,
        {},
        token!
      );

      if (response.status === "SUCCESS" || response.status === "FAILED") {
        removeTask(taskKey);

        if (response.status === "SUCCESS") {
          toast({
            title: "Success",
            description: "Processing completed successfully",
          });
          if (selectedFileId) {
            fetchPages(selectedFileId);
          }
        } else {
          toast({
            title: "Error",
            description: "Processing failed",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      console.error("Error polling task status:", error);
    }
  };

  const getImageUrl = (page: PageData, state: string) => {
    switch (state) {
      case "detected":
        return page.detected_image_url;
      case "text_removed":
        return page.text_removed_image_url;
      case "text_translated":
        return page.text_translated_image_url;
      default:
        return page.page_image_url;
    }
  };

  const isStateAvailable = (page: PageData, state: string) => {
    return getImageUrl(page, state) !== null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading editor...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Comic Editor</h1>
        <p className="text-muted-foreground">
          Edit speech bubbles and add translations to your comics.
        </p>
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
              ? "fixed top-0 left-0 w-screen  h-screen bg-white z-50 overflow-hidden grid grid-cols-4 gap-0"
              : "grid grid-cols-1 lg:grid-cols-4 p-4 gap-8"
          }`}
        >
          {" "}
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
                          {/* Fixed Section Header */}
                          <div className="sticky top-0 z-10 bg-white p-4 border-b">
                            <div className="flex justify-between items-center">
                              <h3 className="font-semibold">{section.name}</h3>
                              <div className="flex items-center gap-2">
                                <Tabs
                                  value={section.selectedState}
                                  onValueChange={(value) =>
                                    updateSectionState(section.id, value)
                                  }
                                >
                                  <TabsList className="grid w-full grid-cols-4">
                                    <TabsTrigger value="image">
                                      Original
                                    </TabsTrigger>
                                    <TabsTrigger value="detected">
                                      Detected
                                    </TabsTrigger>
                                    <TabsTrigger value="text_removed">
                                      Text Removed
                                    </TabsTrigger>
                                    <TabsTrigger value="text_translated">
                                      Translated
                                    </TabsTrigger>
                                  </TabsList>
                                </Tabs>
                                {sections.length > 1 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => removeSection(section.id)}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Scrollable Pages */}
                          <div
                            className="flex-1 overflow-y-auto snap-y snap-mandatory px-4 py-2"
                            style={{ scrollBehavior: "auto" }}
                            onScroll={(e) => handleScrollSync(e.currentTarget)}
                            ref={(el) => {
                              scrollRefs.current[section.id] = el;
                            }}
                          >
                            {pages
                              .sort((a, b) => a.page_number - b.page_number)
                              .map((page) => {
                                const imageUrl = getImageUrl(
                                  page,
                                  section.selectedState
                                );
                                return (
                                  <div
                                    key={`${section.id}-${page.page_id}`}
                                    data-page-id={page.page_id}
                                    className="snap-start flex-shrink-0 mb-4"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-sm font-medium">
                                        Page {page.page_number}
                                      </span>
                                      <Badge variant="secondary">
                                        {page.status}
                                      </Badge>
                                    </div>
                                    {imageUrl ? (
                                      <img
                                        src={imageUrl}
                                        alt={`Page ${page.page_number}`}
                                        className="w-full h-auto cursor-pointer rounded"
                                        onClick={() => {
                                          if (
                                            lastClickedPageRef.current ===
                                            page.page_id
                                          ) {
                                            setSelectedPageId(null);
                                          } else {
                                            setSelectedPageId(page.page_id);
                                          }
                                          lastClickedPageRef.current =
                                            page.page_id;
                                        }}
                                      />
                                    ) : (
                                      <div className="w-full h-48 border rounded flex items-center justify-center text-muted-foreground">
                                        <div className="text-center">
                                          <EyeOff className="h-8 w-8 mx-auto mb-2" />
                                          <p>Not available</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
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
          <div className="lg:col-span-1 ">
            <div className="h-full border rounded-xl">
              <Tabs defaultValue="editor" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="bubbles">Speech Bubbles</TabsTrigger>
                </TabsList>
                <TabsContent value="editor" className="border-none">
                  <ComicEditorSidebar
                    selectedFileId={selectedFileId}
                    selectedPageId={selectedPageId}
                    pages={pages}
                    onDetectionStart={startDetection}
                    onTextRemovalStart={startTextRemoval}
                    onPagesUpdate={() =>
                      selectedFileId && fetchPages(selectedFileId)
                    }
                    processingTasks={processingTasks}
                    mode="editor" // 👈 Only show buttons
                  />
                </TabsContent>
                <TabsContent value="bubbles">
                  <ComicEditorSidebar
                    selectedFileId={selectedFileId}
                    selectedPageId={selectedPageId}
                    pages={pages}
                    onDetectionStart={startDetection}
                    onTextRemovalStart={startTextRemoval}
                    onPagesUpdate={() =>
                      selectedFileId && fetchPages(selectedFileId)
                    }
                    processingTasks={processingTasks}
                    mode="bubbles" // 👈 Only show speech bubbles
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
            <p className="text-muted-foreground">
              No pages found. Please convert the PDF to images first.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
