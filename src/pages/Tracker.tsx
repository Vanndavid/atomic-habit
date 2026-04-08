import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { format, subDays, isSameDay, parseISO } from 'date-fns';
import { Check, X } from 'lucide-react';

export default function Tracker() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<any[]>([]);
  const [completions, setCompletions] = useState<Record<string, any>>({});
  
  // Generate last 7 days
  const days = Array.from({ length: 7 }).map((_, i) => subDays(new Date(), i)).reverse();

  useEffect(() => {
    if (!user) return;
    
    // Fetch habits
    const habitsRef = collection(db, `users/${user.uid}/habits`);
    const q = query(habitsRef);
    const unsubscribeHabits = onSnapshot(q, (snapshot) => {
      const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHabits(habitsData.filter((h: any) => h.type === 'good'));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`);
    });

    // Fetch completions
    const completionsRef = collection(db, `users/${user.uid}/completions`);
    const qCompletions = query(completionsRef);
    const unsubscribeCompletions = onSnapshot(qCompletions, (snapshot) => {
      const completionsData: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (!completionsData[data.habitId]) {
          completionsData[data.habitId] = {};
        }
        completionsData[data.habitId][data.date] = { id: doc.id };
      });
      setCompletions(completionsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/completions`);
    });

    return () => {
      unsubscribeHabits();
      unsubscribeCompletions();
    };
  }, [user]);

  const toggleCompletion = async (habitId: string, date: Date) => {
    if (!user) return;
    
    const dateStr = format(date, 'yyyy-MM-dd');
    const existingCompletion = completions[habitId]?.[dateStr];

    try {
      if (existingCompletion) {
        // Remove completion
        await deleteDoc(doc(db, `users/${user.uid}/completions`, existingCompletion.id));
      } else {
        // Add completion
        const newDocRef = doc(collection(db, `users/${user.uid}/completions`));
        await setDoc(newDocRef, {
          habitId: habitId,
          date: dateStr,
          createdAt: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/completions`);
    }
  };

  const calculateStreak = (habitId: string) => {
    const habitCompletions = completions[habitId] || {};
    let currentStreak = 0;
    let longestStreak = 0;
    
    // Calculate longest streak
    const sortedDates = Object.keys(habitCompletions).sort();
    let tempStreak = 0;
    let lastDate: Date | null = null;
    
    for (const dateStr of sortedDates) {
      const date = parseISO(dateStr);
      if (!lastDate) {
        tempStreak = 1;
      } else {
        const diffTime = Math.abs(date.getTime() - lastDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        if (diffDays === 1) {
          tempStreak++;
        } else {
          tempStreak = 1;
        }
      }
      if (tempStreak > longestStreak) longestStreak = tempStreak;
      lastDate = date;
    }

    // Calculate current streak
    let checkDate = new Date();
    let checkDateStr = format(checkDate, 'yyyy-MM-dd');
    
    // If not completed today, check if completed yesterday to keep streak alive
    if (!habitCompletions[checkDateStr]) {
      checkDate = subDays(checkDate, 1);
      checkDateStr = format(checkDate, 'yyyy-MM-dd');
    }

    while (habitCompletions[checkDateStr]) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
      checkDateStr = format(checkDate, 'yyyy-MM-dd');
    }

    return { currentStreak, longestStreak };
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Habit Tracker</h1>
        <p className="mt-2 text-lg text-gray-600">
          "Don't break the chain." Track your daily progress.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Habit
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Streak
                </th>
                {days.map((day, i) => (
                  <th key={i} scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {format(day, 'EEE')}<br/>
                    {format(day, 'd')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {habits.map((habit) => {
                const { currentStreak, longestStreak } = calculateStreak(habit.id);
                return (
                <tr key={habit.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{habit.name}</div>
                  </td>
                  <td className="px-3 py-4 whitespace-nowrap text-center">
                    <div className="text-sm font-bold text-indigo-600">{currentStreak} <span className="text-xs text-gray-400 font-normal">/ {longestStreak} max</span></div>
                  </td>
                  {days.map((day, i) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const isCompleted = !!completions[habit.id]?.[dateStr];
                    
                    return (
                      <td key={i} className="px-3 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => toggleCompletion(habit.id, day)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center mx-auto transition-colors ${
                            isCompleted 
                              ? 'bg-green-100 text-green-600 hover:bg-green-200' 
                              : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                          }`}
                        >
                          {isCompleted ? <Check className="w-5 h-5" /> : <X className="w-4 h-4 opacity-50" />}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              )})}
              {habits.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-sm text-gray-500 italic">
                    No good habits to track yet. Add some in the 1st Law section.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
