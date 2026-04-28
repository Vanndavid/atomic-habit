import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, setDoc } from 'firebase/firestore';
import { format } from 'date-fns';
import { CheckCircle2, Circle, Plus, Rocket } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

type TaskHabit = {
  id: string;
  name: string;
  type: 'good' | 'bad';
  cue?: string;
  response?: string;
};

const createStarterStep = (taskName: string) => {
  const normalizedTask = taskName.trim();
  return `Open VS Code, create a file named \"${normalizedTask}\", and work for 5 minutes.`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<TaskHabit[]>([]);
  const [completions, setCompletions] = useState<Record<string, string>>({});
  const [taskName, setTaskName] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [loading, setLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;

    const habitsRef = collection(db, `users/${user.uid}/habits`);
    const unsubscribeHabits = onSnapshot(
      query(habitsRef),
      (snapshot) => {
        const taskData = snapshot.docs
          .map((habitDoc) => ({ id: habitDoc.id, ...habitDoc.data() } as TaskHabit))
          .filter((habit) => habit.type === 'good');
        setTasks(taskData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`);
        setLoading(false);
      }
    );

    const completionsRef = collection(db, `users/${user.uid}/completions`);
    const unsubscribeCompletions = onSnapshot(
      query(completionsRef),
      (snapshot) => {
        const completionData: Record<string, string> = {};
        snapshot.docs.forEach((completionDoc) => {
          const data = completionDoc.data();
          if (data.date === today) {
            completionData[data.habitId] = completionDoc.id;
          }
        });
        setCompletions(completionData);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/completions`);
      }
    );

    return () => {
      unsubscribeHabits();
      unsubscribeCompletions();
    };
  }, [today, user]);

  const completedCount = useMemo(() => Object.keys(completions).length, [completions]);

  const handleAddTask = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || !taskName.trim()) return;

    const duration = Number(minutes);
    const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 60;

    try {
      await addDoc(collection(db, `users/${user.uid}/habits`), {
        name: taskName.trim(),
        type: 'good',
        cue: `${safeDuration}m`,
        response: createStarterStep(taskName),
        createdAt: new Date().toISOString(),
      });

      setTaskName('');
      setMinutes('60');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/habits`);
    }
  };

  const toggleTodayDone = async (taskId: string) => {
    if (!user) return;

    try {
      if (completions[taskId]) {
        await deleteDoc(doc(db, `users/${user.uid}/completions`, completions[taskId]));
      } else {
        const completionRef = doc(collection(db, `users/${user.uid}/completions`));
        await setDoc(completionRef, {
          habitId: taskId,
          date: today,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/completions`);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simple Task Dashboard</h1>
        <p className="mt-1 text-sm text-gray-600">
          Add one task, start tiny, and mark it done today.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Add Task</h2>
        <form className="grid grid-cols-1 md:grid-cols-5 gap-3" onSubmit={handleAddTask}>
          <input
            value={taskName}
            onChange={(event) => setTaskName(event.target.value)}
            placeholder="e.g. coding ai agent"
            className="md:col-span-3 border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            placeholder="60"
            inputMode="numeric"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            aria-label="task minutes"
          />
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </form>
      </div>

      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
        <p className="text-sm text-indigo-900 font-medium">
          Today: {completedCount}/{tasks.length} tasks completed
        </p>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-sm text-gray-500">Loading tasks...</div>
        ) : tasks.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6 text-center text-sm text-gray-500">
            No tasks yet. Add your first task above.
          </div>
        ) : (
          tasks.map((task) => {
            const isDone = Boolean(completions[task.id]);

            return (
              <div key={task.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-2">
                    <p className="font-semibold text-gray-900">{task.name}</p>
                    <p className="text-xs text-gray-500">Estimated focus: {task.cue || '60m'}</p>
                    <div className="flex items-start gap-2 text-sm bg-gray-50 border border-gray-200 rounded-lg p-2">
                      <Rocket className="w-4 h-4 mt-0.5 text-indigo-600" />
                      <span>{task.response || createStarterStep(task.name)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleTodayDone(task.id)}
                    className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium border ${
                      isDone
                        ? 'text-green-700 bg-green-50 border-green-200'
                        : 'text-gray-700 bg-white border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                    {isDone ? 'Done today' : 'Mark done'}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
