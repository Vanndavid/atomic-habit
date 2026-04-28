import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, where } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { GoogleGenAI } from '@google/genai';
import { Loader2, Plus, Sparkles, CheckCircle, Circle, Trash2, X, Flame, ListPlus } from 'lucide-react';
import { format, subDays, parseISO } from 'date-fns';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const calculateStreak = (completions: string[] = []) => {
  if (!completions.length) return 0;
  
  const sorted = [...new Set(completions)].sort().reverse(); 
  let streak = 0;
  let checkDate = new Date(); 
  checkDate.setHours(0,0,0,0);
  
  const todayStr = format(checkDate, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(checkDate, 1), 'yyyy-MM-dd');

  let currentExpected = '';
  if (sorted[0] === todayStr) {
    currentExpected = todayStr;
  } else if (sorted[0] === yesterdayStr) {
    currentExpected = yesterdayStr;
  } else {
    return 0; // Streak broken
  }

  let dateObj = parseISO(currentExpected);
  for (const dateStr of sorted) {
    if (dateStr === format(dateObj, 'yyyy-MM-dd')) {
      streak++;
      dateObj = subDays(dateObj, 1);
    } else {
      break;
    }
  }
  return streak;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;
    
    const tasksRef = collection(db, `users/${user.uid}/atomicTasks`);
    // Only fetch unarchived tasks
    const q = query(tasksRef, where('archived', '==', false));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      // client-side sort as firestore requires composite index for where+orderBy
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      data = data.sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setTasks(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/atomicTasks`);
      setLoading(false);
    });

    return unsubscribe;
  }, [user]);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTaskInput.trim() || isProcessing) return;

    setIsProcessing(true);
    try {
      const prompt = `The user wants to achieve this goal/task: "${newTaskInput}". 
Apply the 'Atomic Habits' 2-Minute Rule. Give them the absolute smallest, easiest micro-step to start this task right now. (Examples: "Open VS Code and the project folder", "Read 1 sentence of the book", "Put on workout shoes").
Return ONLY a plain string with the micro-step. Keep it under 80 characters.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      let microStep = response.text || "Just start for 2 minutes.";
      microStep = microStep.replace(/["\n]/g, '').trim();
      
      const tasksRef = collection(db, `users/${user.uid}/atomicTasks`);
      await addDoc(tasksRef, {
        objective: newTaskInput.trim(),
        microStep: microStep,
        completions: [],
        archived: false,
        createdAt: new Date().toISOString()
      });

      setNewTaskInput('');
    } catch (error) {
      console.error("Error processing task:", error);
      alert("Failed to generate atomic step. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleCompletion = async (taskId: string, currentCompletions: string[]) => {
    if (!user) return;
    try {
      const isCompletedToday = currentCompletions.includes(todayStr);
      let newCompletions = [...currentCompletions];
      
      if (isCompletedToday) {
        newCompletions = newCompletions.filter(d => d !== todayStr);
      } else {
        newCompletions.push(todayStr);
      }

      await updateDoc(doc(db, `users/${user.uid}/atomicTasks`, taskId), {
        completions: newCompletions
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/atomicTasks/${taskId}`);
    }
  };

  const archiveTask = async (taskId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/atomicTasks`, taskId), {
        archived: true
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/atomicTasks/${taskId}`);
    }
  };

  const loadDefaultRoutine = async () => {
    if (!user || isProcessing) return;
    setIsProcessing(true);
    
    const defaultTasks = [
      {
        objective: "Apply 5 jobs with dm to recruiter at least one",
        microStep: "Open job board and type your target role."
      },
      {
        objective: "Code AI Agent for 1h",
        microStep: "Open VS Code and launch the dev server."
      },
      {
        objective: "Preping job interview (Testing, System architecture, etc.) practice speaking.",
        microStep: "Open your prep doc and read one question out loud."
      },
      {
        objective: "Exercise 10 push up, 10 pull up.",
        microStep: "Do 1 push up right now."
      }
    ];

    try {
      const tasksRef = collection(db, `users/${user.uid}/atomicTasks`);
      await Promise.all(defaultTasks.map(task => 
        addDoc(tasksRef, {
          objective: task.objective,
          microStep: task.microStep,
          completions: [],
          archived: false,
          createdAt: new Date().toISOString()
        })
      ));
    } catch (error) {
      console.error("Error adding default tasks:", error);
      alert("Failed to load routine. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Daily Routine</h1>
        <p className="mt-2 text-lg text-gray-600">
          These tasks repeat <strong>every day</strong>. Build consistency by simply completing the AI-generated 2-minute micro-step.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50/50">
          <form onSubmit={handleAddTask} className="flex gap-4">
            <input
              type="text"
              disabled={isProcessing}
              value={newTaskInput}
              onChange={(e) => setNewTaskInput(e.target.value)}
              placeholder="e.g., Code AI agent for 1h, Apply to 5 jobs..."
              className="flex-1 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-lg p-3 bg-white"
            />
            <button
              type="submit"
              disabled={!newTaskInput.trim() || isProcessing}
              className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isProcessing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <Plus className="w-5 h-5 mr-1" />
                  Add Task
                </>
              )}
            </button>
          </form>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        ) : tasks.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p className="text-lg font-medium text-gray-900 mb-2">No tasks right now.</p>
            <p className="mb-6">What do you want to accomplish today?</p>
            
            <button
              onClick={loadDefaultRoutine}
              disabled={isProcessing}
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isProcessing ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ListPlus className="w-4 h-4 mr-2 text-indigo-500" />
              )}
              Load my daily routine (Job Hunt, Coding, Prep, Fitness)
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {tasks.map((task) => {
              const completedToday = task.completions?.includes(todayStr);
              const streak = calculateStreak(task.completions || []);
              return (
                <li key={task.id} className={`p-6 transition-colors flex items-start gap-4 ${completedToday ? 'bg-green-50/30' : 'hover:bg-gray-50'}`}>
                  <button 
                    onClick={() => toggleCompletion(task.id, task.completions || [])}
                    className={`mt-1 flex-shrink-0 transition-colors ${completedToday ? 'text-green-500 hover:text-green-600' : 'text-gray-300 hover:text-indigo-500'}`}
                  >
                    {completedToday ? <CheckCircle className="w-7 h-7" /> : <Circle className="w-7 h-7" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <p className={`text-base font-medium ${completedToday ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
                        {task.objective}
                      </p>
                      {streak > 0 && (
                        <span className={`inline-flex items-center text-xs font-bold rounded-full px-2 py-0.5 ${completedToday ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'}`} title="Current Streak">
                          <Flame className="w-3 h-3 mr-1" />
                          {streak} {streak === 1 ? 'Day' : 'Days'}
                        </span>
                      )}
                    </div>
                    {task.microStep && (
                      <div className="mt-2 inline-flex items-center px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-sm font-medium border border-indigo-100">
                        <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                        Micro-step: {task.microStep}
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => archiveTask(task.id)}
                    className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
                    title="Remove Task"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
