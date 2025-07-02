"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { Badge } from "@/components/ui/badge";
import { useTaskContext } from "@/components/TaskContext";

export default function TasksPage() {
  const { token } = useAuth();
  const { tasks, removeTask } = useTaskContext(); // Get tasks from context

  useEffect(() => {
    const interval = setInterval(() => {
      tasks.forEach((taskId, key) => {
        pollTaskStatus(taskId, key).then((status) => {
          if (status === "SUCCESS" || status === "FAILED") {
            removeTask(key); // Remove finished task from context
          }
        });
      });
    }, 3000);

    return () => clearInterval(interval);
  }, [tasks]);

  const pollTaskStatus = async (taskId: string, taskKey: string) => {
    try {
      const response = await fetch(
        `https://vibrant.productizetech.com/v1/file/task-status/${taskId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await response.json();
      return data.status;
    } catch (error) {
      return "ERROR";
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Task Status</h1>
      <div className="space-y-4 p-2">
        {tasks.size === 0 ? (
          <p className="text-muted-foreground">No active tasks.</p>
        ) : (
          Array.from(tasks.entries()).map(([key, taskId]) => (
            <TaskStatus key={taskId} taskId={taskId} token={token!} />
          ))
        )}
      </div>
    </div>
  );
}

function TaskStatus({
  taskId,
  token,
}: {
  taskId: string;
  token: string;
}) {
  const [status, setStatus] = useState<string>("Checking...");

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch(
          `https://vibrant.productizetech.com/v1/file/task-status/${taskId}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );
        const data = await res.json();
        setStatus(data.status || "Unknown");
      } catch (err) {
        setStatus("Error");
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [taskId, token]);

  return (
    <div className="flex justify-between items-center border p-2 rounded text-sm">
      <span className="font-medium text-gray-700">Task ID: {taskId}</span>
      <Badge variant="secondary">{status}</Badge>
    </div>
  );
}

