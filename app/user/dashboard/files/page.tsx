"use client";

import type React from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, uploadFile } from "@/lib/api";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Eye,
  RefreshCw,
  Image,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface FileItem {
  file_url: string;
  id: number;
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FilesResponse {
  files: FileItem[];
  total: number;
}

interface TaskResponse {
  task_id: string;
  file_id: number;
  status: string;
  message: string;
}

export default function FilesPage() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    if (!token) {
      router.push("/user/login");
      return;
    }
    fetchFiles();
  }, [router]);

  const fetchFiles = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const response: FilesResponse = await apiRequest("/v1/file/", {}, token!);
      console.log("API Response:", response);
      setFiles(response.files || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to fetch files",
        variant: "destructive",
      });
      if (error.status === 401) {
        localStorage.removeItem("userToken");
        localStorage.removeItem("userProfile");
        router.push("/user/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast({
        title: "Error",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await uploadFile("/v1/file/", selectedFile, token!);
      console.log("Upload Response:", response);

      toast({
        title: "Success",
        description: "File uploaded successfully",
      });
      setSelectedFile(null);
      const fileInput = document.getElementById(
        "file-upload"
      ) as HTMLInputElement;
      if (fileInput) fileInput.value = "";
      fetchFiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to upload file",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const deleteFile = async (fileId: number) => {
    try {
      const token = localStorage.getItem("userToken");
      await apiRequest(
        `/v1/file/${fileId}`,
        {
          method: "DELETE",
        },
        token!
      );

      toast({
        title: "Success",
        description: "File deleted successfully",
      });
      fetchFiles();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete file",
        variant: "destructive",
      });
    }
  };

  const pollTaskStatus = async (taskId: string, fileId: number, filename: string) => {
    const maxAttempts = 30; // Maximum number of polling attempts
    const pollInterval = 5000; // Poll every 5 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const token = localStorage.getItem("userToken");
        const response = await apiRequest(
          `/v1/file/task-status/${taskId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
          token!
        );

        console.log("Task Status Response:", response);

        if (response.status === "COMPLETED" || response.status === "FAILED") {
          // Update the file status in the local state
          setFiles((prevFiles) =>
            prevFiles.map((file) =>
              file.id === fileId ? { ...file, status: response.status } : file
            )
          );

          toast({
            title: response.status === "COMPLETED" ? "Success" : "Error",
            description: `Image extraction for "${filename}" ${
              response.status === "COMPLETED" ? "completed" : "failed"
            }.`,
            variant: response.status === "COMPLETED" ? "default" : "destructive",
          });

          return; // Exit polling on completion or failure
        }

        // Wait before the next poll
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      } catch (error: any) {
        toast({
          title: "Error",
          description: error.message || "Failed to check task status",
          variant: "destructive",
        });
        return; // Exit polling on error
      }
    }

    // If max attempts are reached
    toast({
      title: "Error",
      description: `Task status check timed out for "${filename}".`,
      variant: "destructive",
    });
  };

  const convertFile = async (fileId: number, filename: string) => {
    try {
      const token = localStorage.getItem("userToken");
      const response: TaskResponse = await apiRequest(
        `/v1/file/async-images-from-pdf?file_id=${fileId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
        token!
      );

      toast({
        title: "Success",
        description: `Image extraction started for "${filename}"`,
      });

      // Extract task_id and start polling
      if (response.task_id) {
        setFiles((prevFiles) =>
          prevFiles.map((file) =>
            file.id === fileId ? { ...file, status: response.status } : file
          )
        );
        pollTaskStatus(response.task_id, fileId, filename);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to initiate image extraction",
        variant: "destructive",
      });
    }
  };

  const handleViewFile = (file_path: string, filename: string) => {
    try {
      const url = new URL(file_path, window.location.origin).href;
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to view file",
        variant: "destructive",
      });
    }
  };

  const handleDownloadFile = (file_url: string, filename: string) => {
    try {
      const link = document.createElement("a");
      link.href = file_url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to download file",
        variant: "destructive",
      });
    }
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return (
      Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
    );
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status?.toLowerCase()) {
      case "completed":
        return "default";
      case "processing":
      case "progress":
        return "secondary";
      case "failed":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Loading files...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Files</h1>
        <p className="text-muted-foreground">
          Upload and manage your comic files
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Upload New File
          </CardTitle>
          <CardDescription>
            Upload PDF files to start working with comics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="file-upload">Select File</Label>
              <Input
                id="file-upload"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
                className="cursor-pointer"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {selectedFile.name} (
                  {formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>
            <Button
              onClick={handleUpload}
              disabled={isUploading || !selectedFile}
            >
              {isUploading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload File
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="mr-2 h-5 w-5" />
            Your Files ({files.length})
          </CardTitle>
          <CardDescription>Manage your uploaded files</CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                No files uploaded yet. Upload your first file above.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Filename</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => (
                  <TableRow key={file.id}>
                    <TableCell>
                      <div className="font-medium">{file.filename}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {file.id}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(file.status)}>
                        {file.status || "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(
                        file.created_at || Date.now()
                      ).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleViewFile(file.file_url, file.filename)
                          }
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleDownloadFile(file.file_url, file.filename)
                          }
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Image className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                Convert File to Images
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to extract images from "
                                {file.filename}"? This action will start the
                                image extraction process.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => convertFile(file.id, file.filename)}
                              >
                                Convert
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete File</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete "{file.filename}
                                "? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteFile(file.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}