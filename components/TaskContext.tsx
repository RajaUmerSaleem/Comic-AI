"use client";

import { createContext, useContext, useState } from "react";

export type TaskMap = Map<string, string>;

interface TaskContextType {
  tasks: TaskMap;
  setTasks: (tasks: TaskMap) => void;
  addTask: (key: string, taskId: string) => void;
  removeTask: (key: string) => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

export const TaskProvider = ({ children }: { children: React.ReactNode }) => {
  const [tasks, setTasks] = useState<TaskMap>(new Map());

  const addTask = (key: string, taskId: string) => {
    setTasks((prev) => {
      const updated = new Map(prev);
      updated.set(key, taskId);
      return updated;
    });
  };

  const removeTask = (key: string) => {
    setTasks((prev) => {
      const updated = new Map(prev);
      updated.delete(key);
      return updated;
    });
  };

  return (
    <TaskContext.Provider value={{ tasks, setTasks, addTask, removeTask }}>
      {children}
    </TaskContext.Provider>
  );
};

export const useTaskContext = () => {
  const context = useContext(TaskContext);
  if (!context) throw new Error("useTaskContext must be used within TaskProvider");
  return context;
};
