"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/api";
import {
  Eye,
  EyeOff,
  RefreshCw,
  Plus,
  Trash2,
  Zap,
  MessageSquare,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface SpeechBubble {
  bubble_id: number;
  bubble_no: number;
  coordinates_xyxy: number[];
  mask_coordinates_xyxy: number[][];
  text: string;
  translation: string;
  font_size?: number;
  font_color?: string;
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

interface ComicEditorSidebarProps {
  selectedFileId: number | null;
  selectedPageId: number | null;
  pages: PageData[];
  onDetectionStart: (pageId?: number) => void;
  onTextRemovalStart: (pageId?: number) => void;
  onPagesUpdate: () => void;
  processingTasks: Map<string, string>;
  mode: "editor" | "bubbles"; // ✅ added mode
}

export function ComicEditorSidebar({
  selectedFileId,
  selectedPageId,
  pages,
  onDetectionStart,
  onTextRemovalStart,
  onPagesUpdate,
  processingTasks,
  mode,
}: ComicEditorSidebarProps) {
  const { token } = useAuth();
  const [editingBubble, setEditingBubble] = useState<SpeechBubble | null>(null);
  const [bubbleText, setBubbleText] = useState("");
  const [isSinglePageTranslateDialogOpen, setIsSinglePageTranslateDialogOpen] =
    useState(false);
  const [bubbleTranslation, setBubbleTranslation] = useState("");
  const [fonts, setFonts] = useState<{ id: number; name: string }[]>([]);
  const [selectedFontId, setSelectedFontId] = useState<number | null>(null);
  const [isFontDialogOpen, setIsFontDialogOpen] = useState(false);

  const [newBubbleData, setNewBubbleData] = useState({
    page_id: 0,
    bubble_no: 0,
    coordinates_xyxy: [0, 0, 0, 0],
    mask_coordinates_xyxy: [[0, 0]],
    text: "",
    translation: "",
  });
  const { toast } = useToast();

  const selectedPage = pages.find((p) => p.page_id === selectedPageId);

  useEffect(() => {
    if (editingBubble) {
      setBubbleText(editingBubble.text);
      setBubbleTranslation(editingBubble.translation);
    }
  }, [editingBubble]);

  const fetchFonts = async () => {
    try {
      const response = await apiRequest("/v1/fonts/", {}, token!);
      setFonts(response || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch fonts",
        variant: "destructive",
      });
    }
  };

  const createBubble = async () => {
    if (!selectedPageId) return;
    try {
      await apiRequest(
        "/v1/pages/bubble",
        {
          method: "POST",
          body: JSON.stringify({ ...newBubbleData, page_id: selectedPageId }),
        },
        token!
      );
      toast({
        title: "Success",
        description: "Speech bubble created successfully",
      });
      setNewBubbleData({
        page_id: 0,
        bubble_no: 0,
        coordinates_xyxy: [0, 0, 0, 0],
        mask_coordinates_xyxy: [[0, 0]],
        text: "",
        translation: "",
      });
      onPagesUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const deleteBubble = async (bubbleId: number | undefined) => {
    if (bubbleId == null) {
      toast({
        title: "Error",
        description: "Missing bubble ID",
        variant: "destructive",
      });
      return;
    }
    try {
      await apiRequest(
        `/v1/pages/bubble/${bubbleId}`,
        { method: "DELETE" },
        token!
      );
      toast({ title: "Success", description: "Speech bubble deleted" });
      onPagesUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateBubbleTranslation = async (
    pageId: number,
    bubbleId: number,
    translation: string,
    font_size?: number,
    font_color?: string
  ) => {
    try {
      await apiRequest(
        `/v1/pages/${pageId}/bubble/${bubbleId}/translation`,
        {
          method: "PUT",
          body: JSON.stringify({
            page_id: pageId,
            font_id: 1,
            bubble_data: [
              {
                bubble_id: bubbleId,
                translation,
                font_size,
                font_color,
              },
            ],
          }),
        },
        token!
      );
      toast({ title: "Success", description: "Translation updated" });
      onPagesUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateBubbleText = async (
    pageId: number,
    bubbleId: number,
    text: string
  ) => {
    try {
      await apiRequest(
        `/v1/pages/${pageId}/bubble/${bubbleId}/text?text=${encodeURIComponent(
          text
        )}`,
        {
          method: "PUT",
        },
        token!
      );
      toast({ title: "Success", description: "Text updated" });
      onPagesUpdate();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const isProcessing = (type: string) => {
    const taskKey = selectedPageId
      ? `${type}-${selectedPageId}`
      : `${type}-${selectedFileId}`;
    return processingTasks.has(taskKey);
  };

  return (
    <div className="space-y-4">
      {mode === "editor" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="mr-2 h-4 w-4" />
              Processing Controls
            </CardTitle>
            <CardDescription>
              Generate detection and remove text from speech bubbles
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Detect Buttons Group */}
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
                  Detect Current Page
                </Button>
              )}
            </div>

            {/* Remove Text Buttons Group */}
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
                  className="w-full text-sm "
                >
                  <EyeOff className="mr-1 h-4 w-4" />
                  Remove Text Current Page
                </Button>
              )}
            </div>

            <div className="border rounded p-3 space-y-3">
              <Dialog
                open={isFontDialogOpen}
                onOpenChange={setIsFontDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button
                    onClick={() => {
                      fetchFonts();
                      setIsFontDialogOpen(true);
                    }}
                    disabled={!selectedFileId || isProcessing("translate")}
                    className="w-full"
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Translate All Bubbles
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Select Font for Translation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <Label htmlFor="font-select">Choose Font</Label>
                    <select
                      id="font-select"
                      className="w-full border p-2 rounded"
                      value={selectedFontId ?? ""}
                      onChange={(e) =>
                        setSelectedFontId(Number(e.target.value))
                      }
                    >
                      <option value="" disabled>
                        Select a font
                      </option>
                      {fonts.map((font) => (
                        <option key={font.id} value={font.id}>
                          {font.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      onClick={async () => {
                        if (!selectedFileId || !selectedFontId) return;
                        try {
                          await apiRequest(
                            `/v1/file/async-translate?file_id=${selectedFileId}&font_id=${selectedFontId}`,
                            { method: "POST" },
                            token!
                          );
                          toast({
                            title: "Success",
                            description: "Translation started for all pages",
                          });
                          setIsFontDialogOpen(false);
                          onPagesUpdate();
                        } catch (error: any) {
                          toast({
                            title: "Error",
                            description: error.message,
                            variant: "destructive",
                          });
                        }
                      }}
                      className="w-full"
                    >
                      Save and Translate All
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>

              {/* Translate Current Page Button */}
              {selectedPageId && (
                <Dialog
                  open={isSinglePageTranslateDialogOpen}
                  onOpenChange={setIsSinglePageTranslateDialogOpen}
                >
                  <DialogTrigger asChild>
                    <Button
                      onClick={() => {
                        fetchFonts();
                        setIsSinglePageTranslateDialogOpen(true);
                      }}
                      disabled={isProcessing("translate")}
                      variant="outline"
                      className="w-full"
                    >
                      <MessageSquare className="mr-2 h-4 w-4" />
                      Translate Current Page
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Select Font for Current Page</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <Label htmlFor="font-select-single">Choose Font</Label>
                      <select
                        id="font-select-single"
                        className="w-full border p-2 rounded"
                        value={selectedFontId ?? ""}
                        onChange={(e) =>
                          setSelectedFontId(Number(e.target.value))
                        }
                      >
                        <option value="" disabled>
                          Select a font
                        </option>
                        {fonts.map((font) => (
                          <option key={font.id} value={font.id}>
                            {font.name}
                          </option>
                        ))}
                      </select>
                      <Button
                        onClick={async () => {
                          if (
                            !selectedFileId ||
                            !selectedPageId ||
                            !selectedFontId
                          )
                            return;
                          try {
                            await apiRequest(
                              `/v1/file/async-translate?file_id=${selectedFileId}&font_id=${selectedFontId}&page_id=${selectedPageId}`,
                              { method: "POST" },
                              token!
                            );
                            toast({
                              title: "Success",
                              description:
                                "Translation started for current page",
                            });
                            setIsSinglePageTranslateDialogOpen(false);
                            onPagesUpdate();
                          } catch (error: any) {
                            toast({
                              title: "Error",
                              description: error.message,
                              variant: "destructive",
                            });
                          }
                        }}
                        className="w-full"
                      >
                        Save and Translate Page
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {mode === "bubbles" && selectedPage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <MessageSquare className="mr-2 h-4 w-4" />
              Speech Bubbles
            </CardTitle>
            <CardDescription>
              Page {selectedPage.page_number} -{" "}
              {selectedPage.speech_bubbles.length} bubbles
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
                    <div
                      key={bubble.bubble_id}
                      className="border rounded-lg p-3"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <Badge variant="secondary">
                          Bubble #{bubble.bubble_no} (Page{" "}
                          {selectedPage.page_number}, Box {bubble.bubble_no})
                        </Badge>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => deleteBubble(bubble.bubble_id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">
                          Original Text:
                        </p>
                        <Textarea
                          className="text-sm"
                          defaultValue={bubble.text}
                          onBlur={(e) =>
                            updateBubbleText(
                              selectedPage.page_id,
                              bubble.bubble_id,
                              e.target.value
                            )
                          }
                        />

                        <p className="text-xs font-medium text-muted-foreground">
                          Translation:
                        </p>
                        <Textarea
                          className="text-sm"
                          defaultValue={bubble.translation}
                          onBlur={(e) =>
                            updateBubbleTranslation(
                              selectedPage.page_id,
                              bubble.bubble_id,
                              e.target.value
                            )
                          }
                        />

                        <div className="flex items-center gap-4">
                          <div className="flex flex-col w-1/2">
                            <Label className="text-xs">Font Size</Label>
                            <input
                              type="number"
                              className="border rounded px-2 py-1 text-sm"
                              defaultValue={bubble.font_size || 12}
                              onBlur={(e) =>
                                updateBubbleTranslation(
                                  selectedPage.page_id,
                                  bubble.bubble_id,
                                  bubble.translation,
                                  Number(e.target.value),
                                  bubble.font_color || "#000000"
                                )
                              }
                            />
                          </div>
                          <div className="flex flex-col w-1/2">
                            <Label className="text-xs">Font Color</Label>
                            <input
                              type="color"
                              className="h-9 rounded"
                              defaultValue={bubble.font_color || "#000000"}
                              onBlur={(e) =>
                                updateBubbleTranslation(
                                  selectedPage.page_id,
                                  bubble.bubble_id,
                                  bubble.translation,
                                  bubble.font_size || 12,
                                  e.target.value
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
                        Add a new speech bubble to this page
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
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
                      <Label htmlFor="new-bubble-translation">
                        Translation
                      </Label>
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
  );
}
