import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, onSnapshot, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { Plus, Trash2, Edit2 } from 'lucide-react';

export default function Law1() {
  const { user } = useAuth();
  const [habits, setHabits] = useState<any[]>([]);
  const [newHabitName, setNewHabitName] = useState('');
  const [newHabitType, setNewHabitType] = useState<'good' | 'bad'>('good');

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

  const handleAddHabit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newHabitName.trim()) return;

    try {
      const habitsRef = collection(db, `users/${user.uid}/habits`);
      await addDoc(habitsRef, {
        name: newHabitName.trim(),
        type: newHabitType,
        createdAt: new Date().toISOString()
      });
      setNewHabitName('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${user.uid}/habits`);
    }
  };

  const handleDeleteHabit = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, `users/${user.uid}/habits`, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/habits/${id}`);
    }
  };

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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">The 1st Law: Make It Obvious</h1>
        <p className="mt-2 text-lg text-gray-600">
          Design your environment and clarify your intentions.
        </p>
      </div>

      {/* Add Habit Form */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Habit Inventory</h2>
        <form onSubmit={handleAddHabit} className="flex gap-4 items-end">
          <div className="flex-1">
            <label htmlFor="habitName" className="block text-sm font-medium text-gray-700 mb-1">New Habit</label>
            <input
              type="text"
              id="habitName"
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
              placeholder="e.g., Read 10 pages"
            />
          </div>
          <div>
            <label htmlFor="habitType" className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              id="habitType"
              value={newHabitType}
              onChange={(e) => setNewHabitType(e.target.value as 'good' | 'bad')}
              className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md p-2 border"
            >
              <option value="good">Good Habit (+)</option>
              <option value="bad">Bad Habit (-)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={!newHabitName.trim()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 mr-2" /> Add
          </button>
        </form>
      </div>

      {/* Implementation Intentions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Implementation Intentions</h2>
        <p className="text-sm text-gray-600 mb-6">
          Format: "I will [BEHAVIOR] at [TIME] in [LOCATION]."
        </p>
        
        <div className="space-y-6">
          {habits.filter(h => h.type === 'good').map((habit) => (
            <div key={habit.id} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium text-gray-900">{habit.name}</h3>
                <button onClick={() => handleDeleteHabit(habit.id)} className="text-red-500 hover:text-red-700">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <input
                type="text"
                value={habit.implementationIntention || ''}
                onChange={(e) => handleUpdateHabit(habit.id, 'implementationIntention', e.target.value)}
                placeholder="I will... at... in..."
                className="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          ))}
          {habits.filter(h => h.type === 'good').length === 0 && (
            <p className="text-sm text-gray-500 italic">Add a good habit above to set an implementation intention.</p>
          )}
        </div>
      </div>

      {/* Habit Stacking */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Habit Stacking</h2>
        <p className="text-sm text-gray-600 mb-6">
          Format: "After [CURRENT HABIT], I will [NEW HABIT]."
        </p>
        
        <div className="space-y-6">
          {habits.filter(h => h.type === 'good').map((habit) => (
            <div key={`stack-${habit.id}`} className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-medium text-gray-900 mb-2">{habit.name}</h3>
              <input
                type="text"
                value={habit.habitStacking || ''}
                onChange={(e) => handleUpdateHabit(habit.id, 'habitStacking', e.target.value)}
                placeholder="After I..., I will..."
                className="w-full text-sm border-gray-300 rounded-md p-2 border focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
