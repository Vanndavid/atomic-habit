import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export default function Law4() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    
    const habitsRef = collection(db, `users/${user.uid}/habits`);
    const q = query(habitsRef);
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const habitsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setHabits(habitsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/habits`);
    });

    return unsubscribe;
  }, [user]);

  const handleUpdateHabit = async (id: string, field: string, value: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `users/${user.uid}/habits`, id), {
        [field]: value
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}/habits/${id}`);
    }
  };

  const goodHabits = habits.filter(h => h.type === 'good');

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">The 4th Law: Make It Satisfying</h1>
        <p className="mt-2 text-lg text-gray-600">
          Use reinforcement and habit tracking to make good habits stick.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Immediate Rewards</h2>
        <div className="prose prose-indigo max-w-none text-gray-600 mb-6">
          <p>
            What is immediately rewarded is repeated. Give yourself an immediate reward when you complete your habit.
          </p>
        </div>
        
        <div className="space-y-6">
          {goodHabits.map((habit) => (
            <div key={habit.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-medium text-gray-900 mb-2">{habit.name}</h3>
              <div className="flex flex-col sm:flex-row gap-2 items-center">
                <span className="text-sm text-gray-500 whitespace-nowrap">Immediate Reward:</span>
                <input
                  type="text"
                  value={habit.reward || ''}
                  onChange={(e) => handleUpdateHabit(habit.id, 'reward', e.target.value)}
                  placeholder="e.g., Put $5 in my vacation fund"
                  className="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          ))}
          {goodHabits.length === 0 && (
            <p className="text-sm text-gray-500 italic">Add a good habit in the 1st Law section first.</p>
          )}
        </div>
      </div>
    </div>
  );
}
